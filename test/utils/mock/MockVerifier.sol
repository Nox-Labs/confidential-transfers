// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.28;

contract MockVerifier {
    function verifyProof(uint256[24] calldata, uint256[17] calldata) public pure returns (bool) {
        return true;
    }

    function verifyProof(uint256[24] calldata, uint256[6] calldata) public pure returns (bool) {
        return true;
    }

    function verifyProof(uint256[24] calldata, uint256[10] calldata) public pure returns (bool) {
        return true;
    }

    function verifyProof(uint256[24] calldata, uint256[8] calldata) public pure returns (bool) {
        return true;
    }

    function verifyProof(uint256[24] calldata, uint256[21] calldata) public pure returns (bool) {
        return true;
    }
}
