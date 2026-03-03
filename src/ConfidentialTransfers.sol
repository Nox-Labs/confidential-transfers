// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.0;

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

import {
    ApplyAndTransferPlonkVerifier,
    ApplyPlonkVerifier,
    ConfidentialTransfersZKVerificationLib,
    InitPlonkVerifier,
    TransferPlonkVerifier,
    UpdatePlonkVerifier
} from "./lib/ConfidentialTransfersZKVerificationLib.sol";

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
    using ConfidentialTransfersZKVerificationLib for *;
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
        mapping(address sender => mapping(address recipient => bool allowed)) allowedSenders;
        mapping(uint256 pubKeyX => mapping(uint256 pubKeyY => address account)) pubKeyToAccount;
    }

    // keccak256(abi.encode(uint256(keccak256("ConfidentialTransfersStorage")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant CONFIDENTIAL_TRANSFERS_STORAGE_POSITION =
        keccak256(abi.encode(uint256(keccak256("ConfidentialTransfersStorage")) - 1)) & ~bytes32(uint256(0xff));
    // 0x74fe0b1f91feaaa95d609d18323a1d882fca941a422b86d407dc143fbb562900;

    function _getCStorage() internal pure returns (ConfidentialTransfersStorage storage $) {
        bytes32 position = CONFIDENTIAL_TRANSFERS_STORAGE_POSITION;
        assembly {
            $.slot := position
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
        ConfidentialTransfersStorage storage $ = _getCStorage();
        Account storage account = $.accounts[msg.sender];

        if (account.state.commitment != 0) revert AccountAlreadyInitialized();

        account.state = $.initVerifier.cInit(params);
        account.pubKeyX = params.artifacts.outputs[0];
        account.pubKeyY = params.artifacts.outputs[1];
        account.auditReports = params.stateAuditReports;

        if ($.pubKeyToAccount[account.pubKeyX][account.pubKeyY] != address(0)) revert PublicKeyAlreadyUsed();
        $.pubKeyToAccount[account.pubKeyX][account.pubKeyY] = msg.sender;

        emit CInitialized(msg.sender, account.pubKeyX, account.pubKeyY, account.state, account.auditReports);
    }

    function cMint(UpdateParams calldata params)
        public
        virtual
        onlyInitialized(msg.sender)
        authorizeCMintAndCBurn(msg.sender, 0)
        checkRequiredAuditor(msg.sender, params.stateAuditReports)
    {
        Payload memory newState = _cUpdate(0, params);
        emit CMinted(msg.sender, newState, params.stateAuditReports);
    }

    function cBurn(UpdateParams calldata params)
        public
        virtual
        onlyInitialized(msg.sender)
        authorizeCMintAndCBurn(msg.sender, 1)
        checkRequiredAuditor(msg.sender, params.stateAuditReports)
    {
        Payload memory newState = _cUpdate(1, params);
        emit CBurned(msg.sender, newState, params.stateAuditReports);
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
        _cPublicTransfer(msg.sender, address(this), params.amount);
        Payload memory newState = _cUpdate(0, params);
        emit CDeposited(msg.sender, params.amount, newState, params.stateAuditReports);
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
        Payload memory newState = _cUpdate(1, params);
        _cPublicTransfer(address(this), msg.sender, params.amount);
        emit CWithdrawn(msg.sender, params.amount, newState, params.stateAuditReports);
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

        Account storage account = $.accounts[msg.sender];

        Payload memory newState = $.applyVerifier.cApply(params, account);

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
        checkMaxPendingTransfers(params.recipient)
        checkAllowedSender(msg.sender, params.recipient)
        checkRequiredAuditor(msg.sender, params.stateAuditReports)
        checkRequiredAuditor(msg.sender, params.transferAuditReports)
        checkRequiredAuditor(params.recipient, params.transferAuditReports)
    {
        ConfidentialTransfersStorage storage $ = _getCStorage();

        Account storage account = $.accounts[msg.sender];

        (Payload memory newState, Payload memory pendingTransferPayload) =
            $.transferVerifier.cTransfer(params, account, $.accounts[params.recipient]);

        account.state = newState;
        account.auditReports = params.stateAuditReports;

        $.accounts[params.recipient].pendingTransfers
            .push(PendingTransfer(msg.sender, pendingTransferPayload, params.transferAuditReports));

        emit CTransferred(
            msg.sender,
            params.recipient,
            newState,
            pendingTransferPayload,
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
        checkMaxPendingTransfers(params.recipient)
        checkAllowedSender(msg.sender, params.recipient)
        checkRequiredAuditor(msg.sender, params.stateAuditReports)
        checkRequiredAuditor(msg.sender, params.transferAuditReports)
        checkRequiredAuditor(params.recipient, params.transferAuditReports)
    {
        ConfidentialTransfersStorage storage $ = _getCStorage();

        Account storage account = $.accounts[msg.sender];
        Account storage recipientAccount = $.accounts[params.recipient];

        (Payload memory newState, Payload memory pendingTransferPayload) =
            $.applyAndTransferVerifier.cApplyAndTransfer(params, account, recipientAccount);

        account.state = newState;
        account.auditReports = params.stateAuditReports;

        account.pendingTransfers.removeByIndices(params.pendingTransfersIndexes);

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
        ConfidentialTransfersStorage storage $ = _getCStorage();
        if ($.accounts[msg.sender].requiredAuditors.contains(auditor)) revert RequiredAuditorAlreadyAdded();
        $.accounts[msg.sender].requiredAuditors.push(auditor);
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

    /**
     * @notice Adds a sender that is allowed to send transfers to the account
     * @param sender Address of the sender to add
     */
    function addAllowedSender(address sender) public virtual {
        ConfidentialTransfersStorage storage $ = _getCStorage();
        if ($.allowedSenders[msg.sender][sender]) revert AllowedSenderAlreadyAdded();
        $.accounts[msg.sender].allowedSenders.push(sender);
        $.allowedSenders[msg.sender][sender] = true;
        emit AllowedSenderAdded(msg.sender, sender);
    }

    /**
     * @notice Removes a sender that is allowed to send transfers to the account
     * @param sender Address of the sender to remove
     */
    function removeAllowedSender(address sender) public virtual {
        ConfidentialTransfersStorage storage $ = _getCStorage();
        $.accounts[msg.sender].allowedSenders.remove(sender);
        $.allowedSenders[msg.sender][sender] = false;
        emit AllowedSenderRemoved(msg.sender, sender);
    }

    /* INTERNAL VIRTUAL */
    function _cUpdate(uint8 operation, UpdateParams calldata params)
        internal
        virtual
        returns (Payload memory newState)
    {
        ConfidentialTransfersStorage storage $ = _getCStorage();
        Account storage account = $.accounts[msg.sender];
        newState = $.updateVerifier.cUpdate(params, account, operation);
        account.state = newState;
        account.auditReports = params.stateAuditReports;
    }

    /**
     * @notice This function should transfer public ERC20 tokens
     */
    function _cPublicTransfer(address from, address to, uint256 amount) internal virtual;

    /**
     * @notice This function should authorize mint and burn operations
     * @param account Address of the account
     * @param operation Operation type (0 for mint, 1 for burn)
     */
    function _authorizeCMintAndCBurn(address account, uint8 operation) internal virtual;

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
     * @notice Gets the account information by confidential public key
     * @param pubKeyX X coordinate of the public key
     * @param pubKeyY Y coordinate of the public key
     * @return account Address of the account or address(0) if not found
     */
    function getAccountByPublicKey(uint256 pubKeyX, uint256 pubKeyY) public view returns (address account) {
        account = _getCStorage().pubKeyToAccount[pubKeyX][pubKeyY];
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

    /* MODIFIERS */

    modifier authorizeCMintAndCBurn(address account, uint8 operation) {
        _authorizeCMintAndCBurn(account, operation);
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

    modifier checkAllowedSender(address sender, address recipient) {
        ConfidentialTransfersStorage storage $ = _getCStorage();
        if ($.accounts[recipient].allowedSenders.length != 0 && !$.allowedSenders[sender][recipient]) {
            revert NotAllowedSender();
        }
        _;
    }

    modifier checkMaxPendingTransfers(address recipient) {
        ConfidentialTransfersStorage storage $ = _getCStorage();
        if ($.accounts[recipient].pendingTransfers.length >= $.maxPendingTransfers) {
            revert MaxPendingTransfersReached();
        }
        _;
    }
}
