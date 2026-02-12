# Confidential Transfers: Custodial Service Integration Overview

## Executive Summary

This document outlines the scope of work required for custodial service providers to integrate **Confidential Transfers** - a privacy-preserving ERC20 token transfer protocol. The integration enables your platform to:

1. **Send and receive confidential transfers** from other users
2. **Enable your clients** to create and manage tokens with confidential transfer capabilities
3. **Maintain full compliance** through built-in auditor functionality
4. **Deploy new tokens** for clients with confidential transfer capabilities

---

## What is Confidential Transfers?

Confidential Transfers is ERC20 smart contract extension that enables confidential transfers on Ethereum. Key features:

- **Privacy**: Transaction amounts are hidden from public view
- **Compliance**: Built-in auditor role for regulatory oversight

---

## Integration Scope

### High-Level Requirements

To integrate Confidential Transfers, platform needs to implement:

1. **Entropy Management** witch used to derive confidential keys for each user
2. **Transaction Calldata Generation Service** which is used to generate zero-knowledge proofs
3. **Account State Management** which is used to track user account states on-chain and manage pending transfers

---

## Component Overview

### 1. Entropy Management

**What it is**: Each user needs a unique "entropy" value (random bytes or Ethereum private key) that is used to derive confidential keys.

**Requirements**:

- Store entropy securely for each user
- Associate entropy with user accounts
- Implement secure entropy generation/retrieval

---

### 2. Transaction Proof Generation

**What it is**: A backend service that generates Zero-Knowledge proofs for confidential operations.

**Requirements**:

- Generates ZK proofs for operations (init, deposit, transfer, withdraw, apply)
- Creates transaction calldata ready for signing
- Validates user signatures

---

### 3. Account State Management

**What it is**: Track user account states on-chain and manage pending transfers.

**Requirements**:

- Monitor on-chain account states to decrypt account balance and pending transfers

---

## Technical Components Required

### Infrastructure

- **Ethereum RPC Node**: Access to Ethereum network (mainnet/testnet)
- **Secure Database**: For storing user entropy and account states
- **Backend Service**: For ZK proof generation (can be self-hosted or integrated)
- **Wallet Infrastructure**: Existing secure wallet service (e.g., Taurus Protect)

### Software Components

- **Smart Contracts**: Deployed Confidential Transfers contract
- **SDK or Backend Service**: For proof generation and calldata creation
- **Integration Code**: Connect your systems with the protocol

### Security Requirements

- **Entropy Encryption**: Encrypt entropy at rest
- **Access Control**: Limit access to entropy and signing operations
- **Audit Logging**: Log all confidential operations
- **Signature Validation**: Verify all user signatures

---

## API Integration Points

Your platform will need to interact with:

### 1. Backend Service API (for calldata generation)

**Endpoints**:

- `POST /confidential-transfers/register` - Register user
- `POST /confidential-transfers/init` - Initialize account
- `POST /confidential-transfers/deposit` - Generate deposit calldata
- `POST /confidential-transfers/transfer` - Generate transfer calldata
- `POST /confidential-transfers/withdraw` - Generate withdraw calldata
- `POST /confidential-transfers/apply` - Generate apply calldata

**Authentication**: User signature validation

### 2. Smart Contract (on-chain)

**Functions**:

- `cInit()` - Initialize confidential account
- `cDeposit()` - Deposit tokens
- `cTransfer()` - Send confidential transfer
- `cWithdraw()` - Withdraw tokens
- `cApply()` - Apply pending transfers
- `getAccount()` - Query account state

### 3. Wallet Service

**Operations**:

- Sign message (for authentication)
- Sign transaction (for submission)

## Next Steps

- [GUIDELINE.md](./GUIDELINE.md)
- [TechnicalSpecification.md](./TechnicalSpecification.md)
