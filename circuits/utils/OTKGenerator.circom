pragma circom 2.0.0;

/**
 * @title OTKGenerator
 * @notice Generates a One-Time Key (OTK) for transaction uniqueness and encryption.
 * @dev Computes a unique key based on the user's private key, nonce, chain ID, and contract address.
 *      OTK = Poseidon(key, nonce, chainId, contractAddress)
 *      This ensures replay protection across chains and contracts.
 */
template OTKGenerator() {
    signal input key;
    signal input nonce;
    signal input chainId;
    signal input contractAddress;
    
    signal output out;

    component hasher = Poseidon(4);
    hasher.inputs[0] <== key;
    hasher.inputs[1] <== nonce;
    hasher.inputs[2] <== chainId;
    hasher.inputs[3] <== contractAddress;
    out <== hasher.out;
}