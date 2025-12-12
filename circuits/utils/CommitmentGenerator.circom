pragma circom 2.0.0;

template CommitmentGenerator() {
    signal input amount;
    signal input otk;
    signal output out;

    component commitmentGenerator = Poseidon(2);
    commitmentGenerator.inputs[0] <== amount;
    commitmentGenerator.inputs[1] <== otk;
    out <== commitmentGenerator.out;
}
