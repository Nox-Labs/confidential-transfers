pragma circom 2.0.0;

template PoseidonStreamCipher(n) {
    signal input key;
    signal input entropy;
    signal input plaintext[n];
    signal output ciphertext[n];

    component keystream[n];
    for (var i = 0; i < n; i++) {
        keystream[i] = Poseidon(2);
        keystream[i].inputs[0] <== key;
        keystream[i].inputs[1] <== entropy + i;
        
        ciphertext[i] <== plaintext[i] + keystream[i].out;
    }
}

template Cipherer() {
    signal input key;
    signal input nonce;
    signal input plaintext;
    signal output ciphertext;

    component cipher = PoseidonStreamCipher(1);
    cipher.key <== key;
    cipher.entropy <== nonce;
    cipher.plaintext[0] <== plaintext;
    ciphertext <== cipher.ciphertext[0];
}