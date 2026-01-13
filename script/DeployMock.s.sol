// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {MockConfidentialOFT} from "../test/utils/mock/MockConfidentialOFT.sol";

import {
    PlonkVerifier as ApplyAndTransferPlonkVerifier
} from "../src/verifiers/ApplyAndTransferPlonkVerifier.sol";
import {PlonkVerifier as ApplyPlonkVerifier} from "../src/verifiers/ApplyPlonkVerifier.sol";
import {PlonkVerifier as InitPlonkVerifier} from "../src/verifiers/InitPlonkVerifier.sol";
import {PlonkVerifier as TransferPlonkVerifier} from "../src/verifiers/TransferPlonkVerifier.sol";
import {PlonkVerifier as UpdatePlonkVerifier} from "../src/verifiers/UpdatePlonkVerifier.sol";

contract DeployMock is Script {
    mapping(string => address) public chainToEndpoint;

    constructor() {
        chainToEndpoint["mainnet-sepolia"] = 0x6EDCE65403992e310A62460808c4b910D972f10f;
        chainToEndpoint["arbitrum-sepolia"] = 0x6EDCE65403992e310A62460808c4b910D972f10f;
    }

    function run(string memory chainName) public {
        vm.createSelectFork(chainName);

        // vm.deal(msg.sender, 1000 ether);

        address endpoint = chainToEndpoint[chainName];

        require(endpoint != address(0), string.concat("Endpoint not found for chain: ", chainName));

        vm.startBroadcast();
        InitPlonkVerifier initVerifier = new InitPlonkVerifier();
        ApplyPlonkVerifier applyVerifier = new ApplyPlonkVerifier();
        UpdatePlonkVerifier updateVerifier = new UpdatePlonkVerifier();
        TransferPlonkVerifier transferVerifier = new TransferPlonkVerifier();
        ApplyAndTransferPlonkVerifier applyAndTransferVerifier = new ApplyAndTransferPlonkVerifier();
        MockConfidentialOFT mockConfidentialOFT = new MockConfidentialOFT(
            "Test Confidential OFT",
            "cOFT",
            endpoint,
            msg.sender,
            10,
            initVerifier,
            applyVerifier,
            updateVerifier,
            transferVerifier,
            applyAndTransferVerifier
        );
        mockConfidentialOFT.mint(msg.sender, 1e22);
        console.log("MockConfidentialOFT deployed to:", address(mockConfidentialOFT));
        console.log("Sender aka Owner:", msg.sender);
        console.log("Token Balance:", mockConfidentialOFT.balanceOf(msg.sender));
        console.log("Native Balance:", address(msg.sender).balance);
    }
}
