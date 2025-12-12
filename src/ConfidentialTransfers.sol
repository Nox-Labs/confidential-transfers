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
    Payload,
    PendingTransfer,
    InitParams,
    UpdateParams,
    TransferParams,
    ApplyParams,
    ApplyAndTransferParams,
    AuditReport
} from "./interface/IConfidentialTransfers.sol";

import {ArrayLib} from "./lib/ArrayLib.sol";
import {Initializable} from "./lib/Initializable.sol";

abstract contract ConfidentialTransfers is IConfidentialTransfers, Initializable {
    using ArrayLib for uint256[];
    using ArrayLib for PendingTransfer[];
    using ArrayLib for AuditReport[];

    /**
     * @dev Maximum number of pending transfers that can be applied at once, configured by circom circuit
     */
    uint8 constant MAX_PENDING_TRANSFERS_APPLY = 10;

    /// @custom:storage-location erc7201:confidentialTransfers
    struct ConfidentialTransfersStorage {
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
        Account storage account = _getConfidentialTransferStorage().accounts[msg.sender];
        account.state = _init(initParams);
        account.pubKey_X = initParams.artifacts.outputs[0];
        account.pubKey_Y = initParams.artifacts.outputs[1];
        account.auditReports = initParams.stateAuditReports;

        emit CInitialized(msg.sender, account.pubKey_X, account.pubKey_Y, account.state, account.auditReports);
    }

    function cTransfer(TransferParams calldata transferParams) public virtual {
        ConfidentialTransfersStorage storage $ = _getConfidentialTransferStorage();
        (Payload memory newState, Payload memory transferPackage) = _transfer(transferParams);

        Account storage account = $.accounts[msg.sender];
        account.state = newState;
        account.auditReports = transferParams.stateAuditReports;

        Account storage recipientAccount = $.accounts[transferParams.recipient];
        recipientAccount.pendingTransfers
            .push(PendingTransfer(msg.sender, transferPackage, transferParams.transferAuditReports));

        emit CTransferred(
            msg.sender,
            transferParams.recipient,
            newState,
            transferPackage,
            account.auditReports,
            transferParams.transferAuditReports
        );
    }

    function cApply(ApplyParams calldata applyParams) public virtual {
        ConfidentialTransfersStorage storage $ = _getConfidentialTransferStorage();
        Payload memory newState = _apply(applyParams);

        Account storage account = $.accounts[msg.sender];
        account.state = newState;
        account.auditReports = applyParams.stateAuditReports;
        account.pendingTransfers.removeByIndices(applyParams.pendingTransfersIndexes);

        emit CApplied(msg.sender, newState, account.auditReports);
    }

    function cDeposit(UpdateParams calldata updateParams) public virtual {
        _cTransfer(msg.sender, address(this), updateParams.amount);
        Payload memory newState = _update(0, updateParams);
        Account storage account = _getConfidentialTransferStorage().accounts[msg.sender];
        account.state = newState;
        account.auditReports = updateParams.stateAuditReports;

        emit CDeposited(msg.sender, updateParams.amount, newState, account.auditReports);
    }

    function cWithdraw(UpdateParams calldata updateParams) public virtual {
        Payload memory newState = _update(1, updateParams);
        Account storage account = _getConfidentialTransferStorage().accounts[msg.sender];
        account.state = newState;
        account.auditReports = updateParams.stateAuditReports;
        _cTransfer(address(this), msg.sender, updateParams.amount);

        emit CWithdrawn(msg.sender, updateParams.amount, newState, account.auditReports);
    }

    function cApplyAndTransfer(ApplyAndTransferParams calldata applyAndTransferParams) public virtual {
        ConfidentialTransfersStorage storage $ = _getConfidentialTransferStorage();
        (Payload memory newState, Payload memory pendingTransferPayload) = _applyAndTransfer(applyAndTransferParams);
        Account storage account = $.accounts[msg.sender];
        account.state = newState;
        account.auditReports = applyAndTransferParams.stateAuditReports;
        account.pendingTransfers.removeByIndices(applyAndTransferParams.pendingTransfersIndexes);

        Account storage recipientAccount = $.accounts[applyAndTransferParams.recipient];
        recipientAccount.pendingTransfers
            .push(PendingTransfer(msg.sender, pendingTransferPayload, applyAndTransferParams.transferAuditReports));
        emit CApplied(msg.sender, newState, account.auditReports);
        emit CTransferred(
            msg.sender,
            applyAndTransferParams.recipient,
            newState,
            pendingTransferPayload,
            applyAndTransferParams.stateAuditReports,
            applyAndTransferParams.transferAuditReports
        );
    }

    /* INTERNAL */

    function _init(InitParams calldata initParams)
        internal
        view
        checkArrayLength(4, initParams.artifacts.outputs.length)
        returns (Payload memory newState)
    {
        ConfidentialTransfersStorage storage $ = _getConfidentialTransferStorage();
        Account storage account = $.accounts[msg.sender];

        if (account.state.commitment != 0) revert AccountAlreadyInitialized();

        uint256[24] memory proof = initParams.artifacts.proof.toFixed24();
        uint256[4] memory pubSignals = [
            initParams.artifacts.outputs[0],
            initParams.artifacts.outputs[1],
            initParams.artifacts.outputs[2],
            initParams.artifacts.outputs[3]
        ];

        if (!$.initVerifier.verifyProof(proof, pubSignals)) revert ProofVerificationFailed();

        newState = Payload({nonce: 0, commitment: pubSignals[2], eAmount: pubSignals[3]});
    }

    function _update(uint8 operation, UpdateParams calldata updateParams)
        internal
        view
        checkArrayLength(2, updateParams.artifacts.outputs.length)
        onlyInitialized
        returns (Payload memory newState)
    {
        ConfidentialTransfersStorage storage $ = _getConfidentialTransferStorage();
        Account storage account = $.accounts[msg.sender];

        uint256[24] memory proof = updateParams.artifacts.proof.toFixed24();
        uint256[6] memory pubSignals = [
            updateParams.artifacts.outputs[0],
            updateParams.artifacts.outputs[1],
            operation,
            updateParams.amount,
            account.state.nonce,
            account.state.commitment
        ];

        if (!$.updateVerifier.verifyProof(proof, pubSignals)) revert ProofVerificationFailed();

        newState = Payload({nonce: account.state.nonce + 1, commitment: pubSignals[0], eAmount: pubSignals[1]});
    }

    function _transfer(TransferParams calldata transferParams)
        internal
        view
        checkArrayLength(4, transferParams.artifacts.outputs.length)
        onlyInitialized
        returns (Payload memory newState, Payload memory pendingTransferPackage)
    {
        ConfidentialTransfersStorage storage $ = _getConfidentialTransferStorage();
        Account storage account = $.accounts[msg.sender];
        Account storage recipientAccount = $.accounts[transferParams.recipient];

        if (recipientAccount.pendingTransfers.length >= $.maxPendingTransfers) revert MaxPendingTransfersReached();

        uint256[24] memory proof = transferParams.artifacts.proof.toFixed24();
        uint256[8] memory pubSignals = [
            transferParams.artifacts.outputs[0],
            transferParams.artifacts.outputs[1],
            transferParams.artifacts.outputs[2],
            transferParams.artifacts.outputs[3],
            account.state.nonce,
            account.state.commitment,
            recipientAccount.pubKey_X,
            recipientAccount.pubKey_Y
        ];

        if (!$.transferVerifier.verifyProof(proof, pubSignals)) revert ProofVerificationFailed();

        newState = Payload({nonce: account.state.nonce + 1, commitment: pubSignals[0], eAmount: pubSignals[1]});

        pendingTransferPackage =
            Payload({nonce: account.state.nonce + 1, commitment: pubSignals[2], eAmount: pubSignals[3]});
    }

    function _apply(ApplyParams calldata applyParams)
        internal
        view
        checkArrayLength(2, applyParams.artifacts.outputs.length)
        onlyInitialized
        returns (Payload memory newState)
    {
        ConfidentialTransfersStorage storage $ = _getConfidentialTransferStorage();

        Account storage account = $.accounts[msg.sender];

        uint256 n = applyParams.pendingTransfersIndexes.length;

        if (n > account.pendingTransfers.length || n == 0) revert InvalidPendingTransfersIndexes();

        uint256[5 + MAX_PENDING_TRANSFERS_APPLY] memory pubSignals;
        pubSignals[0] = applyParams.artifacts.outputs[0];
        pubSignals[1] = applyParams.artifacts.outputs[1];
        pubSignals[2] = n;
        pubSignals[3] = account.state.nonce;
        pubSignals[4] = account.state.commitment;

        for (uint256 i = 0; i < MAX_PENDING_TRANSFERS_APPLY; i++) {
            if (i < n) {
                uint256 targetIndex = applyParams.pendingTransfersIndexes[i];
                pubSignals[5 + i] = uint256(account.pendingTransfers[targetIndex].payload.commitment);
            } else {
                pubSignals[5 + i] = 0;
            }
        }
        uint256[24] memory proof = applyParams.artifacts.proof.toFixed24();

        if (!$.applyVerifier.verifyProof(proof, pubSignals)) revert ProofVerificationFailed();

        newState = Payload({nonce: account.state.nonce + 1, commitment: pubSignals[0], eAmount: pubSignals[1]});
    }

    function _applyAndTransfer(ApplyAndTransferParams calldata applyAndTransferParams)
        internal
        view
        checkArrayLength(4, applyAndTransferParams.artifacts.outputs.length)
        onlyInitialized
        returns (Payload memory newState, Payload memory pendingTransfer)
    {
        ConfidentialTransfersStorage storage $ = _getConfidentialTransferStorage();
        Account storage account = $.accounts[msg.sender];
        Account storage recipientAccount = $.accounts[applyAndTransferParams.recipient];

        if (recipientAccount.pendingTransfers.length >= $.maxPendingTransfers) revert MaxPendingTransfersReached();

        uint256 n = applyAndTransferParams.pendingTransfersIndexes.length;

        if (n > account.pendingTransfers.length || n == 0) revert InvalidPendingTransfersIndexes();

        uint256[24] memory proof = applyAndTransferParams.artifacts.proof.toFixed24();
        uint256[9 + MAX_PENDING_TRANSFERS_APPLY] memory pubSignals;
        pubSignals[0] = applyAndTransferParams.artifacts.outputs[0];
        pubSignals[1] = applyAndTransferParams.artifacts.outputs[1];
        pubSignals[2] = applyAndTransferParams.artifacts.outputs[2];
        pubSignals[3] = applyAndTransferParams.artifacts.outputs[3];
        pubSignals[4] = account.state.nonce;
        pubSignals[5] = account.state.commitment;
        pubSignals[6] = recipientAccount.pubKey_X;
        pubSignals[7] = recipientAccount.pubKey_Y;
        pubSignals[8] = n;

        for (uint256 i = 0; i < MAX_PENDING_TRANSFERS_APPLY; i++) {
            if (i < n) {
                uint256 targetIndex = applyAndTransferParams.pendingTransfersIndexes[i];
                pubSignals[9 + i] = uint256(account.pendingTransfers[targetIndex].payload.commitment);
            } else {
                pubSignals[9 + i] = 0;
            }
        }

        if (!$.applyAndTransferVerifier.verifyProof(proof, pubSignals)) revert ProofVerificationFailed();

        newState = Payload({nonce: account.state.nonce + 1, commitment: pubSignals[0], eAmount: pubSignals[1]});
        pendingTransfer = Payload({nonce: account.state.nonce + 1, commitment: pubSignals[2], eAmount: pubSignals[3]});
    }

    /* INTERNAL VIRTUAL */

    /**
     * @notice This function should transfer public ERC20 tokens
     */
    function _cTransfer(address from, address to, uint256 amount) internal virtual;

    /* VIEW */

    function getAccount(address account) public view returns (Account memory) {
        return _getConfidentialTransferStorage().accounts[account];
    }

    function getCPublicKeys(address[] calldata accounts)
        public
        view
        returns (uint256[] memory pubKey_Xs, uint256[] memory pubKey_Ys)
    {
        ConfidentialTransfersStorage storage $ = _getConfidentialTransferStorage();
        pubKey_Xs = new uint256[](accounts.length);
        pubKey_Ys = new uint256[](accounts.length);
        for (uint256 i = 0; i < accounts.length; i++) {
            Account storage account = $.accounts[accounts[i]];
            pubKey_Xs[i] = account.pubKey_X;
            pubKey_Ys[i] = account.pubKey_Y;
        }
    }

    /* ADMIN */

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
