pragma circom 2.0.0;

include "./modules/OldStateChecker.circom";
include "./modules/NewStateGenerator.circom";
include "./modules/PendingTransfersVerifier.circom";

/**
 * @title Apply
 * @notice Processes pending incoming transfers to update the user's confidential balance.
 * @dev Verifies that the user knows the private key for the current state (oldCommitment)
 *      and validates the commitments of the pending transfers.
 *      Computes the new confidential state (newCommitment, eAmount) by summing up valid pending transfers.
 * @param max Maximum number of pending transfers that can be processed in one batch. LessThan(32) supports inputs up to 2^32, so max should be less than 2^32.
 */ 
template Apply(max) {
    // --- Private Inputs ---
    signal input cPrivateKey;
    signal input oldAmount;
    signal input pendingTransfersAmounts[max];
    signal input pendingTransfersOTKs[max];

    // --- Public Inputs ---
    signal input chainId;
    signal input contractAddress;
    signal input n;
    signal input oldNonce;
    signal input oldCommitment;
    signal input pendingTransfersCommitments[max];

    // --- Public Outputs ---
    signal output newCommitment;
    signal output eAmount;

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

    var newAmount = pendingTransfers.totalAmount;
    var newNonce = oldNonce + 1;

    component newStateGenerator = NewStateGenerator();
    newStateGenerator.key <== cPrivateKey;
    newStateGenerator.chainId <== chainId;
    newStateGenerator.contractAddress <== contractAddress;
    newStateGenerator.newAmount <== newAmount;
    newStateGenerator.newNonce <== newNonce;
    newCommitment <== newStateGenerator.newCommitment;
    eAmount <== newStateGenerator.newEncryptedAmount;
}

component main { public [chainId, contractAddress, n, oldNonce, oldCommitment, pendingTransfersCommitments] } = Apply(10);