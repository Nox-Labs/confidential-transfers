pragma circom 2.0.0;

include "circomlib/circuits/comparators.circom";

include "./modules/OldStateChecker.circom";
include "./modules/NewStateGenerator.circom";

/**
 * @title Update
 * @notice Handles deposits (public -> confidential) and withdrawals (confidential -> public).
 * @dev Validates the operation type (0=Deposit, 1=Withdraw).
 *      For withdrawals, ensures the user has sufficient confidential balance.
 *      Updates the user's confidential state (amount and nonce).
 */
template Update() {
    // --- Private Inputs ---
    signal input cPrivateKey;
    signal input oldAmount;

    // --- Public Inputs ---
    signal input chainId;
    signal input contractAddress;
    signal input operation; // 0 for deposit, 1 for withdraw // TODO: validate underflow 
    signal input amount;
    signal input oldNonce;
    signal input oldCommitment;

    // --- Public Outputs ---
    signal output newCommitment;
    signal output eAmount;

    // Assert the operation is valid.
    operation * (operation - 1) === 0;

    // Assert the amount is within the range.
    component rangeCheck = LessEqThan(252); 
    rangeCheck.in[0] <== amount;
    rangeCheck.in[1] <== oldAmount;
    signal checkRange <== rangeCheck.out;

    // Our condition: `operation` should be 0 OR (`operation`=1 AND `checkRange`=1)
    // This can be expressed as: `operation * (1 - checkRange) === 0`
    // If operation=0, then 0 * (anything) = 0. -> OK
    // If operation=1, then 1 * (1 - checkRange) === 0, which requires checkRange=1. -> OK
    operation * (1 - checkRange) === 0;

    component oldStateChecker = OldStateChecker();
    oldStateChecker.key <== cPrivateKey;
    oldStateChecker.chainId <== chainId;
    oldStateChecker.contractAddress <== contractAddress;
    oldStateChecker.oldAmount <== oldAmount;
    oldStateChecker.oldNonce <== oldNonce;
    oldStateChecker.oldCommitment <== oldCommitment;

    // Calculate the new confidential amount based on operation type:
    // If operation = 0 (Deposit): newAmount = oldAmount + amount
    // If operation = 1 (Withdraw): newAmount = oldAmount - amount
    // Formula: oldAmount + (1 - 2*operation) * amount
    var newNonce = oldNonce + 1;
    var newAmount = oldAmount + (1 - 2*operation) * amount;

    component newStateGenerator = NewStateGenerator();
    newStateGenerator.key <== cPrivateKey;
    newStateGenerator.chainId <== chainId;
    newStateGenerator.contractAddress <== contractAddress;
    newStateGenerator.newAmount <== newAmount;
    newStateGenerator.newNonce <== newNonce;
    newCommitment <== newStateGenerator.newCommitment;
    eAmount <== newStateGenerator.newEncryptedAmount;
}

component main {public [chainId, contractAddress, operation, amount, oldNonce, oldCommitment]} = Update();