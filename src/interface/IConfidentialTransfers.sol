// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.28;

struct ZKArtifacts {
    uint256[] proof;
    uint256[] outputs;
}

struct InitParams {
    /**
     * @dev artifacts.output should be = [cPublicKey_X, cPublicKey_Y, newCommitment, eAmount, eAmountForAuditor]
     * @dev verifier.pubSignals waiting for = [cPublicKey_X, cPublicKey_Y, newCommitment, eAmount, eAmountForAuditor, auditorPublicKey_X, auditorPublicKey_Y]
     */
    ZKArtifacts artifacts;
}

struct ApplyParams {
    uint256[] pendingTransfersIndexes;
    /**
     * @dev artifacts.output should be = [newCommitment, eAmount, eAmountForAuditor]
     * @dev verifier.pubSignals waiting for = [newCommitment, eAmount, eAmountForAuditor, auditorPublicKey_X, auditorPublicKey_Y, n, oldNonce, oldCommitment, ...pendingTransfersCommitments[max]]
     */
    ZKArtifacts artifacts;
}

struct UpdateParams {
    uint256 amount;
    /**
     * @dev artifacts.output should be = [newCommitment, eAmount, eAmountForAuditor]
     * @dev verifier.pubSignals waiting for = [newCommitment, eAmount, eAmountForAuditor, auditorPublicKey_X, auditorPublicKey_Y, operation, amount, oldNonce, oldCommitment]
     */
    ZKArtifacts artifacts;
}

struct TransferParams {
    address recipient;
    /**
     * @dev artifacts.output should be = [newCommitment, eAmount, eAmountForAuditor, transferCommitment, transferEAmount, transferEAmountForAuditor]
     * @dev verifier.pubSignals waiting for = [newCommitment, eAmount, eAmountForAuditor, transferCommitment, transferEAmount, transferEAmountForAuditor, auditorPublicKey_X, auditorPublicKey_Y, oldNonce, oldCommitment, recipientPublicKey_X, recipientPublicKey_Y]
     */
    ZKArtifacts artifacts;
}

struct ApplyAndTransferParams {
    address recipient;
    uint256[] pendingTransfersIndexes;
    /**
     * @dev artifacts.output should be = [newCommitment, eAmount, eAmountForAuditor, transferCommitment, transferEAmount, transferEAmountForAuditor]
     * @dev verifier.pubSignals waiting for = [newCommitment, eAmount, eAmountForAuditor, transferCommitment, transferEAmount, transferEAmountForAuditor, auditorPublicKey_X, auditorPublicKey_Y, oldNonce, oldCommitment, recipientPublicKey_X, recipientPublicKey_Y, n, ...pendingTransfersCommitments[max]]
     */
    ZKArtifacts artifacts;
}

struct Package {
    uint256 nonce;
    uint256 pubKey_X;
    uint256 pubKey_Y;
    uint256 commitment;
    uint256 eAmount; // encrypted amount to be able to recover state any time
    uint256 eAmountForAuditor; // encrypted amount to be able to recover state any time
}

struct Account {
    Package state;
    Package[] pendingTransfers;
}

interface IConfidentialTransfers {
    function cInit(InitParams calldata initParams) external;
    function cApply(ApplyParams calldata applyParams) external;
    function cDeposit(UpdateParams calldata updateParams) external;
    function cWithdraw(UpdateParams calldata updateParams) external;
    function cTransfer(TransferParams calldata transferParams) external;

    error ProofVerificationFailed();
    error InvalidArrayLength(uint256 expected, uint256 actual);
    error VerifierCallFailed();
    error AccountNotInitialized();
    error AccountAlreadyInitialized();
    error InvalidPendingTransfersIndexes();
    error MaxPendingTransfersReached();
}
