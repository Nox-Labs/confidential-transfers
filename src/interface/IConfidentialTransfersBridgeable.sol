// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.28;

import {AuditReport, Payload, PendingTransfer, ZKArtifacts} from "./IConfidentialTransfers.sol";

struct ClaimParams {
    /**
     * @dev artifacts.output should be = [newCommitment, eAmount]
     * @dev verifier.pubSignals waiting for = [newCommitment, eAmount, chainId, contractAddress, oldNonce, oldCommitment, pendingTransferNonce, pendingTransferCommitment, recipientPublicKeyX, recipientPublicKeyY]
     */
    ZKArtifacts artifacts;
    uint256 indexToClaim;
    AuditReport[] stateAuditReports;
}

struct FailedCrossChainTransfer {
    uint256 recipientPubKeyX;
    uint256 recipientPubKeyY;
    PendingTransfer pendingTransfer;
}

interface IConfidentialTransfersBridgeable {
    function cClaim(ClaimParams calldata claimParams) external;

    event CFailedTransferClaimed(address indexed account, Payload newState, AuditReport[] auditReports);
    event CSent(
        address indexed sender,
        address indexed recipient,
        Payload newState,
        Payload pendingTransferPayload,
        AuditReport[] stateAuditReports,
        AuditReport[] transferAuditReports,
        bytes extraData
    );
    event CReceived(
        bool success,
        address indexed sender,
        address indexed recipient,
        Payload pendingTransferPayload,
        AuditReport[] transferAuditReports,
        bytes extraData
    );
}
