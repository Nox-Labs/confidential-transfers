pragma circom 2.0.0;

include "./PoseidonStreamCipher.circom";

/**
 * @title Cipherer
 * @notice Wrapper for PoseidonStreamCipher for a single field element.
 * @dev Encrypts a single value using a key and nonce as entropy.
 */
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
