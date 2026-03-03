pragma circom 2.0.0;

include "circomlib/circuits/comparators.circom";

include "./modules/OldStateChecker.circom";
include "./modules/NewStateGenerator.circom";
include "./modules/PendingTransfersVerifier.circom";
include "./modules/TransferPackageGenerator.circom";

/**
 * @title ApplyAndTransfer
 * @notice Combines applying pending transfers and sending a new transfer in a single proof.
 * @dev Optimizes gas and proof generation by performing two operations (Apply + Transfer) at once.
 *      1. Updates balance by applying pending transfers.
 *      2. Checks if sufficient balance exists for the outgoing transfer.
 *      3. Generates the new state for the sender and the transfer package for the recipient.
 * @param max Maximum number of pending transfers that can be processed. Must be less than 2^32 (LessThan(32) constraint).
 */
template ApplyAndTransfer(max) {
  // --- Private Inputs ---
  signal input cPrivateKey;
  signal input oldAmount;
  signal input transferAmount;
  signal input pendingTransfersAmounts[max];
  signal input pendingTransfersOTKs[max];

  // --- Public Inputs ---
  signal input chainId;
  signal input contractAddress;
  signal input oldNonce;
  signal input oldCommitment;
  signal input recipientPublicKeyX;
  signal input recipientPublicKeyY;
  signal input n;
  signal input pendingTransfersCommitments[max];

  // --- Public Outputs ---
  signal output newCommitment;
  signal output eAmount;
  signal output transferCommitment;
  signal output transferEAmount;

  var newNonce = oldNonce + 1;

  component oldStateChecker = OldStateChecker();
  oldStateChecker.key <== cPrivateKey;
  oldStateChecker.chainId <== chainId;
  oldStateChecker.contractAddress <== contractAddress;
  oldStateChecker.oldAmount <== oldAmount;
  oldStateChecker.oldNonce <== oldNonce;
  oldStateChecker.oldCommitment <== oldCommitment;

  component pendingTransfers = PendingTransfersVerifier(max);
  pendingTransfers.oldAmount <== oldAmount;
  pendingTransfers.n <== n;
  pendingTransfers.pendingTransfersAmounts <== pendingTransfersAmounts;
  pendingTransfers.pendingTransfersOTKs <== pendingTransfersOTKs;
  pendingTransfers.pendingTransfersCommitments <== pendingTransfersCommitments;

  var tempAmount = pendingTransfers.totalAmount;

  component checkEnoughBalance = LessEqThan(252);
  checkEnoughBalance.in[0] <== transferAmount;
  checkEnoughBalance.in[1] <== tempAmount;
  checkEnoughBalance.out === 1;

  var newAmount = tempAmount - transferAmount;

  component newStateGenerator = NewStateGenerator();
  newStateGenerator.key <== cPrivateKey;
  newStateGenerator.chainId <== chainId;
  newStateGenerator.contractAddress <== contractAddress;
  newStateGenerator.newAmount <== newAmount;
  newStateGenerator.newNonce <== newNonce;
  newCommitment <== newStateGenerator.newCommitment;
  eAmount <== newStateGenerator.newEncryptedAmount;

  component transferPackage = TransferPackageGenerator();
  transferPackage.privateKey <== cPrivateKey;
  transferPackage.recipientPublicKeyX <== recipientPublicKeyX;
  transferPackage.recipientPublicKeyY <== recipientPublicKeyY;
  transferPackage.chainId <== chainId;
  transferPackage.contractAddress <== contractAddress;
  transferPackage.transferAmount <== transferAmount;
  transferPackage.nonce <== newNonce;
  transferCommitment <== transferPackage.transferCommitment;
  transferEAmount <== transferPackage.transferEAmount;
}

component main { public [chainId, contractAddress, oldNonce, oldCommitment, recipientPublicKeyX, recipientPublicKeyY, n, pendingTransfersCommitments] } = ApplyAndTransfer(10);