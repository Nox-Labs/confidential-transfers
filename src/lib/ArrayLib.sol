// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {IConfidentialTransfers, Package} from "../interface/IConfidentialTransfers.sol";

library ArrayLib {
    error DuplicateIndex();

    function toFixed24(uint256[] calldata input) internal pure returns (uint256[24] memory output) {
        if (input.length != 24) revert IConfidentialTransfers.InvalidArrayLength(24, input.length);
        assembly {
            calldatacopy(output, input.offset, mul(input.length, 0x20))
        }
    }

    function removeByIndices(Package[] storage self, uint256[] memory indicesToRemove) internal {
        assertUnique(indicesToRemove, self.length);

        uint256 len = self.length;
        uint256 numToRemove = indicesToRemove.length;

        bool[] memory isRemoved = new bool[](len);
        for (uint256 i = 0; i < numToRemove; i++) {
            isRemoved[indicesToRemove[i]] = true;
        }

        uint256 lastElementIndex = len - 1;

        for (uint256 i = 0; i < numToRemove; i++) {
            uint256 indexToRemove = indicesToRemove[i];
            if (indexToRemove >= len - numToRemove) continue;

            while (lastElementIndex > 0 && isRemoved[lastElementIndex]) lastElementIndex--;

            if (indexToRemove < lastElementIndex) {
                self[indexToRemove] = self[lastElementIndex];
                isRemoved[lastElementIndex] = true;
                lastElementIndex--;
            }
        }

        for (uint256 i = 0; i < numToRemove; i++) {
            self.pop();
        }
    }

    function assertUnique(uint256[] memory indices, uint256 lengthOfPendingTransfers) internal pure {
        bool[] memory seen = new bool[](lengthOfPendingTransfers);
        for (uint256 i = 0; i < indices.length; i++) {
            uint256 index = indices[i];
            if (seen[index]) revert DuplicateIndex();
            seen[index] = true;
        }
    }
}
