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

/**
 * @title ConfidentialTransfersBridgeable
 * @notice Extension of ConfidentialTransfers supporting cross-chain confidential transfers.
 * @dev Implements logic for encoding/decoding cross-chain messages and handling failed transfers (claims).
 *      Designed to work with a bridge adapter (like LayerZero OFT).
 */
abstract contract ConfidentialTransfersBridgeable is ConfidentialTransfers, IConfidentialTransfersBridgeable {
    using ArrayLib for uint256[];
    using ArrayLib for FailedCrossChainTransfer[];

    /// @custom:storage-location erc7201:confidentialTransfersBridgeableC
    struct ConfidentialTransfersBridgeableStorage {
        ClaimPlonkVerifier claimVerifier;
        mapping(address account => FailedCrossChainTransfer[]) failedCrossChainTransfers;
    }

    // keccak256(abi.encode(uint256(keccak256("ConfidentialTransfersBridgeableStorage")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant BRIDGEABLE_STORAGE = 0x7418b332d832c6a4f05d896925d27af0f7ce65c6ddf4b2f3da48139ec802cc00;

    function _getCStorageBridgeable() internal pure returns (ConfidentialTransfersBridgeableStorage storage $) {
        assembly {
            $.slot := BRIDGEABLE_STORAGE
        }
    }

    /**
     * @notice Initializes the bridgeable contract
     * @dev Must be called in the constructor/initializer of the contract.
     * @param claimVerifier Verifier for claiming failed transfers
     */
    function __ConfidentialTransfersBridgeable_init(ClaimPlonkVerifier claimVerifier) internal onlyInitializing {
        _getCStorageBridgeable().claimVerifier = claimVerifier;
    }

    /**
     * @notice Deposits tokens and burns them from the bridgeable contract
     * @notice Burning tokens makes confidential transfers tokens bridgeable
     * @dev Extends cDeposit to burn the deposited amount (locking it in the bridge)
     * @param updateParams Deposit parameters
     */
    function cDeposit(UpdateParams calldata updateParams) public virtual override {
        super.cDeposit(updateParams);
        _cBurn(updateParams.amount);
    }

    /**
     * @notice Withdraws tokens by minting them back to the contract
     * @dev Extends cWithdraw to mint the withdrawn amount
     * @param updateParams Withdraw parameters
     */
    function cWithdraw(UpdateParams calldata updateParams) public virtual override {
        _cMint(updateParams.amount);
        super.cWithdraw(updateParams);
    }

    /* INTERNAL */

    /**
     * @notice Updates sender state and prepares a pending transfer for bridging
     * @dev Called by the bridge sender function to generate the cross-chain message
     * @param transferParams Parameters for the transfer
     * @return newState New state of the sender
     * @return pendingTransfer The transfer object to be bridged
     * @return cMsg Encoded cross-chain message
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

    /**
     * @notice Encodes the confidential transfer message for cross-chain transport
     * @param recipient Address of the recipient
     * @param pendingTransfer The transfer object
     * @param extraData Additional data
     * @return cMsg Encoded bytes
     */
    function _encodeCMessage(address recipient, PendingTransfer memory pendingTransfer, bytes memory extraData)
        internal
        view
        returns (bytes memory cMsg)
    {
        Account storage account = _getCStorage().accounts[recipient];
        cMsg = abi.encode(recipient, account.pubKeyX, account.pubKeyY, pendingTransfer, extraData);
    }

    /**
     * @notice Processes a received cross-chain confidential message
     * @dev Called by the bridge receiver function to apply the transfer or store as failed
     * @param cMsg Encoded cross-chain message
     * @return recipient Address of the recipient
     * @return pendingTransfer The transfer object
     * @return extraData Additional data for bridging or identification purposes
     */
    function _cReceive(bytes memory cMsg)
        internal
        returns (address recipient, PendingTransfer memory pendingTransfer, bytes memory extraData)
    {
        uint256 pubKeyX;
        uint256 pubKeyY;

        (recipient, pubKeyX, pubKeyY, pendingTransfer, extraData) = _decodeCMessage(cMsg);

        Account storage account = _getCStorage().accounts[recipient];

        // Check if the recipient's public key in the message matches the one registered on-chain.
        // This prevents sending funds to an address that doesn't match the intended recipient.
        bool success = account.pubKeyX == pubKeyX && account.pubKeyY == pubKeyY;

        if (success) {
            // Happy path: Recipient keys match. Add to their pending transfers queue.
            _getCStorage().accounts[recipient].pendingTransfers.push(pendingTransfer);
        } else {
            // Failure path: Keys mismatch
            // Store in 'failedCrossChainTransfers' mapped to the SENDER.
            // This allows the original sender to claim the funds back using 'cClaim'.
            _getCStorageBridgeable()
            .failedCrossChainTransfers[pendingTransfer.sender].push(
                FailedCrossChainTransfer(pubKeyX, pubKeyY, pendingTransfer)
            );
        }

        emit CReceived(
            success, pendingTransfer.sender, recipient, pendingTransfer.payload, pendingTransfer.auditReports, extraData
        );
    }

    /**
     * @notice Decodes the confidential transfer message
     * @param cMsg Encoded bytes
     * @return recipient Address of the recipient
     * @return pubKeyX Public key X coordinate
     * @return pubKeyY Public key Y coordinate
     * @return pendingTransfer The transfer object
     * @return extraData Additional data
     */
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
     * @notice Claims a failed cross-chain confidential transfer
     * @dev Allows the sender to recover funds if the bridge transfer failed
     * @param claimParams Parameters for the claim operation
     */
    function cClaim(ClaimParams calldata claimParams)
        external
        onlyInitialized(msg.sender)
        checkRequiredAuditor(msg.sender, claimParams.stateAuditReports)
    {
        ConfidentialTransfersBridgeableStorage storage $ = _getCStorageBridgeable();

        Payload memory newState = _claim(claimParams);

        Account storage account = _getCStorage().accounts[msg.sender];
        account.state = newState;
        account.auditReports = claimParams.stateAuditReports;

        $.failedCrossChainTransfers[msg.sender].remove(claimParams.indexToClaim);

        emit CFailedTransferClaimed(msg.sender, newState, account.auditReports);
    }

    /**
     * @notice Internal logic for claiming a failed transfer
     * @dev Verifies proof and generates new state
     * @param params Claim parameters
     * @return newState New state of the sender
     */
    function _claim(ClaimParams calldata params)
        internal
        view
        checkArrayLength(2, params.artifacts.outputs.length)
        returns (Payload memory newState)
    {
        FailedCrossChainTransfer storage failedTransfer = _getCStorageBridgeable()
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

        if (!_getCStorageBridgeable().claimVerifier.verifyProof(proof, pubSignals)) revert ProofVerificationFailed();

        newState = Payload({nonce: account.state.nonce + 1, commitment: pubSignals[0], eAmount: pubSignals[1]});
    }

    /**
     * @notice Retrieves the list of failed cross-chain transfers for a sender
     * @param sender Address of the sender
     * @return Array of FailedCrossChainTransfer structs
     */
    function getFailedCrossChainTransfers(address sender) external view returns (FailedCrossChainTransfer[] memory) {
        return _getCStorageBridgeable().failedCrossChainTransfers[sender];
    }

    /* VIRTUAL INTERNAL */

    function _cBurn(uint256 amount) internal virtual;

    function _cMint(uint256 amount) internal virtual;
}
