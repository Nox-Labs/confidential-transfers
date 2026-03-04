pragma circom 2.0.0;

include "../utils/SharedKeyGenerator.circom";
include "./NewStateGenerator.circom";

/**
 * @title TransferPackageGenerator
 * @notice Generates the transfer package (commitment + encrypted amount) for the recipient.
 * @dev Computes ECDH shared key between sender's private key and recipient's public key,
 *      then uses it as the encryption key for the transfer state.
 *      WARNING: Could be collision if sender and recipient make transfer to each other at the same nonce.
 */
template TransferPackageGenerator() {
    signal input privateKey;
    signal input recipientPublicKeyX;
    signal input recipientPublicKeyY;
    signal input chainId;
    signal input contractAddress;
    signal input transferAmount;
    signal input nonce;

    signal output transferCommitment;
    signal output transferEAmount;

    component sharedKeyGenerator = SharedKeyGenerator();
    sharedKeyGenerator.privateKey <== privateKey;
    sharedKeyGenerator.publicKeyX <== recipientPublicKeyX;
    sharedKeyGenerator.publicKeyY <== recipientPublicKeyY;
    signal sharedKey <== sharedKeyGenerator.sharedKey;

    component transferStateGenerator = NewStateGenerator();
    transferStateGenerator.key <== sharedKey;
    transferStateGenerator.chainId <== chainId;
    transferStateGenerator.contractAddress <== contractAddress;
    transferStateGenerator.newAmount <== transferAmount;
    transferStateGenerator.newNonce <== nonce;
    transferCommitment <== transferStateGenerator.newCommitment;
    transferEAmount <== transferStateGenerator.newEncryptedAmount;
}
