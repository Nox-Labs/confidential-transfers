pragma circom 2.0.0;

include "circomlib/circuits/babyjub.circom";

include "./modules/NewStateGenerator.circom";

template Init() {
    // --- Private Inputs ---
    signal input cPrivateKey;   

    // --- Public Outputs ---
    signal output cPublicKey_X;
    signal output cPublicKey_Y;
    signal output newCommitment;
    signal output eAmount;
    
    var newNonce = 0; // nonce 0 for the initial commitment
    var newAmount = 0; // amount 0 for the initial commitment

    component pk2pub = BabyPbk();
    pk2pub.in <== cPrivateKey;
    cPublicKey_X <== pk2pub.Ax;
    cPublicKey_Y <== pk2pub.Ay;

    component newStateGenerator = NewStateGenerator();
    newStateGenerator.key <== cPrivateKey;
    newStateGenerator.newAmount <== newAmount;
    newStateGenerator.newNonce <== newNonce;
    newCommitment <== newStateGenerator.newCommitment;
    eAmount <== newStateGenerator.newEncryptedAmount;
}

component main = Init();