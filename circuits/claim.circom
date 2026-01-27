pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

include "./modules/OldStateChecker.circom";
include "./modules/NewStateGenerator.circom";

template Claim() {
    // --- Private Inputs ---
    signal input cPrivateKey;
    signal input oldAmount;
    signal input pendingTransferAmount;

    // --- Public Inputs ---
    signal input chainId;
    signal input contractAddress;
    signal input oldNonce;
    signal input oldCommitment;
    signal input pendingTransferNonce;
    signal input pendingTransferCommitment;
    signal input recipientPublicKeyX;
    signal input recipientPublicKeyY;

    // --- Public Outputs ---
    signal output newCommitment;
    signal output eAmount;

    component oldStateChecker = OldStateChecker();
    oldStateChecker.key <== cPrivateKey;
    oldStateChecker.chainId <== chainId;
    oldStateChecker.contractAddress <== contractAddress;
    oldStateChecker.oldAmount <== oldAmount;
    oldStateChecker.oldNonce <== oldNonce;
    oldStateChecker.oldCommitment <== oldCommitment;

    component sharedKeyGenerator = SharedKeyGenerator();
    sharedKeyGenerator.privateKey <== cPrivateKey;
    sharedKeyGenerator.publicKey_X <== recipientPublicKeyX;
    sharedKeyGenerator.publicKey_Y <== recipientPublicKeyY;
    signal sharedKey <== sharedKeyGenerator.sharedKey;

    component pendingTransferOTKGenerator = OTKGenerator();
    pendingTransferOTKGenerator.key <== sharedKey;
    pendingTransferOTKGenerator.nonce <== pendingTransferNonce;
    pendingTransferOTKGenerator.chainId <== chainId;
    pendingTransferOTKGenerator.contractAddress <== contractAddress;
    signal pendingTransferOTK <== pendingTransferOTKGenerator.out;

    component pendingTransferCommitmentGenerator = CommitmentGenerator();
    pendingTransferCommitmentGenerator.amount <== pendingTransferAmount;
    pendingTransferCommitmentGenerator.otk <== pendingTransferOTK;
    pendingTransferCommitment === pendingTransferCommitmentGenerator.out;

    var newNonce = oldNonce + 1;
    var newAmount = oldAmount + pendingTransferAmount;

    component newStateGenerator = NewStateGenerator();
    newStateGenerator.key <== cPrivateKey;
    newStateGenerator.chainId <== chainId;
    newStateGenerator.contractAddress <== contractAddress;
    newStateGenerator.newAmount <== newAmount;
    newStateGenerator.newNonce <== newNonce;
    newCommitment <== newStateGenerator.newCommitment;
    eAmount <== newStateGenerator.newEncryptedAmount;
}

component main { public [chainId, contractAddress, oldNonce, oldCommitment, pendingTransferNonce, pendingTransferCommitment, recipientPublicKeyX, recipientPublicKeyY] } = Claim();