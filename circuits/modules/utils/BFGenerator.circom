pragma circom 2.0.0;

template BFGenerator() {
    signal input cPrivateKey;
    signal input nonce;
    signal output out;

    component hasher = Poseidon(2);
    hasher.inputs[0] <== cPrivateKey;
    hasher.inputs[1] <== nonce;
    out <== hasher.out;
}