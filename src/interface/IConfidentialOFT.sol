// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.28;

import {TransferParams} from "./IConfidentialTransfers.sol";
import {MessagingFee} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OAppSender.sol";
import {MessagingReceipt} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/interfaces/IOFT.sol";

struct CSendParams {
    uint32 dstEid;
    TransferParams transferParams;
    bytes extraOptions;
}

interface IConfidentialOFT {
    function cSend(CSendParams calldata cSendParams, MessagingFee calldata fee, address refundAddress)
        external
        payable
        returns (MessagingReceipt memory msgReceipt);

    function quoteCSend(CSendParams calldata cSendParams) external view returns (MessagingFee memory msgFee);

    error InvalidMessageType();
}
