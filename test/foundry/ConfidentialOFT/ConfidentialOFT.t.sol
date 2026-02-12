// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "../BaseSetup.t.sol";

contract ConfidentialOFTTest is BaseSetup {
    function test_cDeposit_ShouldBurnTokens() public {
        uint256 totalSupplyBefore = aOFT.totalSupply();
        uint256 balanceOfUserABefore = aOFT.balanceOf(userA);
        UpdateParams memory updateParams =
            UpdateParams(ZKArtifacts(new uint256[](24), new uint256[](2)), initialBalance, new AuditReport[](0));
        vm.prank(userA);
        aOFT.cDeposit(updateParams);
        assertEq(aOFT.totalSupply(), totalSupplyBefore - initialBalance);
        assertEq(aOFT.balanceOf(userA), balanceOfUserABefore - initialBalance);
        assertEq(aOFT.balanceOf(address(this)), 0);
    }

    function test_cWithdraw_ShouldMintTokens() public {
        uint256 totalSupplyBefore = aOFT.totalSupply();
        uint256 balanceOfUserABefore = aOFT.balanceOf(userA);
        vm.prank(userA);
        aOFT.cWithdraw(
            UpdateParams(ZKArtifacts(new uint256[](24), new uint256[](2)), initialBalance, new AuditReport[](0))
        );
        assertEq(aOFT.totalSupply(), totalSupplyBefore + initialBalance);
        assertEq(aOFT.balanceOf(userA), balanceOfUserABefore + initialBalance);
        assertEq(aOFT.balanceOf(address(this)), 0);
    }
}

