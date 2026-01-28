// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.28;

import {PlonkVerifier as ApplyAndTransferPlonkVerifier} from "./verifiers/ApplyAndTransferPlonkVerifier.sol";
import {PlonkVerifier as ApplyPlonkVerifier} from "./verifiers/ApplyPlonkVerifier.sol";
import {PlonkVerifier as InitPlonkVerifier} from "./verifiers/InitPlonkVerifier.sol";
import {PlonkVerifier as TransferPlonkVerifier} from "./verifiers/TransferPlonkVerifier.sol";
import {PlonkVerifier as UpdatePlonkVerifier} from "./verifiers/UpdatePlonkVerifier.sol";

import {
    Account,
    ApplyAndTransferParams,
    ApplyParams,
    AuditReport,
    IConfidentialTransfers,
    InitParams,
    Payload,
    PendingTransfer,
    TransferParams,
    UpdateParams
} from "./interface/IConfidentialTransfers.sol";

import {ArrayLib} from "./lib/ArrayLib.sol";

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

/**
 * @title ConfidentialTransfers
 * @notice Abstract contract implementing the core logic for confidential token transfers using ZK proofs.
 * @dev Handles initialization, deposits, withdrawals, and 2-step confidential transfers, zk verification keys and user confidential states.
 * @dev Do not inherit ERC20 logic.
 * @notice Contract doesn't validate that reports for auditors are valid. It's only validate that required auditors are added.
 */
abstract contract ConfidentialTransfers is IConfidentialTransfers, Initializable {
    using ArrayLib for uint256[];
    using ArrayLib for address[];
    using ArrayLib for PendingTransfer[];
    using ArrayLib for AuditReport[];

    /**
     * @dev Maximum number that can be applied at once, configured by circom circuit
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

    function _getCStorage() internal pure returns (ConfidentialTransfersStorage storage $) {
        assembly {
            $.slot := CONFIDENTIAL_TRANSFERS_STORAGE_POSITION
        }
    }

    /**
     * @notice Initialize the ConfidentialTransfers contract
     * @dev Must be called in the constructor/initializer of the contract.
     * @param _maxPendingTransfers Maximum number of pending transfers per account (protects against DoS attacks)
     */
    function __ConfidentialTransfers_init(
        uint256 _maxPendingTransfers,
        InitPlonkVerifier _initVerifier,
        ApplyPlonkVerifier _applyVerifier,
        UpdatePlonkVerifier _updateVerifier,
        TransferPlonkVerifier _transferVerifier,
        ApplyAndTransferPlonkVerifier _applyAndTransferVerifier
    ) internal onlyInitializing {
        ConfidentialTransfersStorage storage s = _getCStorage();
        s.initVerifier = _initVerifier;
        s.applyVerifier = _applyVerifier;
        s.updateVerifier = _updateVerifier;
        s.transferVerifier = _transferVerifier;
        s.maxPendingTransfers = _maxPendingTransfers;
        s.applyAndTransferVerifier = _applyAndTransferVerifier;
    }

    /**
     * @notice Initializes a confidential account
     * @dev Checks if account is already initialized and verifies the proof
     * @param params Initialization parameters including ZK proof
     */
    function cInit(InitParams calldata params)
        public
        virtual
        checkRequiredAuditor(msg.sender, params.stateAuditReports)
    {
        Account storage account = _getCStorage().accounts[msg.sender];

        if (account.state.commitment != 0) revert AccountAlreadyInitialized();

        account.state = _init(params);
        account.pubKeyX = params.artifacts.outputs[0];
        account.pubKeyY = params.artifacts.outputs[1];
        account.auditReports = params.stateAuditReports;

        emit CInitialized(msg.sender, account.pubKeyX, account.pubKeyY, account.state, account.auditReports);
    }

    /**
     * @notice Deposits public tokens into the confidential state
     * @dev Transfers public tokens to this contract and updates confidential balance
     * @param params Deposit parameters including ZK proof
     */
    function cDeposit(UpdateParams calldata params)
        public
        virtual
        onlyInitialized(msg.sender)
        checkRequiredAuditor(msg.sender, params.stateAuditReports)
    {
        _cTransfer(msg.sender, address(this), params.amount);
        Payload memory newState = _update(0, params);
        Account storage account = _getCStorage().accounts[msg.sender];
        account.state = newState;
        account.auditReports = params.stateAuditReports;

        emit CDeposited(msg.sender, params.amount, newState, account.auditReports);
    }

    /**
     * @notice Withdraws confidential tokens to public state
     * @dev Updates confidential balance and transfers public tokens to the user
     * @param params Withdraw parameters including ZK proof
     */
    function cWithdraw(UpdateParams calldata params)
        public
        virtual
        onlyInitialized(msg.sender)
        checkRequiredAuditor(msg.sender, params.stateAuditReports)
    {
        Payload memory newState = _update(1, params);
        Account storage account = _getCStorage().accounts[msg.sender];
        account.state = newState;
        account.auditReports = params.stateAuditReports;
        _cTransfer(address(this), msg.sender, params.amount);

        emit CWithdrawn(msg.sender, params.amount, newState, account.auditReports);
    }

    /**
     * @notice Applies pending transfers to the user's confidential balance
     * @dev Verifies proof and removes applied transfers from the queue
     * @param params Apply parameters including indices of transfers to apply
     */
    function cApply(ApplyParams calldata params)
        public
        virtual
        onlyInitialized(msg.sender)
        checkRequiredAuditor(msg.sender, params.stateAuditReports)
    {
        ConfidentialTransfersStorage storage $ = _getCStorage();
        Payload memory newState = _apply(params);

        Account storage account = $.accounts[msg.sender];
        account.state = newState;
        account.auditReports = params.stateAuditReports;
        account.pendingTransfers.removeByIndices(params.pendingTransfersIndexes);

        emit CApplied(msg.sender, newState, account.auditReports);
    }

    /**
     * @notice Transfers confidential tokens to another user
     * @dev Verifies proof and adds a pending transfer to the recipient's queue
     * @param params Transfer parameters including recipient and ZK proof
     */
    function cTransfer(TransferParams calldata params)
        public
        virtual
        onlyInitialized(msg.sender)
        onlyInitialized(params.recipient)
        checkRequiredAuditor(msg.sender, params.stateAuditReports)
        checkRequiredAuditor(msg.sender, params.transferAuditReports)
        checkRequiredAuditor(params.recipient, params.transferAuditReports)
    {
        ConfidentialTransfersStorage storage $ = _getCStorage();
        (Payload memory newState, Payload memory transferPackage) = _transfer(params);

        Account storage account = $.accounts[msg.sender];
        account.state = newState;
        account.auditReports = params.stateAuditReports;

        Account storage recipientAccount = $.accounts[params.recipient];
        recipientAccount.pendingTransfers
            .push(PendingTransfer(msg.sender, transferPackage, params.transferAuditReports));

        emit CTransferred(
            msg.sender,
            params.recipient,
            newState,
            transferPackage,
            account.auditReports,
            params.transferAuditReports,
            params.extraData
        );
    }

    /**
     * @notice Applies pending transfers and sends a new transfer in one transaction
     * @dev Optimizes gas by combining apply and transfer operations
     * @param params Combined parameters for apply and transfer operations
     */
    function cApplyAndTransfer(ApplyAndTransferParams calldata params)
        public
        virtual
        onlyInitialized(msg.sender)
        onlyInitialized(params.recipient)
        checkRequiredAuditor(msg.sender, params.stateAuditReports)
        checkRequiredAuditor(msg.sender, params.transferAuditReports)
        checkRequiredAuditor(params.recipient, params.transferAuditReports)
    {
        ConfidentialTransfersStorage storage $ = _getCStorage();
        (Payload memory newState, Payload memory pendingTransferPayload) = _applyAndTransfer(params);
        Account storage account = $.accounts[msg.sender];
        account.state = newState;
        account.auditReports = params.stateAuditReports;
        account.pendingTransfers.removeByIndices(params.pendingTransfersIndexes);

        Account storage recipientAccount = $.accounts[params.recipient];
        recipientAccount.pendingTransfers
            .push(PendingTransfer(msg.sender, pendingTransferPayload, params.transferAuditReports));
        emit CApplied(msg.sender, newState, account.auditReports);
        emit CTransferred(
            msg.sender,
            params.recipient,
            newState,
            pendingTransferPayload,
            params.stateAuditReports,
            params.transferAuditReports,
            params.extraData
        );
    }

    /**
     * @notice Adds an auditor that must audit all operations for this account
     * @dev This mechanism is used to ensure that while building tx users don't forget adding auditors
     * @param auditor Address of the auditor to add
     */
    function addRequiredAuditor(address auditor) public virtual onlyInitialized(auditor) {
        _getCStorage().accounts[msg.sender].requiredAuditors.push(auditor);
        emit RequiredAuditorAdded(msg.sender, auditor);
    }

    /**
     * @notice Removes a required auditor
     * @param auditor Address of the auditor to remove
     */
    function removeRequiredAuditor(address auditor) public virtual {
        _getCStorage().accounts[msg.sender].requiredAuditors.remove(auditor);
        emit RequiredAuditorRemoved(msg.sender, auditor);
    }

    /* INTERNAL */

    function _init(InitParams calldata params)
        internal
        view
        checkArrayLength(4, params.artifacts.outputs.length)
        returns (Payload memory newState)
    {
        ConfidentialTransfersStorage storage $ = _getCStorage();

        uint256[24] memory proof = params.artifacts.proof.toFixed24();
        uint256[6] memory pubSignals = [
            params.artifacts.outputs[0],
            params.artifacts.outputs[1],
            params.artifacts.outputs[2],
            params.artifacts.outputs[3],
            block.chainid,
            uint160(address(this))
        ];

        if (!$.initVerifier.verifyProof(proof, pubSignals)) revert ProofVerificationFailed();

        newState = Payload({nonce: 0, commitment: pubSignals[2], eAmount: pubSignals[3]});
    }

    function _update(uint8 operation, UpdateParams calldata params)
        internal
        view
        checkArrayLength(2, params.artifacts.outputs.length)
        returns (Payload memory newState)
    {
        ConfidentialTransfersStorage storage $ = _getCStorage();
        Account storage account = $.accounts[msg.sender];

        uint256[24] memory proof = params.artifacts.proof.toFixed24();
        uint256[8] memory pubSignals = [
            params.artifacts.outputs[0],
            params.artifacts.outputs[1],
            block.chainid,
            uint160(address(this)),
            operation,
            params.amount,
            account.state.nonce,
            account.state.commitment
        ];

        if (!$.updateVerifier.verifyProof(proof, pubSignals)) revert ProofVerificationFailed();

        newState = Payload({nonce: account.state.nonce + 1, commitment: pubSignals[0], eAmount: pubSignals[1]});
    }

    function _transfer(TransferParams calldata params)
        internal
        view
        checkArrayLength(4, params.artifacts.outputs.length)
        checkMaxPendingTransfers(params.recipient)
        returns (Payload memory newState, Payload memory pendingTransferPackage)
    {
        ConfidentialTransfersStorage storage $ = _getCStorage();
        Account storage account = $.accounts[msg.sender];
        Account storage recipientAccount = $.accounts[params.recipient];

        uint256[24] memory proof = params.artifacts.proof.toFixed24();
        uint256[10] memory pubSignals = [
            params.artifacts.outputs[0],
            params.artifacts.outputs[1],
            params.artifacts.outputs[2],
            params.artifacts.outputs[3],
            block.chainid,
            uint160(address(this)),
            account.state.nonce,
            account.state.commitment,
            recipientAccount.pubKeyX,
            recipientAccount.pubKeyY
        ];

        if (!$.transferVerifier.verifyProof(proof, pubSignals)) revert ProofVerificationFailed();

        newState = Payload({nonce: account.state.nonce + 1, commitment: pubSignals[0], eAmount: pubSignals[1]});

        pendingTransferPackage =
            Payload({nonce: account.state.nonce + 1, commitment: pubSignals[2], eAmount: pubSignals[3]});
    }

    function _apply(ApplyParams calldata params)
        internal
        view
        checkArrayLength(2, params.artifacts.outputs.length)
        checkPendingTransfersIndexes(msg.sender, params.pendingTransfersIndexes.length)
        returns (Payload memory newState)
    {
        ConfidentialTransfersStorage storage $ = _getCStorage();

        Account storage account = $.accounts[msg.sender];

        uint256 n = params.pendingTransfersIndexes.length;
        uint256 maxIndex = account.pendingTransfers.length;

        uint256[7 + MAX_PENDING_TRANSFERS_APPLY] memory pubSignals;
        pubSignals[0] = params.artifacts.outputs[0];
        pubSignals[1] = params.artifacts.outputs[1];
        pubSignals[2] = block.chainid;
        pubSignals[3] = uint160(address(this));
        pubSignals[4] = n;
        pubSignals[5] = account.state.nonce;
        pubSignals[6] = account.state.commitment;

        // Loop through the maximum possible pending transfers (fixed circuit size).
        // If the index 'i' is less than the number of transfers to apply 'n', we include the commitment.
        // Otherwise, we pad with 0 to match the circuit's expected input size.
        for (uint256 i = 0; i < MAX_PENDING_TRANSFERS_APPLY; i++) {
            if (i < n) {
                uint256 targetIndex = params.pendingTransfersIndexes[i];
                if (targetIndex >= maxIndex) revert InvalidPendingTransfersIndexes();
                pubSignals[7 + i] = uint256(account.pendingTransfers[targetIndex].payload.commitment);
            } else {
                pubSignals[7 + i] = 0;
            }
        }
        uint256[24] memory proof = params.artifacts.proof.toFixed24();

        if (!$.applyVerifier.verifyProof(proof, pubSignals)) revert ProofVerificationFailed();

        newState = Payload({nonce: account.state.nonce + 1, commitment: pubSignals[0], eAmount: pubSignals[1]});
    }

    function _applyAndTransfer(ApplyAndTransferParams calldata params)
        internal
        view
        checkArrayLength(4, params.artifacts.outputs.length)
        checkMaxPendingTransfers(params.recipient)
        checkPendingTransfersIndexes(msg.sender, params.pendingTransfersIndexes.length)
        returns (Payload memory newState, Payload memory pendingTransfer)
    {
        ConfidentialTransfersStorage storage $ = _getCStorage();
        Account storage account = $.accounts[msg.sender];
        Account storage recipientAccount = $.accounts[params.recipient];

        uint256 n = params.pendingTransfersIndexes.length;
        uint256 maxIndex = account.pendingTransfers.length;

        uint256[24] memory proof = params.artifacts.proof.toFixed24();
        uint256[11 + MAX_PENDING_TRANSFERS_APPLY] memory pubSignals;
        pubSignals[0] = params.artifacts.outputs[0];
        pubSignals[1] = params.artifacts.outputs[1];
        pubSignals[2] = params.artifacts.outputs[2];
        pubSignals[3] = params.artifacts.outputs[3];
        pubSignals[4] = block.chainid;
        pubSignals[5] = uint160(address(this));
        pubSignals[6] = account.state.nonce;
        pubSignals[7] = account.state.commitment;
        pubSignals[8] = recipientAccount.pubKeyX;
        pubSignals[9] = recipientAccount.pubKeyY;
        pubSignals[10] = n;

        for (uint256 i = 0; i < MAX_PENDING_TRANSFERS_APPLY; i++) {
            if (i < n) {
                uint256 targetIndex = params.pendingTransfersIndexes[i];
                if (targetIndex >= maxIndex) revert InvalidPendingTransfersIndexes();
                pubSignals[11 + i] = uint256(account.pendingTransfers[targetIndex].payload.commitment);
            } else {
                pubSignals[11 + i] = 0;
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

    /**
     * @notice Gets the account information including state and public keys
     * @param account Address of the user
     * @return Account struct containing confidential state
     */
    function getAccount(address account) public view returns (Account memory) {
        return _getCStorage().accounts[account];
    }

    /**
     * @notice Retrieves confidential public keys for multiple accounts
     * @dev This function is useful when you need to get public keys while building cApply transaction (Multicall is overkill)
     * @param accounts Array of user addresses
     * @return pubKeyXs Array of X coordinates of public keys
     * @return pubKeyYs Array of Y coordinates of public keys
     */
    function getCPublicKeys(address[] calldata accounts)
        public
        view
        returns (uint256[] memory pubKeyXs, uint256[] memory pubKeyYs)
    {
        ConfidentialTransfersStorage storage $ = _getCStorage();
        pubKeyXs = new uint256[](accounts.length);
        pubKeyYs = new uint256[](accounts.length);
        for (uint256 i = 0; i < accounts.length; i++) {
            Account storage account = $.accounts[accounts[i]];
            pubKeyXs[i] = account.pubKeyX;
            pubKeyYs[i] = account.pubKeyY;
        }
    }

    /* ADMIN */

    /* MODIFIERS */

    modifier checkArrayLength(uint256 expected, uint256 actual) {
        if (actual != expected) revert InvalidArrayLength(expected, actual);
        _;
    }

    modifier onlyInitialized(address account) {
        if (_getCStorage().accounts[account].state.commitment == 0) revert AccountNotInitialized();
        _;
    }

    modifier checkRequiredAuditor(address account, AuditReport[] calldata auditReports) {
        _getCStorage().accounts[account].requiredAuditors.assertContains(auditReports);
        _;
    }

    modifier checkMaxPendingTransfers(address recipient) {
        ConfidentialTransfersStorage storage $ = _getCStorage();
        if ($.accounts[recipient].pendingTransfers.length >= $.maxPendingTransfers) {
            revert MaxPendingTransfersReached();
        }
        _;
    }

    modifier checkPendingTransfersIndexes(address sender, uint256 n) {
        if (n > _getCStorage().accounts[sender].pendingTransfers.length || n == 0) {
            revert InvalidPendingTransfersIndexes();
        }
        _;
    }
}
