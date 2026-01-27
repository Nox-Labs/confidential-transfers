pragma circom 2.0.0;

// One-time key generator
template OTKGenerator() {
    signal input key;
    signal input nonce;
    signal input chainId;
    signal input contractAddress;
    
    signal output out;

    component hasher = Poseidon(2);
    hasher.inputs[0] <== key;
    hasher.inputs[1] <== nonce;
    // hasher.inputs[2] <== chainId;
    // hasher.inputs[3] <== contractAddress;
    out <== hasher.out;
}