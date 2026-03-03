pragma circom 2.0.0;

include "circomlib/circuits/comparators.circom";

include "./modules/OldStateChecker.circom";
include "./modules/NewStateGenerator.circom";
include "./modules/TransferPackageGenerator.circom";

/**
 * @title Transfer
 * @notice Processes a transfer of confidential assets from the sender to a recipient.
 * @dev 1. Verifies the sender's current state (oldCommitment) and sufficient balance.
 *      2. Generates the sender's new state (decreased amount, incremented nonce).
 *      3. Computes a shared secret (ECDH) between sender and recipient.
 *      4. Uses the shared secret to create a transfer package (commitment, eAmount) for the recipient.
 */
template Transfer() {
    // --- Private Inputs ---
    signal input cPrivateKey;
    signal input oldAmount;
    signal input transferAmount;

    // --- Public Inputs ---
    signal input chainId;
    signal input contractAddress;
    signal input oldNonce;
    signal input oldCommitment;
    signal input recipientPublicKeyX;
    signal input recipientPublicKeyY;

    // --- Public Outputs ---
    signal output newCommitment;
    signal output eAmount;
    signal output transferCommitment;
    signal output transferEAmount;

    component oldStateChecker = OldStateChecker();
    oldStateChecker.key <== cPrivateKey;
    oldStateChecker.chainId <== chainId;
    oldStateChecker.contractAddress <== contractAddress;
    oldStateChecker.oldAmount <== oldAmount;
    oldStateChecker.oldNonce <== oldNonce;
    oldStateChecker.oldCommitment <== oldCommitment;

    component checkEnoughBalance = LessEqThan(252);
    checkEnoughBalance.in[0] <== transferAmount;
    checkEnoughBalance.in[1] <== oldAmount;
    checkEnoughBalance.out === 1;

    var newNonce = oldNonce + 1;
    var newAmount = oldAmount - transferAmount;

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

component main { public [chainId, contractAddress, oldNonce, oldCommitment, recipientPublicKeyX, recipientPublicKeyY] } = Transfer();
