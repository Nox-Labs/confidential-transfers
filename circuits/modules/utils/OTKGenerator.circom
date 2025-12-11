pragma circom 2.0.0;

// One-time key generator
template OTKGenerator() {
    signal input key;
    signal input nonce;
    signal output out;

    component hasher = Poseidon(2);
    hasher.inputs[0] <== key;
    hasher.inputs[1] <== nonce;
    out <== hasher.out;
}