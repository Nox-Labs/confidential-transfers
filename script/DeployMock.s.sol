// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {MockERC20} from "../test/mock/MockERC20.sol";

import {PlonkVerifier as UpdatePlonkVerifier} from "../src/verifiers/UpdatePlonkVerifier.sol";
import {PlonkVerifier as TransferPlonkVerifier} from "../src/verifiers/TransferPlonkVerifier.sol";
import {PlonkVerifier as InitPlonkVerifier} from "../src/verifiers/InitPlonkVerifier.sol";
import {PlonkVerifier as ApplyPlonkVerifier} from "../src/verifiers/ApplyPlonkVerifier.sol";
import {PlonkVerifier as ApplyAndTransferPlonkVerifier} from "../src/verifiers/ApplyAndTransferPlonkVerifier.sol";

contract DeployMock is Script {
    function run() public {
        vm.startBroadcast();
        InitPlonkVerifier initVerifier = new InitPlonkVerifier();
        ApplyPlonkVerifier applyVerifier = new ApplyPlonkVerifier();
        UpdatePlonkVerifier updateVerifier = new UpdatePlonkVerifier();
        TransferPlonkVerifier transferVerifier = new TransferPlonkVerifier();
        ApplyAndTransferPlonkVerifier applyAndTransferVerifier = new ApplyAndTransferPlonkVerifier();
        MockERC20 mockERC20 =
            new MockERC20(20, initVerifier, applyVerifier, updateVerifier, transferVerifier, applyAndTransferVerifier);
        mockERC20.mint(msg.sender, 1e22);
        console.log("MockERC20 deployed to:", address(mockERC20));
    }
}
