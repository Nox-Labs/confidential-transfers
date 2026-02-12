// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "../BaseSetup.t.sol";

contract cSend is BaseSetup {
    using OptionsBuilder for bytes;

    function test_ShouldSendConfidentialTokens() public {
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(200_000, 0);

        ZKArtifacts memory artifacts = ZKArtifacts(new uint256[](24), new uint256[](4));

        artifacts.outputs[0] = uint256(keccak256(abi.encode("commitment")));
        artifacts.outputs[1] = uint256(keccak256(abi.encode("eAmount")));
        artifacts.outputs[2] = uint256(keccak256(abi.encode("transferCommitment")));
        artifacts.outputs[3] = uint256(keccak256(abi.encode("transferEAmount")));

        TransferParams memory transferParams =
            TransferParams(artifacts, userA, new AuditReport[](0), new AuditReport[](0), "");

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
}

