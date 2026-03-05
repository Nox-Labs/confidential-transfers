pragma circom 2.0.0;

include "circomlib/circuits/comparators.circom";
include "../utils/CommitmentGenerator.circom";

/**
 * @title PendingTransfersVerifier
 * @notice Verifies pending transfer commitments and accumulates their amounts.
 * @dev For each active transfer (i < n), asserts that the provided commitment
 *      matches the one computed from (amount, OTK), and adds the amount to the running total.
 *      Padding slots (i >= n) are skipped via a boolean mask.
 * @param max Maximum number of pending transfers. Must be less than 2^32 (LessThan(32) constraint).
 */
template PendingTransfersVerifier(max) {
    signal input oldAmount;
    signal input n;
    signal input pendingTransfersAmounts[max];
    signal input pendingTransfersOTKs[max];
    signal input pendingTransfersCommitments[max];

    signal output totalAmount;

    component notZero = IsZero();
    notZero.in <== n;
    notZero.out === 0;

    component checkN = LessEqThan(32);
    checkN.in[0] <== n;
    checkN.in[1] <== max;

    component commitmentGenerators[max];
    component isLess[max];
    signal intermediateAmount[max+1];

    intermediateAmount[0] <== oldAmount;

    for (var i = 0; i < max; i++) {
        isLess[i] = LessThan(32);
        isLess[i].in[0] <== i;
        isLess[i].in[1] <== n;

        commitmentGenerators[i] = CommitmentGenerator();
        commitmentGenerators[i].amount <== pendingTransfersAmounts[i];
        commitmentGenerators[i].otk <== pendingTransfersOTKs[i];

        (pendingTransfersCommitments[i] - commitmentGenerators[i].out) * isLess[i].out === 0;

        intermediateAmount[i+1] <== intermediateAmount[i] + pendingTransfersAmounts[i] * isLess[i].out;
    }

    totalAmount <== intermediateAmount[max];
}
