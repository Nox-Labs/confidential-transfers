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
        // TODO: Validate recipient's public key
        // TODO: Validate audit reports
        // We can implement one of these approaches to be able to validate:
        // 1. Implement a new function that will work like setPeer
        // where each account should wire src and dst chains by calling it and insure that his
        // account public keys matches the public keys of the other chain
        // 2. Transfer public keys from src chain and (a) if account doesn't initialized yet,
        // make soft initialization only with public keys, (b) but if account already initialized,
        // and public keys mismatch, send this pending transfer back to src chain and add it to
        // recipient's pending transfers queue
        // 3. Update init circuit and allow only one confidential keys derivation path, after that
        // it would be impossible to initialize accounts with different confidential keys.
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
