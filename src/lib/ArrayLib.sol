// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {AuditReport, IConfidentialTransfers, PendingTransfer} from "../interface/IConfidentialTransfers.sol";
import {FailedCrossChainTransfer} from "../interface/IConfidentialTransfersBridgeable.sol";

library ArrayLib {
    error DuplicateIndex();
    error NotFound();

    function toFixed24(uint256[] calldata input) internal pure returns (uint256[24] memory output) {
        if (input.length != 24) revert IConfidentialTransfers.InvalidArrayLength(24, input.length);
        assembly {
            calldatacopy(output, input.offset, mul(input.length, 0x20))
        }
    }

    function removeByIndices(PendingTransfer[] storage self, uint256[] calldata indicesToRemove) internal {
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

    function remove(FailedCrossChainTransfer[] storage self, uint256 index) internal {
        uint256 lastIndex = self.length - 1;
        if (index != lastIndex) self[index] = self[lastIndex];
        self.pop();
    }

    function remove(address[] storage self, address item) internal {
        uint256 len = self.length;
        for (uint256 i = 0; i < len; i++) {
            if (self[i] == item) {
                self[i] = self[len - 1];
                self.pop();
                break;
            }
        }
        if (self.length == len) revert NotFound();
    }

    function assertUnique(uint256[] calldata indices, uint256 lengthOfPendingTransfers) internal pure {
        bool[] memory seen = new bool[](lengthOfPendingTransfers);
        for (uint256 i = 0; i < indices.length; i++) {
            uint256 index = indices[i];
            if (seen[index]) revert DuplicateIndex();
            seen[index] = true;
        }
    }

    function assertContains(address[] storage self, AuditReport[] calldata auditReports) internal view {
        if (self.length == 0) return;
        if (self.length > auditReports.length) revert NotFound();

        for (uint256 i = 0; i < self.length; i++) {
            bool found = false;
            for (uint256 j = 0; j < auditReports.length; j++) {
                if (self[i] == auditReports[j].auditor) {
                    found = true;
                    break;
                }
            }

            if (!found) revert NotFound();
        }
    }
}

