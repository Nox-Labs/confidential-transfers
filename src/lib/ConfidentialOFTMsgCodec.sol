// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.20;

import {PendingTransfer} from "../interface/IConfidentialTransfers.sol";

library ConfidentialOFTMsgCodec {
    // Offset constants for encoding and decoding OFT messages
    uint8 private constant RECIPIENT_OFFSET = 20;

    /**
     * @dev Encodes an OFT LayerZero message.
     * @param _recipient The recipient address.
     * @param _pt The pending transfer.
     * @param _composeMsg The composed message.
     * @return _msg The encoded message.
     * @return hasCompose A boolean indicating whether the message has a composed payload.
     */
    function encode(address _recipient, PendingTransfer memory _pt, bytes memory _composeMsg)
        internal
        pure
        returns (bytes memory _msg, bool hasCompose)
    {
        hasCompose = _composeMsg.length > 0;
        // @dev Remote chains will want to know the composed function caller ie. msg.sender on the
        // src.
        // _msg = hasCompose ? abi.encode(_recipient, _pt, _composeMsg) : abi.encode(_recipient,
        // _pt);
        _msg = abi.encode(_recipient, _pt, _composeMsg);
    }

    function sendTo(bytes calldata _msg) internal pure returns (address recipient) {
        (recipient,,) = abi.decode(_msg, (address, PendingTransfer, bytes));
    }

    function pendingTransfer(bytes calldata _msg)
        internal
        pure
        returns (PendingTransfer memory _pendingTransfer)
    {
        (, _pendingTransfer,) = abi.decode(_msg, (address, PendingTransfer, bytes));
    }

    /**
     * @dev Retrieves the composed message from the OFT message.
     * @param _msg The OFT message.
     * @return _composeMsg The composed message.
     */
    function composeMsg(bytes calldata _msg) internal pure returns (bytes memory _composeMsg) {
        (,, _composeMsg) = abi.decode(_msg, (address, PendingTransfer, bytes));
    }

    function isComposed(bytes calldata _msg) internal pure returns (bool) {
        return composeMsg(_msg).length > 0;
    }
}
