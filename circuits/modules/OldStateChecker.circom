pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "./utils/BFGenerator.circom";
include "./utils/CommitmentGenerator.circom";

template OldStateChecker() {
    signal input cPrivateKey;
    signal input oldAmount;
    signal input oldNonce;
    signal input oldCommitment;

    signal output isValid;
    signal output oldBF;

    component bfGenerator = BFGenerator();
    bfGenerator.cPrivateKey <== cPrivateKey;
    bfGenerator.nonce <== oldNonce;
    oldBF <== bfGenerator.out;

    component commitmentGenerator = CommitmentGenerator();
    commitmentGenerator.amount <== oldAmount;
    commitmentGenerator.bf <== oldBF;
    oldCommitment === commitmentGenerator.out;

    isValid <== 1;
}