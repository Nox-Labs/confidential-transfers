// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.28;

import {SendParam} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/interfaces/IOFT.sol";

library OFTLib {
    function buildMsgAndOptions(SendParam calldata _sendParam, uint256 _amountLD)
        internal
        view
        returns (bytes memory message, bytes memory options)
    {}
}
