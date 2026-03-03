pragma circom 2.1.5;

include "./ECDH.circom";

/**
 * @title SharedKeyGenerator
 * @notice Wrapper around ECDH to produce a single field element shared key.
 * @dev Uses ECDH to compute the shared point, then takes the X coordinate as the shared key.
 */
template SharedKeyGenerator() {
    signal input privateKey;
    signal input publicKeyX;
    signal input publicKeyY;

    signal output sharedKey;

    component ecdh = ECDH();
    ecdh.privateKey <== privateKey;
    ecdh.publicKeyX <== publicKeyX;
    ecdh.publicKeyY <== publicKeyY;
    sharedKey <== ecdh.sharedKeyX;
}
