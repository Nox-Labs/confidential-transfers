pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";

include "../utils/OTKGenerator.circom";
include "../utils/CommitmentGenerator.circom";

/**
 * @title OldStateChecker
 * @notice Helper module to verify the validity of a previous state.
 * @dev Reconstructs the commitment from the provided private key, amount, and nonce,
 *      and asserts that it matches the `oldCommitment` public input.
 *      This proves ownership of the account and correctness of the provided current state.
 */
template OldStateChecker() {
    signal input key;
    signal input chainId;
    signal input contractAddress;
    signal input oldAmount;
    signal input oldNonce;
    signal input oldCommitment;

    signal output oldOTK;

    component otkGenerator = OTKGenerator();
    otkGenerator.key <== key;
    otkGenerator.nonce <== oldNonce;
    otkGenerator.chainId <== chainId;
    otkGenerator.contractAddress <== contractAddress;
    oldOTK <== otkGenerator.out;

    component commitmentGenerator = CommitmentGenerator();
    commitmentGenerator.amount <== oldAmount;
    commitmentGenerator.otk <== oldOTK;
    oldCommitment === commitmentGenerator.out;
}