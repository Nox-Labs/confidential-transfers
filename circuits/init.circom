pragma circom 2.0.0;

include "circomlib/circuits/babyjub.circom";

include "./modules/NewStateGenerator.circom";

template Init() {
    // --- Private Inputs ---
    signal input cPrivateKey;   

    // --- Public Inputs ---
    signal input chainId;
    signal input contractAddress;

    // --- Public Outputs ---
    signal output cPublicKeyX;
    signal output cPublicKeyY;
    signal output newCommitment;
    signal output eAmount;
    
    var newNonce = 0; // nonce 0 for the initial commitment
    var newAmount = 0; // amount 0 for the initial commitment

    component pk2pub = BabyPbk();
    pk2pub.in <== cPrivateKey;
    cPublicKeyX <== pk2pub.Ax;
    cPublicKeyY <== pk2pub.Ay;

    component newStateGenerator = NewStateGenerator();
    newStateGenerator.key <== cPrivateKey;
    newStateGenerator.newAmount <== newAmount;
    newStateGenerator.newNonce <== newNonce;
    newStateGenerator.chainId <== chainId;
    newStateGenerator.contractAddress <== contractAddress;
    newCommitment <== newStateGenerator.newCommitment;
    eAmount <== newStateGenerator.newEncryptedAmount;
}

component main {public [chainId, contractAddress]} = Init();