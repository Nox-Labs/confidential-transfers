// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {ConfidentialTransfersBridgeable} from "../../../src/ConfidentialTransfersBridgeable.sol";
import {PendingTransfer, TransferParams} from "../../../src/interface/IConfidentialTransfers.sol";
import {FailedCrossChainTransfer} from "../../../src/interface/IConfidentialTransfersBridgeable.sol";

import {PlonkVerifier as ApplyAndTransferPlonkVerifier} from "../../../src/verifiers/ApplyAndTransferPlonkVerifier.sol";
import {PlonkVerifier as ApplyPlonkVerifier} from "../../../src/verifiers/ApplyPlonkVerifier.sol";
import {PlonkVerifier as ClaimPlonkVerifier} from "../../../src/verifiers/ClaimPlonkVerifier.sol";
import {PlonkVerifier as InitPlonkVerifier} from "../../../src/verifiers/InitPlonkVerifier.sol";
import {PlonkVerifier as TransferPlonkVerifier} from "../../../src/verifiers/TransferPlonkVerifier.sol";
import {PlonkVerifier as UpdatePlonkVerifier} from "../../../src/verifiers/UpdatePlonkVerifier.sol";

contract MockConfidentialTransfersBridgeable is ERC20, ConfidentialTransfersBridgeable, Ownable {
    constructor(
        uint256 _maxPendingTransfers,
        InitPlonkVerifier _initVerifier,
        ApplyPlonkVerifier _applyVerifier,
        UpdatePlonkVerifier _updateVerifier,
        TransferPlonkVerifier _transferVerifier,
        ApplyAndTransferPlonkVerifier _applyAndTransferVerifier,
        ClaimPlonkVerifier _claimVerifier
    ) ERC20("MockERC20Bridgeable", "MOCKB") Ownable(msg.sender) initializer {
        __ConfidentialTransfers_init(
            _maxPendingTransfers,
            _initVerifier,
            _applyVerifier,
            _updateVerifier,
            _transferVerifier,
            _applyAndTransferVerifier
        );
        __ConfidentialTransfersBridgeable_init(_claimVerifier);
    }

    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }

    function bridge(TransferParams calldata transferParams) public {
        _cSend(transferParams);
        // send to destination chain logic here
    }

    function receiveBridge(
        address recipient,
        uint256 pubKeyX,
        uint256 pubKeyY,
        PendingTransfer memory pendingTransfer,
        bytes memory extraData
    ) public {
        // receive from source chain logic here
        bytes memory cMsg = abi.encode(recipient, pubKeyX, pubKeyY, pendingTransfer, extraData);
        _cReceive(cMsg);
    }

    function addFailedCrossChainTransfer(
        uint256 recipientPubKeyX,
        uint256 recipientPubKeyY,
        PendingTransfer memory pendingTransfer
    ) public {
        _getCStorageBridgeable()
        .failedCrossChainTransfers[pendingTransfer.sender].push(
            FailedCrossChainTransfer(recipientPubKeyX, recipientPubKeyY, pendingTransfer)
        );
    }

    function _cTransfer(address from, address to, uint256 amount) internal override {
        _transfer(from, to, amount);
    }

    function _cBurn(uint256 amount) internal override {
        _burn(address(this), amount);
    }

    function _cMint(uint256 amount) internal override {
        _mint(address(this), amount);
    }
}
