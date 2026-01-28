// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.28;

import {ConfidentialTransfers} from "./ConfidentialTransfers.sol";

import {Account, Payload, PendingTransfer, TransferParams, UpdateParams} from "./interface/IConfidentialTransfers.sol";
import {
    ClaimParams,
    FailedCrossChainTransfer,
    IConfidentialTransfersBridgeable
} from "./interface/IConfidentialTransfersBridgeable.sol";

import {PlonkVerifier as ClaimPlonkVerifier} from "./verifiers/ClaimPlonkVerifier.sol";

import {ArrayLib} from "./lib/ArrayLib.sol";

abstract contract ConfidentialTransfersBridgeable is ConfidentialTransfers, IConfidentialTransfersBridgeable {
    using ArrayLib for uint256[];
    using ArrayLib for FailedCrossChainTransfer[];

    /// @custom:storage-location erc7201:confidentialTransfersBridgeableClaimer
    struct ConfidentialTransfersBridgeableStorage {
        ClaimPlonkVerifier claimVerifier;
        mapping(address account => FailedCrossChainTransfer[]) failedCrossChainTransfers;
    }

    // keccak256(abi.encode(uint256(keccak256("ConfidentialTransfersBridgeableStorage")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant BRIDGEABLE_STORAGE = 0x7418b332d832c6a4f05d896925d27af0f7ce65c6ddf4b2f3da48139ec802cc00;

    function _getBridgeableStorage() internal pure returns (ConfidentialTransfersBridgeableStorage storage $) {
        assembly {
            $.slot := BRIDGEABLE_STORAGE
        }
    }

    function __ConfidentialTransfersBridgeable_init(ClaimPlonkVerifier claimVerifier) internal onlyInitializing {
        _getBridgeableStorage().claimVerifier = claimVerifier;
    }

    function cDeposit(UpdateParams calldata updateParams) public virtual override {
        super.cDeposit(updateParams);
        _cBurn(updateParams.amount);
    }

    function cWithdraw(UpdateParams calldata updateParams) public virtual override {
        _cMint(updateParams.amount);
        super.cWithdraw(updateParams);
    }

    /* INTERNAL */

    /**
     * @dev This function update sender's state and return the pending transfer to be bridged.
     * @dev Should be called by bridge sender function.
     */
    function _cSend(TransferParams calldata transferParams)
        internal
        returns (Payload memory newState, PendingTransfer memory pendingTransfer, bytes memory cMsg)
    {
        Payload memory pendingTransferPayload;

        (newState, pendingTransferPayload) = _transfer(transferParams);

        _getCStorage().accounts[msg.sender].state = newState;

        pendingTransfer = PendingTransfer(msg.sender, pendingTransferPayload, transferParams.transferAuditReports);

        cMsg = _encodeCMessage(transferParams.recipient, pendingTransfer, transferParams.extraData);

        emit CSent(
            msg.sender,
            transferParams.recipient,
            newState,
            pendingTransferPayload,
            transferParams.stateAuditReports,
            transferParams.transferAuditReports,
            transferParams.extraData
        );
    }

    function _encodeCMessage(address recipient, PendingTransfer memory pendingTransfer, bytes memory extraData)
        internal
        view
        returns (bytes memory cMsg)
    {
        Account storage account = _getCStorage().accounts[recipient];
        cMsg = abi.encode(recipient, account.pubKeyX, account.pubKeyY, pendingTransfer, extraData);
    }

    /**
     * @dev This function update receiver's pending transfers
     * @dev Should be called by bridge receiver function.
     */
    function _cReceive(bytes memory cMsg)
        internal
        returns (address recipient, PendingTransfer memory pendingTransfer, bytes memory extraData)
    {
        uint256 pubKeyX;
        uint256 pubKeyY;

        (recipient, pubKeyX, pubKeyY, pendingTransfer, extraData) = _decodeCMessage(cMsg);

        Account storage account = _getCStorage().accounts[recipient];

        bool success = account.pubKeyX == pubKeyX && account.pubKeyY == pubKeyY;

        if (success) {
            _getCStorage().accounts[recipient].pendingTransfers.push(pendingTransfer);
        } else {
            _getBridgeableStorage()
            .failedCrossChainTransfers[pendingTransfer.sender].push(
                FailedCrossChainTransfer(pubKeyX, pubKeyY, pendingTransfer)
            );
        }

        emit CReceived(
            success, pendingTransfer.sender, recipient, pendingTransfer.payload, pendingTransfer.auditReports, extraData
        );
    }

    function _decodeCMessage(bytes memory cMsg)
        internal
        pure
        returns (
            address recipient,
            uint256 pubKeyX,
            uint256 pubKeyY,
            PendingTransfer memory pendingTransfer,
            bytes memory extraData
        )
    {
        (recipient, pubKeyX, pubKeyY, pendingTransfer, extraData) = abi.decode(
            cMsg, (address, uint256, uint256, PendingTransfer, bytes)
        );
    }

    /**
     * @dev This function claims a failed cross-chain confidential transfer.
     * @dev Should be called by a pending transfer sender.
     * @param claimParams The parameters for the claim operation.
     */
    function cClaim(ClaimParams calldata claimParams)
        external
        onlyInitialized(msg.sender)
        checkRequiredAuditor(msg.sender, claimParams.stateAuditReports)
    {
        ConfidentialTransfersBridgeableStorage storage $ = _getBridgeableStorage();

        Payload memory newState = _claim(claimParams);

        Account storage account = _getCStorage().accounts[msg.sender];
        account.state = newState;
        account.auditReports = claimParams.stateAuditReports;

        $.failedCrossChainTransfers[msg.sender].remove(claimParams.indexToClaim);

        emit CFailedTransferClaimed(msg.sender, newState, account.auditReports);
    }

    function _claim(ClaimParams calldata params)
        internal
        view
        checkArrayLength(2, params.artifacts.outputs.length)
        returns (Payload memory newState)
    {
        FailedCrossChainTransfer storage failedTransfer = _getBridgeableStorage()
        .failedCrossChainTransfers[msg.sender][params.indexToClaim];

        Account storage account = _getCStorage().accounts[msg.sender];

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

        if (!_getBridgeableStorage().claimVerifier.verifyProof(proof, pubSignals)) revert ProofVerificationFailed();

        newState = Payload({nonce: account.state.nonce + 1, commitment: pubSignals[0], eAmount: pubSignals[1]});
    }

    function getFailedCrossChainTransfers(address sender) external view returns (FailedCrossChainTransfer[] memory) {
        return _getBridgeableStorage().failedCrossChainTransfers[sender];
    }

    /* VIRTUAL INTERNAL */

    function _cBurn(uint256 amount) internal virtual;

    function _cMint(uint256 amount) internal virtual;
}
