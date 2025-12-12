pragma circom 2.0.0;

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/babyjub.circom";

include "./utils/SharedKeyGenerator.circom";

include "./modules/OldStateChecker.circom";
include "./modules/NewStateGenerator.circom";

template Transfer() {
  // --- Private Inputs ---
  signal input cPrivateKey;
  signal input oldAmount;
  signal input transferAmount;

  // --- Public Inputs ---
  signal input oldNonce;
  signal input oldCommitment;
  signal input recipientPublicKey_X;
  signal input recipientPublicKey_Y;

  // --- Public Outputs ---
  signal output newCommitment;
  signal output eAmount;
  signal output transferCommitment;
  signal output transferEAmount;

  component oldStateChecker = OldStateChecker();
  oldStateChecker.key <== cPrivateKey;
  oldStateChecker.oldAmount <== oldAmount;
  oldStateChecker.oldNonce <== oldNonce;
  oldStateChecker.oldCommitment <== oldCommitment;  

  // Assert enough balance
  component checkEnoughBalance = LessEqThan(252);
  checkEnoughBalance.in[0] <== transferAmount;
  checkEnoughBalance.in[1] <== oldAmount;
  checkEnoughBalance.out === 1;

  var newNonce = oldNonce + 1;
  var newAmount = oldAmount - transferAmount;

  component newStateGenerator = NewStateGenerator();
  newStateGenerator.key <== cPrivateKey;
  newStateGenerator.newAmount <== newAmount;
  newStateGenerator.newNonce <== newNonce;
  newCommitment <== newStateGenerator.newCommitment;
  eAmount <== newStateGenerator.newEncryptedAmount;

  // Calculate shared key 
  component sharedKeyGenerator = SharedKeyGenerator();
  sharedKeyGenerator.privateKey <== cPrivateKey;
  sharedKeyGenerator.publicKey_X <== recipientPublicKey_X;
  sharedKeyGenerator.publicKey_Y <== recipientPublicKey_Y;
  signal sharedKey <== sharedKeyGenerator.sharedKey;

  component transferStateGenerator = NewStateGenerator();
  transferStateGenerator.key <== sharedKey;
  transferStateGenerator.newAmount <== transferAmount;
  transferStateGenerator.newNonce <== newNonce;
  transferCommitment <== transferStateGenerator.newCommitment;
  transferEAmount <== transferStateGenerator.newEncryptedAmount;
}

component main { public [oldNonce, oldCommitment, recipientPublicKey_X, recipientPublicKey_Y] } = Transfer();
