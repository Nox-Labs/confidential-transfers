// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.28;

struct Payload {
    uint256 nonce;
    uint256 commitment;
    uint256 eAmount; // Encrypted amount
}

struct PendingTransfer {
    address sender;
    Payload payload;
    AuditReport[] auditReports;
}

struct Account {
    uint256 pubKeyX;
    uint256 pubKeyY;
    Payload state;
    address[] requiredAuditors;
    AuditReport[] auditReports;
    PendingTransfer[] pendingTransfers;
}

struct ZKArtifacts {
    uint256[] proof;
    uint256[] outputs;
}

struct AuditReport {
    address auditor;
    uint256 eOTK; // Encrypted One-Time Key
}

struct InitParams {
    /**
     * @dev artifacts.output should be = [cPublicKeyX, cPublicKeyY, newCommitment, eAmount]
     * @dev verifier.pubSignals waiting for = [cPublicKeyX, cPublicKeyY, newCommitment, eAmount, chainId, contractAddress]
     */
    ZKArtifacts artifacts;
    AuditReport[] stateAuditReports;
}

struct UpdateParams {
    /**
     * @dev artifacts.output should be = [newCommitment, eAmount]
     * @dev verifier.pubSignals waiting for = [newCommitment, eAmount, chainId, contractAddress, operation, amount, oldNonce, oldCommitment]
     */
    ZKArtifacts artifacts;
    uint256 amount;
    AuditReport[] stateAuditReports;
}

struct TransferParams {
    /**
     * @dev artifacts.output should be = [newCommitment, eAmount, transferCommitment, transferEAmount]
     * @dev verifier.pubSignals waiting for = [newCommitment, eAmount, transferCommitment, transferEAmount, chainId, contractAddress, oldNonce, oldCommitment, recipientPublicKeyX, recipientPublicKeyY]
     */
    ZKArtifacts artifacts;
    address recipient;
    AuditReport[] stateAuditReports;
    AuditReport[] transferAuditReports;
    bytes extraData;
}

struct ApplyParams {
    /**
     * @dev artifacts.output should be = [newCommitment, eAmount]
     * @dev verifier.pubSignals waiting for = [newCommitment, eAmount, chainId, contractAddress, n, oldNonce, oldCommitment, ...pendingTransfersCommitments[max]]
     */
    ZKArtifacts artifacts;
    uint256[] pendingTransfersIndexes;
    AuditReport[] stateAuditReports;
}

struct ApplyAndTransferParams {
    /**
     * @dev artifacts.output should be = [newCommitment, eAmount, transferCommitment, transferEAmount]
     * @dev verifier.pubSignals waiting for = [newCommitment, eAmount, transferCommitment, transferEAmount, chainId, contractAddress, oldNonce, oldCommitment, recipientPublicKeyX, recipientPublicKeyY, n, ...pendingTransfersCommitments[max]]
     */
    ZKArtifacts artifacts;
    address recipient;
    uint256[] pendingTransfersIndexes;
    AuditReport[] stateAuditReports;
    AuditReport[] transferAuditReports;
    bytes extraData;
}

interface IConfidentialTransfers {
    function cInit(InitParams calldata initParams) external;
    function cApply(ApplyParams calldata applyParams) external;
    function cDeposit(UpdateParams calldata updateParams) external;
    function cWithdraw(UpdateParams calldata updateParams) external;
    function cTransfer(TransferParams calldata transferParams) external;
    function cApplyAndTransfer(ApplyAndTransferParams calldata applyAndTransferParams) external;

    function addRequiredAuditor(address auditor) external;
    function removeRequiredAuditor(address auditor) external;

    event CInitialized(
        address indexed account, uint256 pubKeyX, uint256 pubKeyY, Payload newState, AuditReport[] auditReports
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
        AuditReport[] transferAuditReports,
        bytes extraData
    );

    event RequiredAuditorAdded(address indexed account, address indexed auditor);
    event RequiredAuditorRemoved(address indexed account, address indexed auditor);

    error ProofVerificationFailed();
    error InvalidArrayLength(uint256 expected, uint256 actual);
    error AccountNotInitialized();
    error AccountAlreadyInitialized();
    error InvalidPendingTransfersIndexes();
    error MaxPendingTransfersReached();
}
