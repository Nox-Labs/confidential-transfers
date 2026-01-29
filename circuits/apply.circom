pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

include "./utils/CommitmentGenerator.circom";

include "./modules/OldStateChecker.circom";
include "./modules/NewStateGenerator.circom";

/**
 * @title Apply
 * @notice Processes pending incoming transfers to update the user's confidential balance.
 * @dev Verifies that the user knows the private key for the current state (oldCommitment)
 *      and validates the commitments of the pending transfers.
 *      Computes the new confidential state (newCommitment, eAmount) by summing up valid pending transfers.
 * @param max Maximum number of pending transfers that can be processed in one batch.
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

    component commitmentGenerators[max];
    component otkGenerator[max];
    component isLess[max];
    signal intermediateAmount[max+1];
    
    intermediateAmount[0] <== oldAmount;

    for (var i = 0; i < max; i++) {
        isLess[i] = LessThan(32);
        isLess[i].in[0] <== i;
        isLess[i].in[1] <== n;
        // isLess[i].out is a boolean mask: 1 if this transfer should be processed (i < n), 0 otherwise.

        commitmentGenerators[i] = CommitmentGenerator();
        commitmentGenerators[i].amount <== pendingTransfersAmounts[i];
        commitmentGenerators[i].otk <== pendingTransfersOTKs[i];
        
        // Verification Logic:
        // If isLess[i].out is 1 (active transfer): we assert that calculated commitment equals provided commitment.
        // If isLess[i].out is 0 (padding transfer): the check is multiplied by 0, effectively skipping verification.
        (pendingTransfersCommitments[i] - commitmentGenerators[i].out) * isLess[i].out === 0;

        // Accumulator Logic:
        // We add the amount to the intermediate sum ONLY if it's an active transfer (multiplied by mask).
        intermediateAmount[i+1] <== intermediateAmount[i] + pendingTransfersAmounts[i] * isLess[i].out;
    }
    
    var newAmount = intermediateAmount[max];
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