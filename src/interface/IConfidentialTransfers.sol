// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.28;

struct Payload {
    uint256 nonce;
    uint256 commitment;
    uint256 eAmount;
}

struct PendingTransfer {
    address sender;
    Payload payload;
    AuditReport[] auditReports;
}

struct Account {
    uint256 pubKey_X;
    uint256 pubKey_Y;
    Payload state;
    AuditReport[] auditReports;
    PendingTransfer[] pendingTransfers;
}

struct ZKArtifacts {
    uint256[] proof;
    uint256[] outputs;
}

struct AuditReport {
    address auditor;
    uint256 encryptedOTK;
}

struct InitParams {
    AuditReport[] stateAuditReports;
    /**
     * @dev artifacts.output should be = [cPublicKey_X, cPublicKey_Y, newCommitment, eAmount]
     * @dev verifier.pubSignals waiting for = [cPublicKey_X, cPublicKey_Y, newCommitment, eAmount]
     */
    ZKArtifacts artifacts;
}

struct UpdateParams {
    uint256 amount;
    AuditReport[] stateAuditReports;
    /**
     * @dev artifacts.output should be = [newCommitment, eAmount]
     * @dev verifier.pubSignals waiting for = [newCommitment, eAmount, operation, amount, oldNonce, oldCommitment]
     */
    ZKArtifacts artifacts;
}

struct TransferParams {
    address recipient;
    AuditReport[] stateAuditReports;
    AuditReport[] transferAuditReports;
    /**
     * @dev artifacts.output should be = [newCommitment, eAmount, transferCommitment, transferEAmount]
     * @dev verifier.pubSignals waiting for = [newCommitment, eAmount, transferCommitment, transferEAmount, oldNonce, oldCommitment, recipientPublicKey_X, recipientPublicKey_Y]
     */
    ZKArtifacts artifacts;
}

struct ApplyParams {
    uint256[] pendingTransfersIndexes;
    AuditReport[] stateAuditReports;
    /**
     * @dev artifacts.output should be = [newCommitment, eAmount]
     * @dev verifier.pubSignals waiting for = [newCommitment, eAmount, n, oldNonce, oldCommitment, ...pendingTransfersCommitments[max]]
     */
    ZKArtifacts artifacts;
}

struct ApplyAndTransferParams {
    address recipient;
    uint256[] pendingTransfersIndexes;
    AuditReport[] stateAuditReports;
    AuditReport[] transferAuditReports;
    /**
     * @dev artifacts.output should be = [newCommitment, eAmount, transferCommitment, transferEAmount]
     * @dev verifier.pubSignals waiting for = [newCommitment, eAmount, transferCommitment, transferEAmount, oldNonce, oldCommitment, recipientPublicKey_X, recipientPublicKey_Y, n, ...pendingTransfersCommitments[max]]
     */
    ZKArtifacts artifacts;
}

interface IConfidentialTransfers {
    function cInit(InitParams calldata initParams) external;
    function cApply(ApplyParams calldata applyParams) external;
    function cDeposit(UpdateParams calldata updateParams) external;
    function cWithdraw(UpdateParams calldata updateParams) external;
    function cTransfer(TransferParams calldata transferParams) external;
    function cApplyAndTransfer(ApplyAndTransferParams calldata applyAndTransferParams) external;

    event CInitialized(
        address indexed account, uint256 pubKey_X, uint256 pubKey_Y, Payload newState, AuditReport[] auditReports
    );
    event CDeposited(address indexed account, uint256 amount, Payload newState, AuditReport[] auditReports);
    event CWithdrawn(address indexed account, uint256 amount, Payload newState, AuditReport[] auditReports);
    event CApplied(address indexed account, Payload newState, AuditReport[] auditReports);
    event CTransferred(
        address indexed sender,
        address indexed recipient,
        Payload newState,
        Payload transferPayload,
        AuditReport[] auditReports,
        AuditReport[] transferAuditReports
    );

    error ProofVerificationFailed();
    error InvalidArrayLength(uint256 expected, uint256 actual);
    error VerifierCallFailed();
    error AccountNotInitialized();
    error AccountAlreadyInitialized();
    error InvalidPendingTransfersIndexes();
    error MaxPendingTransfersReached();
}
