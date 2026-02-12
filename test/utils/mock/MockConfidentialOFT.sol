// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.28;

import {ConfidentialOFT} from "../../../src/ConfidentialOFT.sol";

import {PlonkVerifier as ApplyAndTransferPlonkVerifier} from "../../../src/verifiers/ApplyAndTransferPlonkVerifier.sol";
import {PlonkVerifier as ApplyPlonkVerifier} from "../../../src/verifiers/ApplyPlonkVerifier.sol";
import {PlonkVerifier as ClaimPlonkVerifier} from "../../../src/verifiers/ClaimPlonkVerifier.sol";
import {PlonkVerifier as InitPlonkVerifier} from "../../../src/verifiers/InitPlonkVerifier.sol";
import {PlonkVerifier as TransferPlonkVerifier} from "../../../src/verifiers/TransferPlonkVerifier.sol";
import {PlonkVerifier as UpdatePlonkVerifier} from "../../../src/verifiers/UpdatePlonkVerifier.sol";

contract MockConfidentialOFT is ConfidentialOFT {
    constructor(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint,
        address _delegate,
        uint256 _maxPendingTransfers,
        InitPlonkVerifier _initVerifier,
        ApplyPlonkVerifier _applyVerifier,
        UpdatePlonkVerifier _updateVerifier,
        TransferPlonkVerifier _transferVerifier,
        ApplyAndTransferPlonkVerifier _applyAndTransferVerifier,
        ClaimPlonkVerifier _claimVerifier
    )
        ConfidentialOFT(
            _name,
            _symbol,
            _lzEndpoint,
            _delegate,
            _maxPendingTransfers,
            _initVerifier,
            _applyVerifier,
            _updateVerifier,
            _transferVerifier,
            _applyAndTransferVerifier,
            _claimVerifier
        )
        initializer
    {}

    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }
}
