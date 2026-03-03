// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {AuditReport, IConfidentialTransfers, PendingTransfer} from "../interface/IConfidentialTransfers.sol";
import {FailedCrossChainTransfer} from "../interface/IConfidentialTransfersBridgeable.sol";

library ArrayLib {
    error IndicesNotStrictlyAscending();
    error IndexOutOfBounds();
    error NotFound();

    function toFixed24(uint256[] calldata input) internal pure returns (uint256[24] calldata output) {
        if (input.length != 24) revert IConfidentialTransfers.InvalidArrayLength(24, input.length);
        assembly {
            output := input.offset
        }
    }

    /// @dev Requires indicesToRemove to be in strictly ascending order.
    function removeByIndices(PendingTransfer[] storage self, uint256[] calldata indicesToRemove) internal {
        uint256 numToRemove = indicesToRemove.length;
        if (numToRemove == 0) return;

        for (uint256 i = 1; i < numToRemove; i++) {
            if (indicesToRemove[i] <= indicesToRemove[i - 1]) revert IndicesNotStrictlyAscending();
        }

        uint256 a = 0;
        uint256 b = numToRemove;
        uint256 j = self.length - 1;

        if (indicesToRemove[b - 1] > j) revert IndexOutOfBounds();

        while (a < b) {
            if (indicesToRemove[b - 1] == j) {
                b--;
            } else {
                self[indicesToRemove[a]] = self[j];
                a++;
            }
            unchecked {
                j--;
            }
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

    function contains(address[] storage self, address item) internal view returns (bool) {
        for (uint256 i = 0; i < self.length; i++) {
            if (self[i] == item) return true;
        }
        return false;
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

