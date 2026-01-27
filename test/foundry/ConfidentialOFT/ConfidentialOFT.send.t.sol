// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "../BaseSetup.t.sol";

contract Send is BaseSetup {
    using OptionsBuilder for bytes;

    function test_ShouldSendPublicTokens() public {
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

    function test_ShouldSendPublicTokensWithComposedMessage() public {
        uint256 tokensToSend = 1 ether;

        // Create an instance of the OFTComposerMock contract
        MockOFTComposer composer = new MockOFTComposer();

        // Build options for the send operation with a composed message
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(200_000, 0)
            .addExecutorLzComposeOption(0, 500_000, 0);
        bytes memory composeMsg = hex"1234";

        // Set up parameters for the send operation
        SendParam memory sendParam =
            SendParam(bEid, addressToBytes32(address(composer)), tokensToSend, tokensToSend, options, composeMsg, "");

        // Quote the fee for sending tokens
        MessagingFee memory fee = aOFT.quoteSend(sendParam, false);

        // Verify initial balances before the send operation
        assertEq(aOFT.balanceOf(userA), initialBalance);
        assertEq(bOFT.balanceOf(address(composer)), 0);

        // Perform the send operation
        vm.prank(userA);
        (MessagingReceipt memory msgReceipt, OFTReceipt memory oftReceipt) =
            aOFT.send{value: fee.nativeFee}(sendParam, fee, payable(address(this)));

        // Verify that the packets were correctly sent to the destination chain.
        // @param _dstEid The endpoint ID of the destination chain.
        // @param _dstAddress The OApp address on the destination chain.
        verifyPackets(bEid, addressToBytes32(address(bOFT)));

        // Set up parameters for the composed message
        uint32 dstEid_ = bEid;
        address from_ = address(bOFT);
        bytes memory options_ = options;
        bytes32 guid_ = msgReceipt.guid;
        address to_ = address(composer);
        bytes memory composerMsg_ = OFTComposeMsgCodec.encode(
            msgReceipt.nonce, aEid, oftReceipt.amountReceivedLD, abi.encodePacked(addressToBytes32(userA), composeMsg)
        );

        // Execute the composed message
        this.lzCompose(dstEid_, from_, options_, guid_, to_, composerMsg_);

        // Check balances after the send operation
        assertEq(aOFT.balanceOf(userA), initialBalance - tokensToSend);
        assertEq(bOFT.balanceOf(address(composer)), tokensToSend);

        // Verify the state of the composer contract
        assertEq(composer.from(), from_);
        assertEq(composer.guid(), guid_);
        assertEq(composer.message(), composerMsg_);
        assertEq(composer.executor(), address(this));
        assertEq(composer.extraData(), ""); // default to setting the extraData to the
        // message as well to test
    }
}

