pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

include "./modules/OldStateChecker.circom";
include "./modules/NewStateGenerator.circom";
include "./modules/utils/CommitmentGenerator.circom";

template Apply(max) {
    // --- Private Inputs ---
    signal input cPrivateKey;
    signal input oldAmount;
    signal input pendingTransfersAmounts[max];
    signal input pendingTransfersBF[max];

    // --- Public Inputs ---
    signal input auditorPublicKey_X;
    signal input auditorPublicKey_Y;
    signal input n;
    signal input oldNonce;
    signal input oldCommitment;
    signal input pendingTransfersCommitments[max];

    // --- Public Outputs ---
    signal output newCommitment;
    signal output eAmount;
    signal output eAmountForAuditor;

    component oldStateChecker = OldStateChecker();
    oldStateChecker.cPrivateKey <== cPrivateKey;
    oldStateChecker.oldAmount <== oldAmount;
    oldStateChecker.oldNonce <== oldNonce;
    oldStateChecker.oldCommitment <== oldCommitment;
    oldStateChecker.isValid === 1;

    component commitmentGenerators[max];
    component bfGenerator[max];
    component isLess[max];
    signal intermediateAmount[max+1];
    
    intermediateAmount[0] <== oldAmount;

    for (var i = 0; i < max; i++) {
        isLess[i] = LessThan(32);
        isLess[i].in[0] <== i;
        isLess[i].in[1] <== n;
        // isLess[i].out will be 1 if i < n, and 0 otherwise.

        commitmentGenerators[i] = CommitmentGenerator();
        commitmentGenerators[i].amount <== pendingTransfersAmounts[i];
        commitmentGenerators[i].bf <== pendingTransfersBF[i];
        
        // Assertion:
        // (pendingTransfersCommitments[i] - commitmentGenerators[i].out) * isLess[i].out === 0
        // This means that if isLess[i].out == 0 (this is a fake transfer), the difference can be any.
        (pendingTransfersCommitments[i] - commitmentGenerators[i].out) * isLess[i].out === 0;

        // Add the sum only for real transfers
        intermediateAmount[i+1] <== intermediateAmount[i] + pendingTransfersAmounts[i] * isLess[i].out;
    }
    
    var newAmount = intermediateAmount[max];
    var newNonce = oldNonce + 1;

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

component main { public [auditorPublicKey_X, auditorPublicKey_Y, n, oldNonce, oldCommitment, pendingTransfersCommitments] } = Apply(10);