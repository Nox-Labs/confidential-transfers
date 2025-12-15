// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.28;

import {ConfidentialTransfers} from "./ConfidentialTransfers.sol";
import {
    Payload,
    TransferParams,
    InitParams,
    ApplyParams,
    UpdateParams,
    PendingTransfer
} from "./interface/IConfidentialTransfers.sol";

abstract contract ConfidentialTransfersBridgeable is ConfidentialTransfers {
    /* EXTERNAL */

    function cDeposit(UpdateParams calldata updateParams) public virtual override {
        super.cDeposit(updateParams);
        _cBurn(updateParams.amount);
    }

    function cWithdraw(UpdateParams calldata updateParams) public virtual override {
        _cMint(address(this), updateParams.amount);
        super.cWithdraw(updateParams);
    }

    /* INTERNAL */

    /**
     * @dev This function update receiver's pending transfers
     */
    function _cReceive(address recipient, PendingTransfer memory pendingTransfer) internal {
        _getConfidentialTransferStorage().accounts[recipient].pendingTransfers.push(pendingTransfer);
    }

    /**
     * @dev This function update sender's state and return the pending transfer to be bridged.
     */
    function _cSend(TransferParams calldata transferParams) internal returns (PendingTransfer memory pendingTransfer) {
        (Payload memory newState, Payload memory pendingTransferPayload) = _transfer(transferParams);

        _getConfidentialTransferStorage().accounts[msg.sender].state = newState;

        pendingTransfer = PendingTransfer(msg.sender, pendingTransferPayload, transferParams.transferAuditReports);
    }

    /* VIRTUAL INTERNAL */

    function _cBurn(uint256 amount) internal virtual;

    function _cMint(address account, uint256 amount) internal virtual;
}
