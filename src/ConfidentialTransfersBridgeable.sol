// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.28;

import {ConfidentialTransfers} from "./ConfidentialTransfers.sol";
import {Package, TransferParams, InitParams, ApplyParams, UpdateParams} from "./interface/IConfidentialTransfers.sol";

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

    //! TODO: If auditor on src chain and dst chain is different,
    //! we need to validate that `pendingTransfer.eAmountForAuditor` is valid for the auditor on the dst chain.
    /**
     * @dev This function update receiver's pending transfers
     */
    function _cReceive(Package memory pendingTransfer) internal {
        _getConfidentialTransferStorage().accounts[msg.sender].pendingTransfers.push(pendingTransfer);
    }

    /**
     * @dev This function update sender's state and return the pending transfer to be bridged.
     */
    function _cSend(TransferParams calldata transferParams) internal returns (Package memory) {
        (Package memory newState, Package memory pendingTransfer) = _transfer(transferParams);

        _getConfidentialTransferStorage().accounts[msg.sender].state = newState;

        return pendingTransfer;
    }

    /* VIRTUAL INTERNAL */

    function _cBurn(uint256 amount) internal virtual;

    function _cMint(address account, uint256 amount) internal virtual;
}
