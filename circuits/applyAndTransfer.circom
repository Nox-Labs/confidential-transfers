pragma circom 2.0.0;

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/babyjub.circom";

include "./modules/utils/SharedKeyGenerator.circom";

include "./modules/OldStateChecker.circom";
include "./modules/NewStateGenerator.circom";

template ApplyAndTransfer(max) {
  // --- Private Inputs ---
  signal input cPrivateKey;
  signal input oldAmount;
  signal input transferAmount;
  signal input pendingTransfersAmounts[max];
  signal input pendingTransfersOTKs[max];

  // --- Public Inputs ---
  signal input oldNonce;
  signal input oldCommitment;
  signal input recipientPublicKey_X;
  signal input recipientPublicKey_Y;
  signal input n;
  signal input pendingTransfersCommitments[max];

  // --- Private Outputs ---
  signal output newCommitment;
  signal output eAmount;
  signal output transferCommitment;
  signal output transferEAmount;

  var newNonce = oldNonce + 1;        

  component oldStateChecker = OldStateChecker();
  oldStateChecker.key <== cPrivateKey;
  oldStateChecker.oldAmount <== oldAmount;
  oldStateChecker.oldNonce <== oldNonce;
  oldStateChecker.oldCommitment <== oldCommitment;

  component commitmentGenerators[max];
  component otkGenerator[max];
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
      commitmentGenerators[i].otk <== pendingTransfersOTKs[i];
      
      // Assertion:
      // If isLess[i].out == 0 (this is a fake transfer), the difference can be any.
      (pendingTransfersCommitments[i] - commitmentGenerators[i].out) * isLess[i].out === 0;

      // Add the sum only for real transfers
      intermediateAmount[i+1] <== intermediateAmount[i] + pendingTransfersAmounts[i] * isLess[i].out;
  }

  var tempAmount = intermediateAmount[max];

  // Assert enough balance
  component checkEnoughBalance = LessEqThan(252);
  checkEnoughBalance.in[0] <== transferAmount;
  checkEnoughBalance.in[1] <== tempAmount;
  checkEnoughBalance.out === 1;

  var newAmount = tempAmount - transferAmount;

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

component main { public [oldNonce, oldCommitment, recipientPublicKey_X, recipientPublicKey_Y, n, pendingTransfersCommitments] } = ApplyAndTransfer(10);