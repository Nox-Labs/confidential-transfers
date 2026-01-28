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
    signal input publicKey_X;
    signal input publicKey_Y;

    signal output sharedKey_X;
    signal output sharedKey_Y;

    // convert the private key to its bits representation
    var out[254];
    out = Num2Bits(254)(privateKey);

    // multiply the public key by the private key
    var mulFix[2];
    mulFix = EscalarMulAny(254)(out, [publicKey_X, publicKey_Y]);

    // we can then wire the output to the shared secret signal
    sharedKey_X <== mulFix[0];
    sharedKey_Y <== mulFix[1];
}

/**
 * @title SharedKeyGenerator
 * @notice Wrapper around ECDH to produce a single field element shared key.
 * @dev Uses ECDH to compute the shared point, then takes the X coordinate as the shared key.
 */
template SharedKeyGenerator() {
    signal input privateKey;
    signal input publicKey_X;
    signal input publicKey_Y;

    signal output sharedKey;

    component ecdh = ECDH();
    ecdh.privateKey <== privateKey;
    ecdh.publicKey_X <== publicKey_X;
    ecdh.publicKey_Y <== publicKey_Y;
    sharedKey <== ecdh.sharedKey_X;
}