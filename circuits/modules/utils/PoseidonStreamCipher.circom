pragma circom 2.0.0;

template PoseidonStreamCipher(n) {
    signal input key;
    signal input nonce;
    signal input plaintext[n];
    signal output ciphertext[n];

    component poseidon = Poseidon(1);
    poseidon.inputs[0] <== nonce;
    signal entropy <== poseidon.out;

    component keystream[n];
    for (var i = 0; i < n; i++) {
        keystream[i] = Poseidon(2);
        keystream[i].inputs[0] <== key;
        keystream[i].inputs[1] <== entropy + i;
        ciphertext[i] <== plaintext[i] + keystream[i].out;
    }
}
