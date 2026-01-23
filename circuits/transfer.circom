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
  signal input chainId;
  signal input contractAddress;
  signal input oldNonce;
  signal input oldCommitment;
  signal input recipientPublicKeyX;
  signal input recipientPublicKeyY;

  // --- Public Outputs ---
  signal output newCommitment;
  signal output eAmount;
  signal output transferCommitment;
  signal output transferEAmount;

  component oldStateChecker = OldStateChecker();
  oldStateChecker.key <== cPrivateKey;
  oldStateChecker.chainId <== chainId;
  oldStateChecker.contractAddress <== contractAddress;
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
  newStateGenerator.chainId <== chainId;
  newStateGenerator.contractAddress <== contractAddress;
  newStateGenerator.newAmount <== newAmount;
  newStateGenerator.newNonce <== newNonce;
  newCommitment <== newStateGenerator.newCommitment;
  eAmount <== newStateGenerator.newEncryptedAmount;

  // Calculate shared key 
  component sharedKeyGenerator = SharedKeyGenerator();
  sharedKeyGenerator.privateKey <== cPrivateKey;
  sharedKeyGenerator.publicKey_X <== recipientPublicKeyX;
  sharedKeyGenerator.publicKey_Y <== recipientPublicKeyY;
  signal sharedKey <== sharedKeyGenerator.sharedKey;

  // TODO: Could be collision if sender and recipient make transfer to each other at the same nonce
  component transferStateGenerator = NewStateGenerator();
  transferStateGenerator.key <== sharedKey;
  transferStateGenerator.chainId <== chainId;
  transferStateGenerator.contractAddress <== contractAddress;
  transferStateGenerator.newAmount <== transferAmount;
  transferStateGenerator.newNonce <== newNonce;
  transferCommitment <== transferStateGenerator.newCommitment;
  transferEAmount <== transferStateGenerator.newEncryptedAmount;
}

component main { public [chainId, contractAddress, oldNonce, oldCommitment, recipientPublicKeyX, recipientPublicKeyY] } = Transfer();
