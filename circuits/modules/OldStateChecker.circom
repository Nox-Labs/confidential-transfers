pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";

include "./utils/OTKGenerator.circom";
include "./utils/CommitmentGenerator.circom";

template OldStateChecker() {
    signal input key;
    signal input oldAmount;
    signal input oldNonce;
    signal input oldCommitment;

    signal output oldOTK;

    component otkGenerator = OTKGenerator();
    otkGenerator.key <== key;
    otkGenerator.nonce <== oldNonce;
    oldOTK <== otkGenerator.out;

    component commitmentGenerator = CommitmentGenerator();
    commitmentGenerator.amount <== oldAmount;
    commitmentGenerator.otk <== oldOTK;
    oldCommitment === commitmentGenerator.out;
}