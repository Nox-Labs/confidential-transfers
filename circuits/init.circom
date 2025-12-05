pragma circom 2.0.0;

include "circomlib/circuits/babyjub.circom";
include "./modules/NewStateGenerator.circom";

template Init() {
    // --- Private Inputs ---
    signal input cPrivateKey;

    // --- Public Inputs ---
    signal input auditorPublicKey_X;
    signal input auditorPublicKey_Y;

    // --- Public Outputs ---
    signal output cPublicKey_X;
    signal output cPublicKey_Y;
    signal output newCommitment;
    signal output eAmount;
    signal output eAmountForAuditor;
    
    var newNonce = 0; // nonce 0 for the initial commitment
    var newAmount = 0; // amount 0 for the initial commitment

    component pk2pub = BabyPbk();
    pk2pub.in <== cPrivateKey;
    cPublicKey_X <== pk2pub.Ax;
    cPublicKey_Y <== pk2pub.Ay;

    component newStateGenerator = NewStateGenerator();
    newStateGenerator.cPrivateKey <== cPrivateKey;
    newStateGenerator.auditorPublicKey_X <== auditorPublicKey_X;
    newStateGenerator.auditorPublicKey_Y <== auditorPublicKey_Y;
    newStateGenerator.newAmount <== newAmount;
    newStateGenerator.newNonce <== newNonce;
    newCommitment <== newStateGenerator.newCommitment;
    eAmount <== newStateGenerator.newEncryptedAmount;
    eAmountForAuditor <== newStateGenerator.newEncryptedAmountForAuditor;
}

component main { public [auditorPublicKey_X, auditorPublicKey_Y] } = Init();