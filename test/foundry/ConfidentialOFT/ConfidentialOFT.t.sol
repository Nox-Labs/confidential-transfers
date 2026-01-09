// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;
// Mock imports

// OApp imports
import {OptionsBuilder} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OptionsBuilder.sol";
// OFT imports
import {MessagingFee} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFTCore.sol";
import {SendParam} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/interfaces/IOFT.sol";

// ConfidentialOFT imports
import {ConfidentialOFT} from "../../../src/ConfidentialOFT.sol";
import {CSendParams} from "../../../src/interface/IConfidentialOFT.sol";
import {
    AuditReport,
    InitParams,
    Payload,
    PendingTransfer,
    TransferParams,
    ZKArtifacts
} from "../../../src/interface/IConfidentialTransfers.sol";

// Forge imports
import "forge-std/console.sol";

// DevTools imports
import {TestHelperOz5} from "@layerzerolabs/test-devtools-evm-foundry/contracts/TestHelperOz5.sol";

import {MockVerifier} from "../../../test/utils/mock/MockVerifier.sol";

import {
    PlonkVerifier as ApplyAndTransferPlonkVerifier
} from "../../../src/verifiers/ApplyAndTransferPlonkVerifier.sol";
import {PlonkVerifier as ApplyPlonkVerifier} from "../../../src/verifiers/ApplyPlonkVerifier.sol";
import {PlonkVerifier as InitPlonkVerifier} from "../../../src/verifiers/InitPlonkVerifier.sol";
import {
    PlonkVerifier as TransferPlonkVerifier
} from "../../../src/verifiers/TransferPlonkVerifier.sol";
import {PlonkVerifier as UpdatePlonkVerifier} from "../../../src/verifiers/UpdatePlonkVerifier.sol";

contract MyOFTTest is TestHelperOz5 {
    using OptionsBuilder for bytes;

    uint32 private aEid = 1;
    uint32 private bEid = 2;

    ConfidentialOFT private aOFT;
    ConfidentialOFT private bOFT;

    address private userA = address(uint160(0xA) << 96);
    address private userB = address(uint160(0xA) << 96 + 1);
    uint256 private initialBalance = 100 ether;

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
            ApplyAndTransferPlonkVerifier(mockVerifier)
        );

        console.log("aOFT deployed to:", address(aOFT));

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
            ApplyAndTransferPlonkVerifier(mockVerifier)
        );

        console.log("bOFT deployed to:", address(bOFT));

        // Configure and wire the OFTs together
        address[] memory ofts = new address[](2);
        ofts[0] = address(aOFT);
        ofts[1] = address(bOFT);
        this.wireOApps(ofts);

        // Mint initial tokens for userA and userB
        deal(address(aOFT), userA, initialBalance);
        deal(address(bOFT), userB, initialBalance);
    }

    // Test sending OFT tokens from one user to another
    function test_send_oft() public {
        uint256 tokensToSend = 1 ether;

        // Build options for the send operation
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(200_000, 0);

        // Set up parameters for the send operation
        SendParam memory sendParam =
            SendParam(bEid, addressToBytes32(userB), tokensToSend, tokensToSend, options, "", "");

        // Quote the fee for sending tokens
        MessagingFee memory fee = aOFT.quoteSend(sendParam, false);

        // Verify initial balances before the send operation
        assertEq(aOFT.balanceOf(userA), initialBalance);
        assertEq(bOFT.balanceOf(userB), initialBalance);

        // Perform the send operation
        vm.prank(userA);
        aOFT.send{value: fee.nativeFee}(sendParam, fee, payable(address(this)));

        // Verify that the packets were correctly sent to the destination chain.
        // @param _dstEid The endpoint ID of the destination chain.
        // @param _dstAddress The OApp address on the destination chain.
        verifyPackets(bEid, addressToBytes32(address(bOFT)));

        // Check balances after the send operation
        assertEq(aOFT.balanceOf(userA), initialBalance - tokensToSend);
        assertEq(bOFT.balanceOf(userB), initialBalance + tokensToSend);
    }

    function test_cSend_oft() public {
        // Build options for the send operation
        uint256[] memory outputs = new uint256[](4);
        outputs[0] = uint256(keccak256(abi.encode("cPublicKey_X")));
        outputs[1] = uint256(keccak256(abi.encode("cPublicKey_Y")));
        outputs[2] = uint256(keccak256(abi.encode("newCommitment")));
        outputs[3] = uint256(keccak256(abi.encode("eAmount")));

        vm.prank(userA);
        aOFT.cInit(InitParams(ZKArtifacts(new uint256[](24), outputs), new AuditReport[](0)));

        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(200_000, 0);

        ZKArtifacts memory artifacts = ZKArtifacts(new uint256[](24), new uint256[](4));

        artifacts.outputs[0] = uint256(keccak256(abi.encode("commitment")));
        artifacts.outputs[1] = uint256(keccak256(abi.encode("eAmount")));
        artifacts.outputs[2] = uint256(keccak256(abi.encode("transferCommitment")));
        artifacts.outputs[3] = uint256(keccak256(abi.encode("transferEAmount")));

        TransferParams memory transferParams =
            TransferParams(artifacts, userA, new AuditReport[](0), new AuditReport[](0));

        // Set up parameters for the send operation
        CSendParams memory cSendParams = CSendParams(bEid, transferParams, options);

        MessagingFee memory fee = aOFT.quoteCSend(cSendParams);

        vm.prank(userA);
        aOFT.cSend{value: fee.nativeFee}(cSendParams, fee, payable(address(this)));

        Payload memory state = aOFT.getAccount(userA).state;
        assertEq(state.nonce, 1);
        assertEq(state.commitment, artifacts.outputs[0]);
        assertEq(state.eAmount, artifacts.outputs[1]);

        assertEq(bOFT.getAccount(userA).pendingTransfers.length, 0);

        verifyPackets(bEid, addressToBytes32(address(bOFT)));

        PendingTransfer[] memory pendingTransfers = bOFT.getAccount(userA).pendingTransfers;
        assertEq(pendingTransfers.length, 1);
        assertEq(pendingTransfers[0].sender, userA);
        assertEq(pendingTransfers[0].payload.commitment, artifacts.outputs[2]);
        assertEq(pendingTransfers[0].payload.eAmount, artifacts.outputs[3]);
    }

    // Test sending OFT tokens with a composed message
    // function test_send_oft_compose_msg() public {
    //     uint256 tokensToSend = 1 ether;

    //     MockERC20 erc20 = new MockERC20();

    //     // Create an instance of the OFTComposerMock contract
    //     ComposerMock composer =
    //         new ComposerMock(address(erc20), address(endpoints[bEid]), address(bOFT));

    //     // Build options for the send operation with a composed message
    //     bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(200_000, 0)
    //         .addExecutorLzComposeOption(0, 500_000, 0);
    //     bytes memory composeMsg = hex"1234";

    //     // Set up parameters for the send operation
    //     SendParam memory sendParam = SendParam(
    //         bEid,
    //         addressToBytes32(address(composer)),
    //         tokensToSend,
    //         tokensToSend,
    //         options,
    //         composeMsg,
    //         ""
    //     );

    //     // Quote the fee for sending tokens
    //     MessagingFee memory fee = aOFT.quoteSend(sendParam, false);

    //     // Verify initial balances before the send operation
    //     assertEq(aOFT.balanceOf(userA), initialBalance);
    //     assertEq(bOFT.balanceOf(address(composer)), 0);

    //     // Perform the send operation
    //     vm.prank(userA);
    //     (MessagingReceipt memory msgReceipt, OFTReceipt memory oftReceipt) =
    //         aOFT.send{value: fee.nativeFee}(sendParam, fee, payable(address(this)));

    //     // Verify that the packets were correctly sent to the destination chain.
    //     // @param _dstEid The endpoint ID of the destination chain.
    //     // @param _dstAddress The OApp address on the destination chain.
    //     verifyPackets(bEid, addressToBytes32(address(bOFT)));

    //     // Set up parameters for the composed message
    //     uint32 dstEid_ = bEid;
    //     address from_ = address(bOFT);
    //     bytes memory options_ = options;
    //     bytes32 guid_ = msgReceipt.guid;
    //     address to_ = address(composer);
    //     bytes memory composerMsg_ = OFTComposeMsgCodec.encode(
    //         msgReceipt.nonce,
    //         aEid,
    //         oftReceipt.amountReceivedLD,
    //         abi.encodePacked(addressToBytes32(userA), composeMsg)
    //     );

    //     // Execute the composed message
    //     this.lzCompose(dstEid_, from_, options_, guid_, to_, composerMsg_);

    //     // Check balances after the send operation
    //     // assertEq(aOFT.balanceOf(userA), initialBalance - tokensToSend);
    //     // assertEq(bOFT.balanceOf(address(composer)), 0);

    //     // assertEq(erc20.balanceOf(address(composer)), );
    //     // assertEq(erc20.balanceOf(userA), oftReceipt.amountReceivedLD);
    // }
}
