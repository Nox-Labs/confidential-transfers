pragma circom 2.0.0;

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/babyjub.circom";

include "./modules/utils/ECDH.circom";

include "./modules/OldStateChecker.circom";
include "./modules/NewStateGenerator.circom";

template Transfer() {
  // --- Private Inputs ---
  signal input cPrivateKey;
  signal input oldAmount;
  signal input transferAmount;

  // --- Public Inputs ---
  signal input auditorPublicKey_X;
  signal input auditorPublicKey_Y;
  signal input oldNonce;
  signal input oldCommitment;
  signal input recipientPublicKey_X;
  signal input recipientPublicKey_Y;

  // --- Public Outputs ---
  signal output newCommitment;
  signal output eAmount;
  signal output eAmountForAuditor;
  signal output transferCommitment;
  signal output transferEAmount;
  signal output transferEAmountForAuditor;

  component oldStateChecker = OldStateChecker();
  oldStateChecker.cPrivateKey <== cPrivateKey;
  oldStateChecker.oldAmount <== oldAmount;
  oldStateChecker.oldNonce <== oldNonce;
  oldStateChecker.oldCommitment <== oldCommitment;
  oldStateChecker.isValid === 1;

  // Assert enough balance
  component checkEnoughBalance = LessEqThan(252);
  checkEnoughBalance.in[0] <== transferAmount;
  checkEnoughBalance.in[1] <== oldAmount;
  checkEnoughBalance.out === 1;

  var newNonce = oldNonce + 1;
  var newAmount = oldAmount - transferAmount;

  component newStateGenerator = NewStateGenerator();
  newStateGenerator.cPrivateKey <== cPrivateKey;
  newStateGenerator.auditorPublicKey_X <== auditorPublicKey_X;
  newStateGenerator.auditorPublicKey_Y <== auditorPublicKey_Y;
  newStateGenerator.newAmount <== newAmount;
  newStateGenerator.newNonce <== newNonce;
  newCommitment <== newStateGenerator.newCommitment;
  eAmount <== newStateGenerator.newEncryptedAmount;
  eAmountForAuditor <== newStateGenerator.newEncryptedAmountForAuditor;

  // Calculate shared key 
  component sharedKeyGenerator = ECDH();
  sharedKeyGenerator.privateKey <== cPrivateKey;
  sharedKeyGenerator.publicKey_X <== recipientPublicKey_X;
  sharedKeyGenerator.publicKey_Y <== recipientPublicKey_Y;
  signal sharedKey[2] <== sharedKeyGenerator.sharedKey;

  component transferStateGenerator = NewStateGenerator();
  transferStateGenerator.cPrivateKey <== sharedKey[0];
  transferStateGenerator.auditorPublicKey_X <== auditorPublicKey_X;
  transferStateGenerator.auditorPublicKey_Y <== auditorPublicKey_Y;
  transferStateGenerator.newAmount <== transferAmount;
  transferStateGenerator.newNonce <== newNonce;
  transferCommitment <== transferStateGenerator.newCommitment;
  transferEAmount <== transferStateGenerator.newEncryptedAmount;
  transferEAmountForAuditor <== transferStateGenerator.newEncryptedAmountForAuditor;
}

component main { public [auditorPublicKey_X, auditorPublicKey_Y, oldNonce, oldCommitment, recipientPublicKey_X, recipientPublicKey_Y] } = Transfer();
