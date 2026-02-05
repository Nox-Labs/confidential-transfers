// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.28;

import {PlonkVerifier as ApplyAndTransferPlonkVerifier} from "../verifiers/ApplyAndTransferPlonkVerifier.sol";
import {PlonkVerifier as ApplyPlonkVerifier} from "../verifiers/ApplyPlonkVerifier.sol";
import {PlonkVerifier as InitPlonkVerifier} from "../verifiers/InitPlonkVerifier.sol";
import {PlonkVerifier as TransferPlonkVerifier} from "../verifiers/TransferPlonkVerifier.sol";
import {PlonkVerifier as UpdatePlonkVerifier} from "../verifiers/UpdatePlonkVerifier.sol";

import {
    Account,
    ApplyAndTransferParams,
    ApplyParams,
    InitParams,
    Payload,
    TransferParams,
    UpdateParams
} from "../interface/IConfidentialTransfers.sol";

import {ArrayLib} from "./ArrayLib.sol";

library ConfidentialTransfersZKVerificationLib {
    using ArrayLib for uint256[];

    uint8 constant MAX_PENDING_TRANSFERS_APPLY = 10;

    function cInit(InitPlonkVerifier initVerifier, InitParams calldata params)
        internal
        view
        checkArrayLength(4, params.artifacts.outputs.length)
        returns (Payload memory newState)
    {
        uint256[24] memory proof = params.artifacts.proof.toFixed24();
        uint256[6] memory pubSignals = [
            params.artifacts.outputs[0],
            params.artifacts.outputs[1],
            params.artifacts.outputs[2],
            params.artifacts.outputs[3],
            block.chainid,
            uint160(address(this))
        ];

        if (!initVerifier.verifyProof(proof, pubSignals)) revert ProofVerificationFailed();

        newState = Payload({nonce: 0, commitment: pubSignals[2], eAmount: pubSignals[3]});
    }

    function cUpdate(
        UpdatePlonkVerifier updateVerifier,
        UpdateParams calldata params,
        Account storage account,
        uint8 operation
    ) internal view checkArrayLength(2, params.artifacts.outputs.length) returns (Payload memory newState) {
        if (operation != 0 && operation != 1) revert InvalidUpdateOperation();

        uint256[24] memory proof = params.artifacts.proof.toFixed24();
        uint256[8] memory pubSignals = [
            params.artifacts.outputs[0],
            params.artifacts.outputs[1],
            block.chainid,
            uint160(address(this)),
            operation,
            params.amount,
            account.state.nonce,
            account.state.commitment
        ];

        if (!updateVerifier.verifyProof(proof, pubSignals)) revert ProofVerificationFailed();

        newState = Payload({nonce: account.state.nonce + 1, commitment: pubSignals[0], eAmount: pubSignals[1]});
    }

    function cTransfer(
        TransferPlonkVerifier transferVerifier,
        TransferParams calldata params,
        Account storage account,
        Account storage recipientAccount
    )
        internal
        view
        checkArrayLength(4, params.artifacts.outputs.length)
        returns (Payload memory newState, Payload memory pendingTransferPackage)
    {
        uint256[24] memory proof = params.artifacts.proof.toFixed24();
        uint256[10] memory pubSignals = [
            params.artifacts.outputs[0],
            params.artifacts.outputs[1],
            params.artifacts.outputs[2],
            params.artifacts.outputs[3],
            block.chainid,
            uint160(address(this)),
            account.state.nonce,
            account.state.commitment,
            recipientAccount.pubKeyX,
            recipientAccount.pubKeyY
        ];

        if (!transferVerifier.verifyProof(proof, pubSignals)) revert ProofVerificationFailed();

        newState = Payload({nonce: account.state.nonce + 1, commitment: pubSignals[0], eAmount: pubSignals[1]});

        pendingTransferPackage =
            Payload({nonce: account.state.nonce + 1, commitment: pubSignals[2], eAmount: pubSignals[3]});
    }

    function cApply(ApplyPlonkVerifier applyVerifier, ApplyParams calldata params, Account storage account)
        internal
        view
        checkArrayLength(2, params.artifacts.outputs.length)
        checkApplyingPendingTransfersIndexes(account, params.pendingTransfersIndexes.length)
        returns (Payload memory newState)
    {
        uint256 n = params.pendingTransfersIndexes.length;
        uint256 maxIndex = account.pendingTransfers.length;

        uint256[7 + MAX_PENDING_TRANSFERS_APPLY] memory pubSignals;
        pubSignals[0] = params.artifacts.outputs[0];
        pubSignals[1] = params.artifacts.outputs[1];
        pubSignals[2] = block.chainid;
        pubSignals[3] = uint160(address(this));
        pubSignals[4] = n;
        pubSignals[5] = account.state.nonce;
        pubSignals[6] = account.state.commitment;

        // Loop through the maximum possible pending transfers (fixed circuit size).
        // If the index 'i' is less than the number of transfers to apply 'n', we include the commitment.
        // Otherwise, we pad with 0 to match the circuit's expected input size.
        for (uint256 i = 0; i < MAX_PENDING_TRANSFERS_APPLY; i++) {
            if (i < n) {
                uint256 targetIndex = params.pendingTransfersIndexes[i];
                if (targetIndex >= maxIndex) revert InvalidPendingTransfersIndexes();
                pubSignals[7 + i] = uint256(account.pendingTransfers[targetIndex].payload.commitment);
            } else {
                pubSignals[7 + i] = 0;
            }
        }
        uint256[24] memory proof = params.artifacts.proof.toFixed24();

        if (!applyVerifier.verifyProof(proof, pubSignals)) revert ProofVerificationFailed();

        newState = Payload({nonce: account.state.nonce + 1, commitment: pubSignals[0], eAmount: pubSignals[1]});
    }

    function cApplyAndTransfer(
        ApplyAndTransferPlonkVerifier applyAndTransferVerifier,
        ApplyAndTransferParams calldata params,
        Account storage account,
        Account storage recipientAccount
    )
        internal
        view
        checkArrayLength(4, params.artifacts.outputs.length)
        checkApplyingPendingTransfersIndexes(account, params.pendingTransfersIndexes.length)
        returns (Payload memory newState, Payload memory pendingTransfer)
    {
        uint256 n = params.pendingTransfersIndexes.length;
        uint256 maxIndex = account.pendingTransfers.length;

        uint256[24] memory proof = params.artifacts.proof.toFixed24();
        uint256[11 + MAX_PENDING_TRANSFERS_APPLY] memory pubSignals;
        pubSignals[0] = params.artifacts.outputs[0];
        pubSignals[1] = params.artifacts.outputs[1];
        pubSignals[2] = params.artifacts.outputs[2];
        pubSignals[3] = params.artifacts.outputs[3];
        pubSignals[4] = block.chainid;
        pubSignals[5] = uint160(address(this));
        pubSignals[6] = account.state.nonce;
        pubSignals[7] = account.state.commitment;
        pubSignals[8] = recipientAccount.pubKeyX;
        pubSignals[9] = recipientAccount.pubKeyY;
        pubSignals[10] = n;

        for (uint256 i = 0; i < MAX_PENDING_TRANSFERS_APPLY; i++) {
            if (i < n) {
                uint256 targetIndex = params.pendingTransfersIndexes[i];
                if (targetIndex >= maxIndex) revert InvalidPendingTransfersIndexes();
                pubSignals[11 + i] = uint256(account.pendingTransfers[targetIndex].payload.commitment);
            } else {
                pubSignals[11 + i] = 0;
            }
        }

        if (!applyAndTransferVerifier.verifyProof(proof, pubSignals)) revert ProofVerificationFailed();

        newState = Payload({nonce: account.state.nonce + 1, commitment: pubSignals[0], eAmount: pubSignals[1]});
        pendingTransfer = Payload({nonce: account.state.nonce + 1, commitment: pubSignals[2], eAmount: pubSignals[3]});
    }

    /* MODIFIERS */

    modifier checkArrayLength(uint256 expected, uint256 actual) {
        if (actual != expected) revert InvalidArrayLength(expected, actual);
        _;
    }

    modifier checkApplyingPendingTransfersIndexes(Account storage account, uint256 n) {
        if (n > account.pendingTransfers.length || n == 0) revert InvalidPendingTransfersIndexes();
        _;
    }

    /* ERRORS */

    error InvalidArrayLength(uint256 expected, uint256 actual);
    error ProofVerificationFailed();
    error InvalidUpdateOperation();
    error InvalidPendingTransfersIndexes();
}
