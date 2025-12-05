pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "./utils/BFGenerator.circom";
include "./utils/CommitmentGenerator.circom";
include "./utils/PoseidonStreamCipher.circom";
include "./utils/ECDH.circom";
include "circomlib/circuits/mux1.circom";
include "circomlib/circuits/comparators.circom";

template NewStateGenerator() {
    signal input cPrivateKey;
    signal input auditorPublicKey_X;
    signal input auditorPublicKey_Y;
    signal input newAmount;
    signal input newNonce;

    signal output newCommitment;
    signal output newBF;
    signal output newEncryptedAmount;
    signal output newEncryptedAmountForAuditor;

    component bfGenerator = BFGenerator();
    bfGenerator.cPrivateKey <== cPrivateKey;
    bfGenerator.nonce <== newNonce;
    newBF <== bfGenerator.out;

    component commitmentGenerator = CommitmentGenerator();
    commitmentGenerator.amount <== newAmount;
    commitmentGenerator.bf <== newBF;
    newCommitment <== commitmentGenerator.out;

    component encryption = PoseidonStreamCipher(1);
    encryption.key <== cPrivateKey;
    encryption.nonce <== newNonce;
    encryption.plaintext[0] <== newAmount;
    newEncryptedAmount <== encryption.ciphertext[0];

    component isAuditorZero = IsZero();
    isAuditorZero.in <== auditorPublicKey_X;
    isAuditorZero.out * auditorPublicKey_Y === 0;

    var Gx = 995203441582195749578291179787384436505546430278305826713579947235728471134;
    var Gy = 5472060717959818805561601436314318772137091100104008585924551046643952123905;

    // var Gx = 995203441582195749578291179787384436505546430278305826713579947235728471134;
    // var Gx = 995203441582195749578291179787384436505546430278305826713579947235728475954;
    // var Gy = 5472060717959818805561601436314318772137091100104008585924551046643952123905;
    // var Gy = 547206071795981880556160143631431877213709112579447375595162659328245525031;

    // If auditor is not zero (s=0), use auditorPublicKey_X.
    // If auditor is zero (s=1), use Gx.
    component muxAuditorX = Mux1();
    muxAuditorX.c[0] <== auditorPublicKey_X;
    muxAuditorX.c[1] <== Gx;
    muxAuditorX.s <== isAuditorZero.out;

    component muxAuditorY = Mux1();
    muxAuditorY.c[0] <== auditorPublicKey_Y;
    muxAuditorY.c[1] <== Gy;
    muxAuditorY.s <== isAuditorZero.out;

    component auditorSharedKeyGenerator = ECDH();
    auditorSharedKeyGenerator.privateKey <== cPrivateKey;
    auditorSharedKeyGenerator.publicKey_X <== muxAuditorX.out;
    auditorSharedKeyGenerator.publicKey_Y <== muxAuditorY.out;

    component auditorEncryption = PoseidonStreamCipher(1);
    auditorEncryption.key <== auditorSharedKeyGenerator.sharedKey[0];
    auditorEncryption.nonce <== newNonce;
    auditorEncryption.plaintext[0] <== newAmount;
    newEncryptedAmountForAuditor <== auditorEncryption.ciphertext[0] * (1 - isAuditorZero.out);
}