// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.28;

import {ConfidentialTransfers} from "./ConfidentialTransfers.sol";
import {
    Payload,
    PendingTransfer,
    TransferParams,
    UpdateParams
} from "./interface/IConfidentialTransfers.sol";

abstract contract ConfidentialTransfersBridgeable is ConfidentialTransfers {
    /* EXTERNAL */

    function cDeposit(UpdateParams calldata updateParams) public virtual override {
        super.cDeposit(updateParams);
        _cBurn(updateParams.amount);
    }

    function cWithdraw(UpdateParams calldata updateParams) public virtual override {
        _cMint(updateParams.amount);
        super.cWithdraw(updateParams);
    }

    /* INTERNAL */

    /**
     * @dev This function update receiver's pending transfers
     * @dev Should be called by bridge receiver function.
     */
    function _cReceive(address recipient, PendingTransfer memory pendingTransfer) internal {
        _getConfidentialTransferStorage().accounts[recipient].pendingTransfers.push(pendingTransfer);
    }

    /**
     * @dev This function update sender's state and return the pending transfer to be bridged.
     * @dev Should be called by bridge sender function.
     */
    function _cSend(TransferParams calldata transferParams)
        internal
        returns (Payload memory newState, PendingTransfer memory pendingTransfer)
    {
        Payload memory pendingTransferPayload;

        (newState, pendingTransferPayload) = _transfer(transferParams);

        _getConfidentialTransferStorage().accounts[msg.sender].state = newState;

        pendingTransfer = PendingTransfer(
            msg.sender, pendingTransferPayload, transferParams.transferAuditReports
        );
    }

    /* VIRTUAL INTERNAL */

    function _cBurn(uint256 amount) internal virtual;

    function _cMint(uint256 amount) internal virtual;
}
