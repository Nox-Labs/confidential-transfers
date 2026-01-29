// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

// Forge imports
import {console} from "forge-std/console.sol";

import {MessagingReceipt} from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol";

import {TestHelperOz5} from "@layerzerolabs/test-devtools-evm-foundry/contracts/TestHelperOz5.sol";

// OApp imports
import {OptionsBuilder} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OptionsBuilder.sol";
import {MessagingFee} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFTCore.sol";
import {OFTReceipt, SendParam} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/interfaces/IOFT.sol";
import {OFTComposeMsgCodec} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/libs/OFTComposeMsgCodec.sol";

// ConfidentialOFT imports
import {ConfidentialOFT} from "../../src/ConfidentialOFT.sol";
import {CSendParams} from "../../src/interface/IConfidentialOFT.sol";
import {
    AuditReport,
    InitParams,
    Payload,
    PendingTransfer,
    TransferParams,
    UpdateParams,
    ZKArtifacts
} from "../../src/interface/IConfidentialTransfers.sol";
import {PlonkVerifier as ApplyAndTransferPlonkVerifier} from "../../src/verifiers/ApplyAndTransferPlonkVerifier.sol";
import {PlonkVerifier as ApplyPlonkVerifier} from "../../src/verifiers/ApplyPlonkVerifier.sol";
import {PlonkVerifier as ClaimPlonkVerifier} from "../../src/verifiers/ClaimPlonkVerifier.sol";
import {PlonkVerifier as InitPlonkVerifier} from "../../src/verifiers/InitPlonkVerifier.sol";
import {PlonkVerifier as TransferPlonkVerifier} from "../../src/verifiers/TransferPlonkVerifier.sol";
import {PlonkVerifier as UpdatePlonkVerifier} from "../../src/verifiers/UpdatePlonkVerifier.sol";

// DevTools imports
import {MockOFTComposer} from "../../test/utils/mock/MockOFTComposer.sol";
import {MockVerifier} from "../../test/utils/mock/MockVerifier.sol";

contract BaseSetup is TestHelperOz5 {
    using OptionsBuilder for bytes;

    uint32 aEid = 1;
    uint32 bEid = 2;

    ConfidentialOFT aOFT;
    ConfidentialOFT bOFT;

    address userA = address(uint160(0xA) << 96);
    address userB = address(uint160(0xA) << 96 + 1);
    uint256 initialBalance = 100 ether;

    function setUp() public virtual override {
        // Provide initial Ether balances to users for testing purposes
        vm.deal(userA, 1000 ether);
        vm.deal(userB, 1000 ether);

        // Call the base setup function from the TestHelperOz5 contract
        super.setUp();

        // Initialize 2 endpoints, using UltraLightNode as the library type
        setUpEndpoints(2, LibraryType.UltraLightNode);

        address mockVerifier = address(new MockVerifier());

        // Deploy two instances of OFTMock for testing, associating them with respective endpoints
        aOFT = new ConfidentialOFT(
            "aOFT",
            "aOFT",
            address(endpoints[aEid]),
            address(this),
            100,
            InitPlonkVerifier(mockVerifier),
            ApplyPlonkVerifier(mockVerifier),
            UpdatePlonkVerifier(mockVerifier),
            TransferPlonkVerifier(mockVerifier),
            ApplyAndTransferPlonkVerifier(mockVerifier),
            ClaimPlonkVerifier(mockVerifier)
        );

        bOFT = new ConfidentialOFT(
            "bOFT",
            "bOFT",
            address(endpoints[bEid]),
            address(this),
            100,
            InitPlonkVerifier(mockVerifier),
            ApplyPlonkVerifier(mockVerifier),
            UpdatePlonkVerifier(mockVerifier),
            TransferPlonkVerifier(mockVerifier),
            ApplyAndTransferPlonkVerifier(mockVerifier),
            ClaimPlonkVerifier(mockVerifier)
        );

        // Configure and wire the OFTs together
        address[] memory ofts = new address[](2);
        ofts[0] = address(aOFT);
        ofts[1] = address(bOFT);
        this.wireOApps(ofts);

        // Build options for the send operation
        uint256[] memory outputs = new uint256[](4);
        outputs[0] = uint256(keccak256(abi.encode("cPublicKeyX")));
        outputs[1] = uint256(keccak256(abi.encode("cPublicKeyY")));
        outputs[2] = uint256(keccak256(abi.encode("newCommitment")));
        outputs[3] = uint256(keccak256(abi.encode("eAmount")));

        vm.startPrank(userA);
        aOFT.cInit(InitParams(ZKArtifacts(new uint256[](24), outputs), new AuditReport[](0)));
        bOFT.cInit(InitParams(ZKArtifacts(new uint256[](24), outputs), new AuditReport[](0)));
        vm.stopPrank();

        // Mint initial tokens for userA and userB
        deal(address(aOFT), userA, initialBalance, true);
        deal(address(bOFT), userB, initialBalance, true);
    }
}

