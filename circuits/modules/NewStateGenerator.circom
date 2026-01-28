pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/mux1.circom";
include "circomlib/circuits/comparators.circom";

include "../utils/OTKGenerator.circom";
include "../utils/CommitmentGenerator.circom";
include "../utils/SharedKeyGenerator.circom";
include "../utils/Cipherer.circom";

/**
 * @title NewStateGenerator
 * @notice Helper module to generate a new user state.
 * @dev Generates:
 *      1. One-Time Key (OTK) from the master key and nonce.
 *      2. New Commitment (Hash of amount and OTK).
 *      3. Encrypted Amount (using OTK as the encryption key).
 */
template NewStateGenerator() {
    signal input key;
    signal input newAmount;
    signal input newNonce;
    signal input chainId;
    signal input contractAddress;

    signal output OTK;
    signal output newCommitment;
    signal output newEncryptedAmount;

    component otkGenerator = OTKGenerator();
    otkGenerator.key <== key;
    otkGenerator.nonce <== newNonce;
    otkGenerator.chainId <== chainId;
    otkGenerator.contractAddress <== contractAddress;
    OTK <== otkGenerator.out;

    component commitmentGenerator = CommitmentGenerator();
    commitmentGenerator.amount <== newAmount;
    commitmentGenerator.otk <== OTK;
    newCommitment <== commitmentGenerator.out;

    component encryption = Cipherer();
    encryption.key <== OTK;
    encryption.nonce <== newNonce;
    encryption.plaintext <== newAmount;
    newEncryptedAmount <== encryption.ciphertext;
}