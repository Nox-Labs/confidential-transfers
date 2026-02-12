pragma circom 2.0.0;

/**
 * @title CommitmentGenerator
 * @notice Generates a commitment for a confidential asset.
 * @dev Computes the commitment as the Poseidon hash of the amount and the One-Time Key (OTK).
 *      Commitment = Poseidon(amount, otk)
 */
template CommitmentGenerator() {
    signal input amount;
    signal input otk;
    signal output out;

    component commitmentGenerator = Poseidon(2);
    commitmentGenerator.inputs[0] <== amount;
    commitmentGenerator.inputs[1] <== otk;
    out <== commitmentGenerator.out;
}
