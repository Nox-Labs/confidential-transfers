pragma circom 2.0.0;

/**
 * @title PoseidonStreamCipher
 * @notice A simple stream cipher based on the Poseidon hash function.
 * @dev Generates a keystream by hashing a key and a counter (entropy + index).
 *      Encrypts plaintext by adding the keystream (field addition).
 * @param n Length of the plaintext array.
 */
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
