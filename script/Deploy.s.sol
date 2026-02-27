// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {MockConfidentialOFT} from "../test/utils/mock/MockConfidentialOFT.sol";
import {MockConfidentialTransfersBridgeable} from "../test/utils/mock/MockConfidentialTransfersBridgeable.sol";

import {PlonkVerifier as ApplyAndTransferPlonkVerifier} from "../src/verifiers/ApplyAndTransferPlonkVerifier.sol";
import {PlonkVerifier as ApplyPlonkVerifier} from "../src/verifiers/ApplyPlonkVerifier.sol";
import {PlonkVerifier as ClaimPlonkVerifier} from "../src/verifiers/ClaimPlonkVerifier.sol";
import {PlonkVerifier as InitPlonkVerifier} from "../src/verifiers/InitPlonkVerifier.sol";
import {PlonkVerifier as TransferPlonkVerifier} from "../src/verifiers/TransferPlonkVerifier.sol";
import {PlonkVerifier as UpdatePlonkVerifier} from "../src/verifiers/UpdatePlonkVerifier.sol";

string constant ANVIL_MNEMONIC = "test test test test test test test test test test test junk";
uint256 constant ANVIL_INITIAL_BALANCE = 1000 ether;

contract Deploy is Script {
    mapping(string => address) public chainToEndpoint;

    constructor() {
        chainToEndpoint["mainnet-sepolia"] = 0x6EDCE65403992e310A62460808c4b910D972f10f;
        chainToEndpoint["arbitrum-sepolia"] = 0x6EDCE65403992e310A62460808c4b910D972f10f;
    }

    function deploy(string memory chainName) public {
        vm.createSelectFork(chainName);

        vm.startBroadcast();

        (
            InitPlonkVerifier initVerifier,
            ApplyPlonkVerifier applyVerifier,
            UpdatePlonkVerifier updateVerifier,
            TransferPlonkVerifier transferVerifier,
            ApplyAndTransferPlonkVerifier applyAndTransferVerifier,
            ClaimPlonkVerifier claimVerifier
        ) = _deployVerifiers();

        MockConfidentialTransfersBridgeable mockContract = new MockConfidentialTransfersBridgeable(
            1000, initVerifier, applyVerifier, updateVerifier, transferVerifier, applyAndTransferVerifier, claimVerifier
        );

        console.log("MockConfidentialTransfersBridgeable deployed to:", address(mockContract));

        if (keccak256(abi.encodePacked(chainName)) == keccak256(abi.encodePacked("anvil"))) {
            uint256 user1pk = vm.deriveKey(ANVIL_MNEMONIC, 0);
            uint256 user2pk = vm.deriveKey(ANVIL_MNEMONIC, 1);

            address user1 = vm.addr(user1pk);
            address user2 = vm.addr(user2pk);

            mockContract.mint(user1, ANVIL_INITIAL_BALANCE);
            mockContract.mint(user2, ANVIL_INITIAL_BALANCE);
        }

        vm.stopBroadcast();
    }

    function deployOFT(string memory chainName) public {
        vm.createSelectFork(chainName);

        address endpoint = chainToEndpoint[chainName];

        require(endpoint != address(0), string.concat("Endpoint not found for chain: ", chainName));

        vm.startBroadcast();
        (
            InitPlonkVerifier initVerifier,
            ApplyPlonkVerifier applyVerifier,
            UpdatePlonkVerifier updateVerifier,
            TransferPlonkVerifier transferVerifier,
            ApplyAndTransferPlonkVerifier applyAndTransferVerifier,
            ClaimPlonkVerifier claimVerifier
        ) = _deployVerifiers();

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
            applyAndTransferVerifier,
            claimVerifier
        );

        console.log("MockConfidentialOFT deployed to:", address(mockConfidentialOFT));

        vm.stopBroadcast();
    }

    function _deployVerifiers()
        public
        returns (
            InitPlonkVerifier initVerifier,
            ApplyPlonkVerifier applyVerifier,
            UpdatePlonkVerifier updateVerifier,
            TransferPlonkVerifier transferVerifier,
            ApplyAndTransferPlonkVerifier applyAndTransferVerifier,
            ClaimPlonkVerifier claimVerifier
        )
    {
        initVerifier = new InitPlonkVerifier();
        applyVerifier = new ApplyPlonkVerifier();
        updateVerifier = new UpdatePlonkVerifier();
        transferVerifier = new TransferPlonkVerifier();
        applyAndTransferVerifier = new ApplyAndTransferPlonkVerifier();
        claimVerifier = new ClaimPlonkVerifier();
    }
}
