pragma circom 2.0.0;

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/babyjub.circom";

include "./utils/SharedKeyGenerator.circom";

include "./modules/OldStateChecker.circom";
include "./modules/NewStateGenerator.circom";

/**
 * @title ApplyAndTransfer
 * @notice Combines applying pending transfers and sending a new transfer in a single proof.
 * @dev Optimizes gas and proof generation by performing two operations (Apply + Transfer) at once.
 *      1. Updates balance by applying pending transfers.
 *      2. Checks if sufficient balance exists for the outgoing transfer.
 *      3. Generates the new state for the sender and the transfer package for the recipient.
 * @param max Maximum number of pending transfers that can be processed.
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

  // --- Private Outputs ---
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

  component commitmentGenerators[max];
  component otkGenerator[max];
  component isLess[max];
  signal intermediateAmount[max+1];
    
  intermediateAmount[0] <== oldAmount;

  for (var i = 0; i < max; i++) {
      isLess[i] = LessThan(32);
      isLess[i].in[0] <== i;
      isLess[i].in[1] <== n;
      // isLess[i].out will be 1 if i < n, and 0 otherwise.

      commitmentGenerators[i] = CommitmentGenerator();
      commitmentGenerators[i].amount <== pendingTransfersAmounts[i];
      commitmentGenerators[i].otk <== pendingTransfersOTKs[i];
      
      // Assertion:
      // If isLess[i].out == 0 (this is a fake transfer), the difference can be any.
      (pendingTransfersCommitments[i] - commitmentGenerators[i].out) * isLess[i].out === 0;

      // Add the sum only for real transfers
      intermediateAmount[i+1] <== intermediateAmount[i] + pendingTransfersAmounts[i] * isLess[i].out;
  }

  var tempAmount = intermediateAmount[max];

  // Assert enough balance
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

  // Calculate shared key 
  component sharedKeyGenerator = SharedKeyGenerator();
  sharedKeyGenerator.privateKey <== cPrivateKey;
  sharedKeyGenerator.publicKeyX <== recipientPublicKeyX;
  sharedKeyGenerator.publicKeyY <== recipientPublicKeyY;
  signal sharedKey <== sharedKeyGenerator.sharedKey;

  component transferStateGenerator = NewStateGenerator();
  transferStateGenerator.key <== sharedKey;
  transferStateGenerator.chainId <== chainId;
  transferStateGenerator.contractAddress <== contractAddress;
  transferStateGenerator.newAmount <== transferAmount;
  transferStateGenerator.newNonce <== newNonce;
  transferCommitment <== transferStateGenerator.newCommitment;
  transferEAmount <== transferStateGenerator.newEncryptedAmount;
}

component main { public [chainId, contractAddress, oldNonce, oldCommitment, recipientPublicKeyX, recipientPublicKeyY, n, pendingTransfersCommitments] } = ApplyAndTransfer(10);