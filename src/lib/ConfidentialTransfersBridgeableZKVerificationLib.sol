// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.28;

import {PlonkVerifier as ClaimPlonkVerifier} from "../verifiers/ClaimPlonkVerifier.sol";

import {Account, Payload} from "../interface/IConfidentialTransfers.sol";
import {ClaimParams, FailedCrossChainTransfer} from "../interface/IConfidentialTransfersBridgeable.sol";

import {ArrayLib} from "./ArrayLib.sol";
import {ConfidentialTransfersZKVerificationLib} from "./ConfidentialTransfersZKVerificationLib.sol";

library ConfidentialTransfersBridgeableZKVerificationLib {
    using ArrayLib for uint256[];

    /**
     * @notice Internal logic for claiming a failed transfer
     * @dev Verifies proof and generates new state
     * @param params Claim parameters
     * @return newState New state of the sender
     */
    function cClaim(
        ClaimPlonkVerifier claimVerifier,
        ClaimParams calldata params,
        Account storage account,
        FailedCrossChainTransfer storage failedTransfer
    ) internal view checkArrayLength(2, params.artifacts.outputs.length) returns (Payload memory newState) {
        uint256[24] memory proof = params.artifacts.proof.toFixed24();
        uint256[10] memory pubSignals = [
            params.artifacts.outputs[0],
            params.artifacts.outputs[1],
            block.chainid,
            uint160(address(this)),
            account.state.nonce,
            account.state.commitment,
            failedTransfer.pendingTransfer.payload.nonce,
            failedTransfer.pendingTransfer.payload.commitment,
            failedTransfer.recipientPubKeyX,
            failedTransfer.recipientPubKeyY
        ];

        if (!claimVerifier.verifyProof(proof, pubSignals)) {
            revert ConfidentialTransfersZKVerificationLib.ProofVerificationFailed();
        }

        newState = Payload({nonce: account.state.nonce + 1, commitment: pubSignals[0], eAmount: pubSignals[1]});
    }

    /* MODIFIERS */

    modifier checkArrayLength(uint256 expected, uint256 actual) {
        if (actual != expected) revert ConfidentialTransfersZKVerificationLib.InvalidArrayLength(expected, actual);
        _;
    }
}
