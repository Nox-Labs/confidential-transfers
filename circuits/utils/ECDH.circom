pragma circom 2.1.5;

include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/escalarmulany.circom";

/**
 * @title ECDH
 * @notice Elliptic Curve Diffie-Hellman (ECDH) on Baby Jubjub curve.
 * @dev Computes a shared secret point from a private key and a public key.
 *      SharedSecret = privateKey * PublicKey (scalar multiplication)
 */
template ECDH() {
    // the private key must pass through deriveScalar first
    signal input privateKey;
    signal input publicKeyX;
    signal input publicKeyY;

    signal output sharedKeyX;
    signal output sharedKeyY;

    // convert the private key to its bits representation
    var out[254];
    out = Num2Bits_strict()(privateKey);

    // multiply the public key by the private key
    var mulFix[2];
    mulFix = EscalarMulAny(254)(out, [publicKeyX, publicKeyY]);

    // we can then wire the output to the shared secret signal
    sharedKeyX <== mulFix[0];
    sharedKeyY <== mulFix[1];
}
