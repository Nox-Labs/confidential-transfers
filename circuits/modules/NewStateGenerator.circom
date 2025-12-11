pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/mux1.circom";
include "circomlib/circuits/comparators.circom";

include "./utils/OTKGenerator.circom";
include "./utils/CommitmentGenerator.circom";
include "./utils/SharedKeyGenerator.circom";
include "./utils/Cipherer.circom";

template NewStateGenerator() {
    signal input key;
    signal input newAmount;
    signal input newNonce;

    signal output OTK;
    signal output newCommitment;
    signal output newEncryptedAmount;

    component otkGenerator = OTKGenerator();
    otkGenerator.key <== key;
    otkGenerator.nonce <== newNonce;
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