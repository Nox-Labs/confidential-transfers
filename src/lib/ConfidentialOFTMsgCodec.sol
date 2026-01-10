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
     * @return _msg The encoded message.
     */
    function encode(address _recipient, PendingTransfer memory _pt)
        internal
        pure
        returns (bytes memory _msg)
    {
        _msg = abi.encode(_recipient, _pt);
    }

    function sendTo(bytes calldata _msg) internal pure returns (address recipient) {
        (recipient,) = abi.decode(_msg, (address, PendingTransfer));
    }

    function pendingTransfer(bytes calldata _msg)
        internal
        pure
        returns (PendingTransfer memory _pendingTransfer)
    {
        (, _pendingTransfer) = abi.decode(_msg, (address, PendingTransfer));
    }
}
