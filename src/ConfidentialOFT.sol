// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.28;

import {ConfidentialTransfersBridgeable} from "./ConfidentialTransfersBridgeable.sol";

import {CSendParams, IConfidentialOFT} from "./interface/IConfidentialOFT.sol";
import {Payload, PendingTransfer} from "./interface/IConfidentialTransfers.sol";

import {PlonkVerifier as ApplyAndTransferPlonkVerifier} from "./verifiers/ApplyAndTransferPlonkVerifier.sol";
import {PlonkVerifier as ApplyPlonkVerifier} from "./verifiers/ApplyPlonkVerifier.sol";
import {PlonkVerifier as ClaimPlonkVerifier} from "./verifiers/ClaimPlonkVerifier.sol";
import {PlonkVerifier as InitPlonkVerifier} from "./verifiers/InitPlonkVerifier.sol";
import {PlonkVerifier as TransferPlonkVerifier} from "./verifiers/TransferPlonkVerifier.sol";
import {PlonkVerifier as UpdatePlonkVerifier} from "./verifiers/UpdatePlonkVerifier.sol";

import {Origin} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OAppReceiver.sol";
import {MessagingFee} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OAppSender.sol";
import {IOAppMsgInspector} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/interfaces/IOAppMsgInspector.sol";
import {OFT} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFT.sol";
import {SendParam} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/interfaces/IOFT.sol";
import {OFTMsgCodec} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/libs/OFTMsgCodec.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {MessagingReceipt} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/interfaces/IOFT.sol";

/**
 * @title ConfidentialOFT
 * @notice Omnichain Fungible Token (OFT) with confidential transfer capabilities.
 * @dev Integrates ConfidentialTransfersBridgeable with LayerZero's OFT standard.
 *      Allows moving confidential assets across chains via the LayerZero protocol.
 */
contract ConfidentialOFT is ConfidentialTransfersBridgeable, OFT, IConfidentialOFT {
    constructor(
        string memory _tokenName,
        string memory _tokenSymbol,
        address _lzEndpoint,
        address _delegate,
        uint256 _maxPendingTransfers,
        InitPlonkVerifier _initVerifier,
        ApplyPlonkVerifier _applyVerifier,
        UpdatePlonkVerifier _updateVerifier,
        TransferPlonkVerifier _transferVerifier,
        ApplyAndTransferPlonkVerifier _applyAndTransferVerifier,
        ClaimPlonkVerifier _claimVerifier
    ) OFT(_tokenName, _tokenSymbol, _lzEndpoint, _delegate) Ownable(_delegate) initializer {
        __ConfidentialTransfers_init(
            _maxPendingTransfers,
            _initVerifier,
            _applyVerifier,
            _updateVerifier,
            _transferVerifier,
            _applyAndTransferVerifier
        );
        __ConfidentialTransfersBridgeable_init(_claimVerifier);
    }

    function _cBurn(uint256 amount) internal override {
        _burn(address(this), amount);
    }

    function _cMint(uint256 amount) internal override {
        _mint(address(this), amount);
    }

    function _cTransfer(address from, address to, uint256 amount) internal override {
        _transfer(from, to, amount);
    }

    /**
     * @notice Quotes the fee for a confidential cross-chain transfer
     * @dev Calculates the messaging fee for LayerZero
     * @param params Parameters for the confidential send
     * @return msgFee The calculated messaging fee
     */
    function quoteCSend(CSendParams calldata params) external view returns (MessagingFee memory msgFee) {
        Payload memory pendingTransferPackage = Payload({
            nonce: _getCStorage().accounts[msg.sender].state.nonce + 1,
            commitment: params.transferParams.artifacts.outputs[2],
            eAmount: params.transferParams.artifacts.outputs[3]
        });

        PendingTransfer memory pendingTransfer =
            PendingTransfer(msg.sender, pendingTransferPackage, params.transferParams.transferAuditReports);

        bytes memory cMsg =
            _encodeCMessage(params.transferParams.recipient, pendingTransfer, params.transferParams.extraData);

        (bytes memory message, bytes memory options) = _buildMsgAndOptions(params, cMsg);

        msgFee = _quote(params.dstEid, message, options, false);
    }

    /**
     * @notice Executes a confidential cross-chain transfer
     * @dev Sends the confidential transfer message via LayerZero
     * @param params Parameters for the confidential send
     * @param fee The messaging fee
     * @param refundAddress Address to refund excess gas
     * @return msgReceipt The receipt of the messaging operation
     */
    function cSend(CSendParams calldata params, MessagingFee calldata fee, address refundAddress)
        external
        payable
        onlyInitialized(msg.sender)
        checkRequiredAuditor(msg.sender, params.transferParams.stateAuditReports)
        checkRequiredAuditor(msg.sender, params.transferParams.transferAuditReports)
        returns (MessagingReceipt memory msgReceipt)
    {
        (,, bytes memory cMsg) = _cSend(params.transferParams);

        (bytes memory lzMsg, bytes memory options) = _buildMsgAndOptions(params, cMsg);

        msgReceipt = _lzSend(params.dstEid, lzMsg, options, fee, refundAddress);
    }

    /**
     * @notice Builds the message and options for a standard OFT send
     * @dev Override from OFT to support custom message building
     * @param _sendParam Parameters for the send
     * @param _amountLD Amount in local decimals
     * @return message Encoded message
     * @return options Encoded options
     */
    function _buildMsgAndOptions(SendParam calldata _sendParam, uint256 _amountLD)
        internal
        view
        override
        returns (bytes memory message, bytes memory options)
    {
        (bytes memory msgPayload, bool hasCompose) =
            OFTMsgCodec.encode(_sendParam.to, _toSD(_amountLD), _sendParam.composeMsg);

        message = abi.encode(uint8(0), msgPayload);

        options = combineOptions(_sendParam.dstEid, hasCompose ? SEND_AND_CALL : SEND, _sendParam.extraOptions);

        if (msgInspector != address(0)) IOAppMsgInspector(msgInspector).inspect(msgPayload, options);
    }

    /**
     * @notice Builds the message and options for a confidential OFT send
     * @dev Specific implementation for confidential transfers
     * @param params Parameters for the confidential send
     * @param cMsg Encoded confidential message
     * @return typedMessage Encoded message with type prefix
     * @return options Encoded options
     */
    function _buildMsgAndOptions(CSendParams calldata params, bytes memory cMsg)
        internal
        view
        returns (bytes memory typedMessage, bytes memory options)
    {
        typedMessage = abi.encode(uint8(1), cMsg);

        options = combineOptions(params.dstEid, SEND, params.extraOptions);

        if (msgInspector != address(0)) IOAppMsgInspector(msgInspector).inspect(typedMessage, options);
    }

    /**
     * @notice Handles received LayerZero messages
     * @dev Routes messages based on type (standard OFT or confidential)
     * @param origin Origin information
     * @param guid Global unique identifier
     * @param message The received message
     * @param executor The executor address
     * @param extraData Additional data
     */
    function _lzReceive(
        Origin calldata origin,
        bytes32 guid,
        bytes calldata message,
        address executor,
        bytes calldata extraData
    ) internal virtual override {
        (uint8 msgType, bytes memory msgWithBridgeType) = abi.decode(message, (uint8, bytes));
        uint256 len = msgWithBridgeType.length;
        if (msgType == 0) {
            // we use _message slice because _lzReceive expect that _message should be in calldata but msgPayload is in memory
            super._lzReceive(origin, guid, message[96:96 + len], executor, extraData);
        } else if (msgType == 1) {
            _cReceive(message[96:96 + len]);
        } else {
            revert InvalidMessageType();
        }
    }
}

