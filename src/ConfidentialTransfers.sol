// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.28;

import {PlonkVerifier as InitPlonkVerifier} from "./verifiers/InitPlonkVerifier.sol";
import {PlonkVerifier as ApplyPlonkVerifier} from "./verifiers/ApplyPlonkVerifier.sol";
import {PlonkVerifier as UpdatePlonkVerifier} from "./verifiers/UpdatePlonkVerifier.sol";
import {PlonkVerifier as TransferPlonkVerifier} from "./verifiers/TransferPlonkVerifier.sol";
import {PlonkVerifier as ApplyAndTransferPlonkVerifier} from "./verifiers/ApplyAndTransferPlonkVerifier.sol";

import {
    IConfidentialTransfers,
    Account,
    Package,
    InitParams,
    UpdateParams,
    TransferParams,
    ApplyParams,
    ApplyAndTransferParams
} from "./interface/IConfidentialTransfers.sol";

import {ArrayLib} from "./lib/ArrayLib.sol";
import {Initializable} from "./lib/Initializable.sol";

abstract contract ConfidentialTransfers is IConfidentialTransfers, Initializable {
    using ArrayLib for uint256[];
    using ArrayLib for Package[];

    /**
     * @dev Maximum number of pending transfers that can be applied at once, configured by circom circuit
     */
    uint8 constant MAX_PENDING_TRANSFERS_APPLY = 10;

    /// @custom:storage-location erc7201:confidentialTransfers
    struct ConfidentialTransfersStorage {
        address auditor;
        uint256 maxPendingTransfers;
        InitPlonkVerifier initVerifier;
        ApplyPlonkVerifier applyVerifier;
        UpdatePlonkVerifier updateVerifier;
        TransferPlonkVerifier transferVerifier;
        ApplyAndTransferPlonkVerifier applyAndTransferVerifier;
        mapping(address account => Account) accounts;
    }

    // keccak256(abi.encode(uint256(keccak256("ConfidentialTransfersStorage")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant CONFIDENTIAL_TRANSFERS_STORAGE_POSITION =
        0x74fe0b1f91feaaa95d609d18323a1d882fca941a422b86d407dc143fbb562900;

    function _getConfidentialTransferStorage() internal pure returns (ConfidentialTransfersStorage storage $) {
        assembly {
            $.slot := CONFIDENTIAL_TRANSFERS_STORAGE_POSITION
        }
    }

    function __ConfidentialTransfers_init(
        uint256 _maxPendingTransfers,
        InitPlonkVerifier _initVerifier,
        ApplyPlonkVerifier _applyVerifier,
        UpdatePlonkVerifier _updateVerifier,
        TransferPlonkVerifier _transferVerifier,
        ApplyAndTransferPlonkVerifier _applyAndTransferVerifier
    ) internal onlyInitializing {
        ConfidentialTransfersStorage storage s = _getConfidentialTransferStorage();
        s.initVerifier = _initVerifier;
        s.applyVerifier = _applyVerifier;
        s.updateVerifier = _updateVerifier;
        s.transferVerifier = _transferVerifier;
        s.maxPendingTransfers = _maxPendingTransfers;
        s.applyAndTransferVerifier = _applyAndTransferVerifier;
    }

    /* EXTERNAL */

    function cInit(InitParams calldata initParams) public virtual {
        _getConfidentialTransferStorage().accounts[msg.sender].state = _init(initParams);
    }

    function cTransfer(TransferParams calldata transferParams) public virtual {
        ConfidentialTransfersStorage storage $ = _getConfidentialTransferStorage();
        (Package memory newState, Package memory pendingTransfer) = _transfer(transferParams);
        $.accounts[msg.sender].state = newState;
        $.accounts[transferParams.recipient].pendingTransfers.push(pendingTransfer);
    }

    function cApply(ApplyParams calldata applyParams) public virtual {
        ConfidentialTransfersStorage storage $ = _getConfidentialTransferStorage();
        Package memory newState = _apply(applyParams);
        Account storage account = $.accounts[msg.sender];
        account.state = newState;
        account.pendingTransfers.removeByIndices(applyParams.pendingTransfersIndexes);
    }

    function cDeposit(UpdateParams calldata updateParams) public virtual {
        Package memory newState = _update(0, updateParams);
        _getConfidentialTransferStorage().accounts[msg.sender].state = newState;
        _cTransfer(msg.sender, address(this), updateParams.amount);
    }

    function cWithdraw(UpdateParams calldata updateParams) public virtual {
        Package memory newState = _update(1, updateParams);
        _getConfidentialTransferStorage().accounts[msg.sender].state = newState;
        _cTransfer(address(this), msg.sender, updateParams.amount);
    }

    function cApplyAndTransfer(ApplyAndTransferParams calldata applyAndTransferParams) public virtual {
        ConfidentialTransfersStorage storage $ = _getConfidentialTransferStorage();
        (Package memory newState, Package memory pendingTransfer) = _applyAndTransfer(applyAndTransferParams);
        $.accounts[msg.sender].state = newState;
        $.accounts[msg.sender].pendingTransfers.removeByIndices(applyAndTransferParams.pendingTransfersIndexes);
        $.accounts[applyAndTransferParams.recipient].pendingTransfers.push(pendingTransfer);
    }

    /* INTERNAL */

    function _update(uint8 operation, UpdateParams calldata updateParams)
        internal
        view
        checkArrayLength(3, updateParams.artifacts.outputs.length)
        onlyInitialized
        returns (Package memory newState)
    {
        ConfidentialTransfersStorage storage $ = _getConfidentialTransferStorage();
        Account storage account = $.accounts[msg.sender];

        (uint256 auditorPublicKey_X, uint256 auditorPublicKey_Y) = getAuditorPublicKey();

        uint256[24] memory proof = updateParams.artifacts.proof.toFixed24();
        uint256[9] memory pubSignals = [
            updateParams.artifacts.outputs[0],
            updateParams.artifacts.outputs[1],
            updateParams.artifacts.outputs[2],
            auditorPublicKey_X,
            auditorPublicKey_Y,
            operation,
            updateParams.amount,
            account.state.nonce,
            account.state.commitment
        ];

        if (!$.updateVerifier.verifyProof(proof, pubSignals)) revert ProofVerificationFailed();

        newState = Package({
            nonce: account.state.nonce + 1,
            pubKey_X: account.state.pubKey_X,
            pubKey_Y: account.state.pubKey_Y,
            commitment: pubSignals[0],
            eAmount: pubSignals[1],
            eAmountForAuditor: pubSignals[2]
        });
    }

    function _init(InitParams calldata initParams)
        internal
        view
        checkArrayLength(5, initParams.artifacts.outputs.length)
        returns (Package memory newState)
    {
        ConfidentialTransfersStorage storage $ = _getConfidentialTransferStorage();
        Account storage account = $.accounts[msg.sender];

        if (account.state.commitment != 0) revert AccountAlreadyInitialized();

        (uint256 auditorPublicKey_X, uint256 auditorPublicKey_Y) = getAuditorPublicKey();

        uint256[24] memory proof = initParams.artifacts.proof.toFixed24();
        uint256[7] memory pubSignals = [
            initParams.artifacts.outputs[0],
            initParams.artifacts.outputs[1],
            initParams.artifacts.outputs[2],
            initParams.artifacts.outputs[3],
            initParams.artifacts.outputs[4],
            auditorPublicKey_X,
            auditorPublicKey_Y
        ];

        if (!$.initVerifier.verifyProof(proof, pubSignals)) revert ProofVerificationFailed();

        newState = Package({
            nonce: 0,
            pubKey_X: pubSignals[0],
            pubKey_Y: pubSignals[1],
            commitment: pubSignals[2],
            eAmount: pubSignals[3],
            eAmountForAuditor: pubSignals[4]
        });
    }

    function _transfer(TransferParams calldata transferParams)
        internal
        view
        checkArrayLength(6, transferParams.artifacts.outputs.length)
        onlyInitialized
        returns (Package memory newState, Package memory pendingTransfer)
    {
        ConfidentialTransfersStorage storage $ = _getConfidentialTransferStorage();
        Account storage account = $.accounts[msg.sender];
        Account storage recipientAccount = $.accounts[transferParams.recipient];

        if (recipientAccount.pendingTransfers.length >= $.maxPendingTransfers) revert MaxPendingTransfersReached();

        (uint256 auditorPublicKey_X, uint256 auditorPublicKey_Y) = getAuditorPublicKey();

        uint256[24] memory proof = transferParams.artifacts.proof.toFixed24();
        uint256[12] memory pubSignals = [
            transferParams.artifacts.outputs[0],
            transferParams.artifacts.outputs[1],
            transferParams.artifacts.outputs[2],
            transferParams.artifacts.outputs[3],
            transferParams.artifacts.outputs[4],
            transferParams.artifacts.outputs[5],
            auditorPublicKey_X,
            auditorPublicKey_Y,
            account.state.nonce,
            account.state.commitment,
            recipientAccount.state.pubKey_X,
            recipientAccount.state.pubKey_Y
        ];

        if (!$.transferVerifier.verifyProof(proof, pubSignals)) revert ProofVerificationFailed();

        newState = Package({
            nonce: account.state.nonce + 1,
            pubKey_X: account.state.pubKey_X,
            pubKey_Y: account.state.pubKey_Y,
            commitment: pubSignals[0],
            eAmount: pubSignals[1],
            eAmountForAuditor: pubSignals[2]
        });

        pendingTransfer = Package({
            nonce: account.state.nonce + 1,
            pubKey_X: account.state.pubKey_X,
            pubKey_Y: account.state.pubKey_Y,
            commitment: pubSignals[3],
            eAmount: pubSignals[4],
            eAmountForAuditor: pubSignals[5]
        });
    }

    function _apply(ApplyParams calldata applyParams)
        internal
        view
        checkArrayLength(3, applyParams.artifacts.outputs.length)
        onlyInitialized
        returns (Package memory newState)
    {
        ConfidentialTransfersStorage storage $ = _getConfidentialTransferStorage();

        Account storage account = $.accounts[msg.sender];

        uint256 n = applyParams.pendingTransfersIndexes.length;

        if (n > account.pendingTransfers.length || n == 0) revert InvalidPendingTransfersIndexes();

        (uint256 auditorPublicKey_X, uint256 auditorPublicKey_Y) = getAuditorPublicKey();

        uint256[8 + MAX_PENDING_TRANSFERS_APPLY] memory pubSignals;
        pubSignals[0] = applyParams.artifacts.outputs[0];
        pubSignals[1] = applyParams.artifacts.outputs[1];
        pubSignals[2] = applyParams.artifacts.outputs[2];
        pubSignals[3] = auditorPublicKey_X;
        pubSignals[4] = auditorPublicKey_Y;
        pubSignals[5] = n;
        pubSignals[6] = account.state.nonce;
        pubSignals[7] = account.state.commitment;

        for (uint256 i = 0; i < MAX_PENDING_TRANSFERS_APPLY; i++) {
            if (i < n) {
                uint256 targetIndex = applyParams.pendingTransfersIndexes[i];
                pubSignals[8 + i] = uint256(account.pendingTransfers[targetIndex].commitment);
            } else {
                pubSignals[8 + i] = 0;
            }
        }
        uint256[24] memory proof = applyParams.artifacts.proof.toFixed24();

        if (!$.applyVerifier.verifyProof(proof, pubSignals)) revert ProofVerificationFailed();

        newState = Package({
            nonce: account.state.nonce + 1,
            pubKey_X: account.state.pubKey_X,
            pubKey_Y: account.state.pubKey_Y,
            commitment: pubSignals[0],
            eAmount: pubSignals[1],
            eAmountForAuditor: pubSignals[2]
        });
    }

    function _applyAndTransfer(ApplyAndTransferParams calldata applyAndTransferParams)
        internal
        view
        checkArrayLength(6, applyAndTransferParams.artifacts.outputs.length)
        onlyInitialized
        returns (Package memory newState, Package memory pendingTransfer)
    {
        ConfidentialTransfersStorage storage $ = _getConfidentialTransferStorage();
        Account storage account = $.accounts[msg.sender];
        Account storage recipientAccount = $.accounts[applyAndTransferParams.recipient];

        if (recipientAccount.pendingTransfers.length >= $.maxPendingTransfers) revert MaxPendingTransfersReached();

        uint256 n = applyAndTransferParams.pendingTransfersIndexes.length;

        if (n > account.pendingTransfers.length || n == 0) revert InvalidPendingTransfersIndexes();

        (uint256 auditorPublicKey_X, uint256 auditorPublicKey_Y) = getAuditorPublicKey();

        uint256[24] memory proof = applyAndTransferParams.artifacts.proof.toFixed24();
        uint256[13 + MAX_PENDING_TRANSFERS_APPLY] memory pubSignals;
        pubSignals[0] = applyAndTransferParams.artifacts.outputs[0];
        pubSignals[1] = applyAndTransferParams.artifacts.outputs[1];
        pubSignals[2] = applyAndTransferParams.artifacts.outputs[2];
        pubSignals[3] = applyAndTransferParams.artifacts.outputs[3];
        pubSignals[4] = applyAndTransferParams.artifacts.outputs[4];
        pubSignals[5] = applyAndTransferParams.artifacts.outputs[5];
        pubSignals[6] = auditorPublicKey_X;
        pubSignals[7] = auditorPublicKey_Y;
        pubSignals[8] = account.state.nonce;
        pubSignals[9] = account.state.commitment;
        pubSignals[10] = recipientAccount.state.pubKey_X;
        pubSignals[11] = recipientAccount.state.pubKey_Y;
        pubSignals[12] = n;

        for (uint256 i = 0; i < MAX_PENDING_TRANSFERS_APPLY; i++) {
            if (i < n) {
                uint256 targetIndex = applyAndTransferParams.pendingTransfersIndexes[i];
                pubSignals[13 + i] = uint256(account.pendingTransfers[targetIndex].commitment);
            } else {
                pubSignals[13 + i] = 0;
            }
        }

        if (!$.applyAndTransferVerifier.verifyProof(proof, pubSignals)) revert ProofVerificationFailed();

        newState = Package({
            nonce: account.state.nonce + 1,
            pubKey_X: account.state.pubKey_X,
            pubKey_Y: account.state.pubKey_Y,
            commitment: pubSignals[0],
            eAmount: pubSignals[1],
            eAmountForAuditor: pubSignals[2]
        });

        pendingTransfer = Package({
            nonce: account.state.nonce + 1,
            pubKey_X: account.state.pubKey_X,
            pubKey_Y: account.state.pubKey_Y,
            commitment: pubSignals[3],
            eAmount: pubSignals[4],
            eAmountForAuditor: pubSignals[5]
        });
    }

    /* INTERNAL VIRTUAL */

    /**
     * @notice This function should transfer public ERC20 tokens
     */
    function _cTransfer(address from, address to, uint256 amount) internal virtual;

    function _authorizeAuditorChange() internal virtual;

    /* VIEW */

    function getAccount(address account) public view returns (Account memory) {
        return _getConfidentialTransferStorage().accounts[account];
    }

    function getAuditorPublicKey() public view returns (uint256 publicKey_X, uint256 publicKey_Y) {
        ConfidentialTransfersStorage storage $ = _getConfidentialTransferStorage();
        Account storage auditor = $.accounts[$.auditor];
        return (auditor.state.pubKey_X, auditor.state.pubKey_Y);
    }

    /* ADMIN */

    function setAuditor(address auditor) public virtual {
        _authorizeAuditorChange();
        _getConfidentialTransferStorage().auditor = auditor;
    }

    /* MODIFIERS */

    modifier checkArrayLength(uint256 expected, uint256 actual) {
        if (actual != expected) revert InvalidArrayLength(expected, actual);
        _;
    }

    modifier onlyInitialized() {
        if (_getConfidentialTransferStorage().accounts[msg.sender].state.commitment == 0) {
            revert AccountNotInitialized();
        }
        _;
    }
}
