# Confidential Transfers: Technical Specification

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Cryptographic Primitives](#cryptographic-primitives)
4. [Data Structures](#data-structures)
5. [Zero-Knowledge Proof Circuits](#zero-knowledge-proof-circuits)
6. [Smart Contract Implementation](#smart-contract-implementation)
7. [State Transitions](#state-transitions)
8. [Security Considerations](#security-considerations)
9. [Gas Cost Analysis](#gas-cost-analysis)
10. [Implementation Details](#implementation-details)

---

## Overview

The Confidential Transfers protocol is a Layer 1 smart contract extension for ERC20 tokens that enables privacy-preserving transfers using Zero-Knowledge Proofs (ZKPs). The protocol implements an **Advanced Account Model** that provides:

- **Confidentiality**: Transaction amounts are hidden from public view
- **Recoverability**: Users can recover their balance using only their Ethereum private key
- **Non-Interactivity**: Transfers don't require recipient participation
- **Compliance**: Built-in auditor role for regulatory transparency

### Technology Stack

- **Proving System**: PLONK (Universal Trusted Setup)
- **Circuit Language**: Circom 2.0
- **Hash Function**: Poseidon (ZK-friendly)
- **Elliptic Curve**: Baby Jubjub (Edwards curve)
- **Encryption**: Poseidon-based stream cipher
- **Key Exchange**: ECDH (Elliptic Curve Diffie-Hellman)

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Application                         |
│  (Frontend/Backend Service)                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ SDK API
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    SDK Layer                                │
│  - Key Derivation                                           │
│  - Circuit Input Preparation                                │
│  - Proof Generation (SnarkJS)                               │
│  - Transaction Building                                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ RPC Calls
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Ethereum Smart Contract                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         ConfidentialTransfers Contract               │   │
│  │  - State Management                                  │   │
│  │  - Proof Verification                                │   │
│  │  - Account Storage                                   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Account Model

Each user has:

- **One on-chain account state** (`Payload` struct)
- **A queue of pending transfers** (`PendingTransfer` struct)
- **Confidential keys** derived from entropy
- **Audit Reports** for compliance

## Cryptographic Primitives

### 1. Poseidon Hash

**Purpose**: ZK-friendly hash function for commitments and key derivation

**Specification**:

- Field: Prime field of Baby Jubjub curve
- Input: Array of field elements
- Output: Single field element

**Usage**:

- Commitment generation: `Commitment = Poseidon([amount, blindingFactor])`
- Blinding factor: `BF = Poseidon([cPrivateKey, nonce])`
- Key derivation: `cPrivateKey = Poseidon([entropy]) mod subOrder`

### 2. Baby Jubjub Curve

**Purpose**: Elliptic curve for public key cryptography

**Specification**:

- Curve: Edwards curve over prime field
- Generator: `G = (Gx, Gy)`
- Subgroup order: `subOrder` (scalar field size)

**Operations**:

- Public key: `PK = cPrivateKey * G`
- ECDH: `sharedKey = cPrivateKey * recipientPK`

### 3. Pedersen Commitment

**Purpose**: Hiding commitment to amount and OTK (acting as blinding factor)

**Formula**:

```
Commitment = Poseidon([amount, OTK])
```

**Properties**:

- **Hiding**: Commitment reveals nothing about amount
- **Binding**: Cannot open commitment to different values
- **Additive**: `Commitment(a1 + a2) = Commitment(a1) + Commitment(a2)` (in field)

### 4. Poseidon Stream Cipher

**Purpose**: Symmetric encryption for on-chain state recovery

**Algorithm**:

```
entropy = Poseidon([nonce])
keystream[i] = Poseidon([key, entropy + i])
ciphertext[i] = plaintext[i] + keystream[i]  (field addition)
```

**Decryption**:

```
plaintext[i] = ciphertext[i] - keystream[i]
```

### 5. ECDH Key Exchange

**Purpose**: Derive shared secret for encrypted transfers

**Algorithm**:

```
sharedKey = ECDH(senderCPrivateKey, recipientCPublicKey)
```

**Usage**:

- Transfer encryption uses shared key as `cPrivateKey` for recipient's pending transfer
- Recipient can decrypt using their `cPrivateKey` and sender's public key

---

## Data Structures

### On-Chain Structures

#### `Payload`

Represents a confidential account state or pending transfer payload.

```solidity
struct Payload {
    uint256 nonce;              // State version counter
    uint256 commitment;         // Pedersen commitment to (amount, OTK)
    uint256 eAmount;            // Encrypted amount (for recovery)
}
```

**Fields**:

- `nonce`: Increments with each state update, prevents replay attacks
- `commitment`: Public commitment to balance
- `eAmount`: Amount encrypted with user's key (recovery)

#### `AuditReport`

Represents an encrypted One-Time Key (OTK) for an auditor.

```solidity
struct AuditReport {
    address auditor;            // Address of the auditor
    uint256 eOTK;               // Encrypted One-Time Key
}
```

#### `PendingTransfer`

Represents an incoming transfer.

```solidity
struct PendingTransfer {
    address sender;             // Address of the sender
    Payload payload;            // The transfer payload
    AuditReport[] auditReports; // Audit reports for the transfer
}
```

#### `Account`

Represents a user's complete confidential account.

```solidity
struct Account {
    uint256 pubKey_X;           // Baby Jubjub public key X coordinate
    uint256 pubKey_Y;           // Baby Jubjub public key Y coordinate
    Payload state;              // Current account state
    AuditReport[] auditReports; // Audit reports for the current state
    PendingTransfer[] pendingTransfers; // Queue of incoming transfers
}
```

#### `ZKArtifacts`

Contains ZK proof and public signals.

```solidity
struct ZKArtifacts {
    uint256[] proof;    // PLONK proof (24 elements)
    uint256[] outputs;  // Public output signals
}
```

### Off-Chain Structures

#### Confidential Keys

```typescript
{
  cPrivateKey: bigint // Scalar on Baby Jubjub
  cPublicKey_X: bigint // Public key X coordinate
  cPublicKey_Y: bigint // Public key Y coordinate
}
```

**Derivation**:

```typescript
entropyHash = Poseidon([entropy])
cPrivateKey = entropyHash % babyJub.subOrder
publicKey = cPrivateKey * G
```

---

## Zero-Knowledge Proof Circuits

### Circuit Architecture

All circuits follow a modular design:

```
Main Circuit
├── OldStateChecker      (validates current state)
├── NewStateGenerator    (generates new state)
├── CommitmentGenerator  (creates commitments)
├── OTKGenerator         (generates One-Time Keys)
├── Cipherer             (encryption)
└── SharedKeyGenerator   (key exchange)
```

### Circuit 1: Init

**Purpose**: Initialize a new confidential account

**Private Inputs**:

- `cPrivateKey`: User's confidential private key

**Public Outputs**:

- `cPublicKey_X/Y`: User's confidential public key
- `newCommitment`: Initial commitment (amount = 0)
- `eAmount`: Encrypted amount (0)

**Constraints**:

1. Derive public key from private key: `PK = cPrivateKey * G`
2. Generate initial commitment with amount = 0, nonce = 0
3. Encrypt amount with user's key

### Circuit 2: Update (Deposit/Withdraw)

**Purpose**: Add or remove funds from confidential balance

**Private Inputs**:

- `cPrivateKey`: User's confidential private key
- `oldAmount`: Current balance (decrypted)

**Public Inputs**:

- `operation`: 0 = deposit, 1 = withdraw
- `amount`: Deposit/withdraw amount
- `oldNonce`: Current nonce
- `oldCommitment`: Current commitment

**Public Outputs**:

- `newCommitment`: Updated commitment
- `eAmount`: Encrypted new amount

**Constraints**:

1. Verify old state: `oldCommitment == Poseidon([oldAmount, OTK(oldNonce)])`
2. Validate operation: `operation ∈ {0, 1}`
3. For withdraw: `amount ≤ oldAmount` (prevent overdraft)
4. Calculate new amount: `newAmount = oldAmount + (1 - 2*operation) * amount`
5. Increment nonce: `newNonce = oldNonce + 1`
6. Generate new commitment and encryption

**Mathematical Formula**:

```
newAmount = oldAmount + (1 - 2*operation) * amount
         = oldAmount + amount        (if operation = 0, deposit)
         = oldAmount - amount        (if operation = 1, withdraw)
```

### Circuit 3: Transfer

**Purpose**: Send confidential transfer to another user

**Private Inputs**:

- `cPrivateKey`: Sender's confidential private key
- `oldAmount`: Sender's current balance
- `transferAmount`: Amount to transfer

**Public Inputs**:

- `oldNonce`: Sender's current nonce
- `oldCommitment`: Sender's current commitment
- `recipientPublicKey_X/Y`: Recipient's confidential public key

**Public Outputs**:

- `newCommitment`: Sender's updated commitment
- `eAmount`: Sender's encrypted new amount
- `transferCommitment`: Pending transfer commitment
- `transferEAmount`: Encrypted transfer amount

**Constraints**:

1. Verify sender's old state
2. Check balance: `transferAmount ≤ oldAmount`
3. Calculate sender's new state: `newAmount = oldAmount - transferAmount`
4. Derive shared key: `sharedKey = ECDH(senderCPrivateKey, recipientCPublicKey)`
5. Generate pending transfer using shared key as `cPrivateKey`
6. Increment nonce: `newNonce = oldNonce + 1`

**Key Insight**: The pending transfer uses a shared key derived via ECDH, allowing the recipient to decrypt it using their private key.

### Circuit 4: Apply

**Purpose**: Apply one or more pending transfers to main balance

**Private Inputs**:

- `cPrivateKey`: Recipient's confidential private key
- `oldAmount`: Recipient's current balance
- `pendingTransfersAmounts[max]`: Decrypted amounts of pending transfers
- `pendingTransfersOTKs[max]`: One-Time Keys (OTKs) of pending transfers

**Public Inputs**:

- `n`: Number of pending transfers to apply
- `oldNonce`: Recipient's current nonce
- `oldCommitment`: Recipient's current commitment
- `pendingTransfersCommitments[max]`: Commitments of pending transfers

**Public Outputs**:

- `newCommitment`: Updated commitment
- `eAmount`: Encrypted new amount

**Constraints**:

1. Verify recipient's old state
2. For each pending transfer `i < n`:
   - Verify commitment: `pendingTransfersCommitments[i] == Poseidon([pendingTransfersAmounts[i], pendingTransfersOTKs[i]])`
3. Calculate new amount: `newAmount = oldAmount + Σ(pendingTransfersAmounts[i])` for `i < n`
4. Increment nonce: `newNonce = oldNonce + 1`
5. Generate new commitment and encryption

**Optimization**: Uses conditional constraints to handle variable number of transfers:

```circom
isLess[i] = (i < n) ? 1 : 0
intermediateAmount[i+1] = intermediateAmount[i] + pendingTransfersAmounts[i] * isLess[i]
```

### Circuit 5: ApplyAndTransfer

**Purpose**: Apply pending transfers and send a new transfer in one transaction

**Private Inputs**:

- `cPrivateKey`: User's confidential private key
- `oldAmount`: Current balance
- `transferAmount`: Amount to transfer
- `pendingTransfersAmounts[max]`: Decrypted amounts of pending transfers
- `pendingTransfersOTKs[max]`: One-Time Keys (OTKs) of pending transfers

**Public Inputs**:

- `oldNonce`: Current nonce
- `oldCommitment`: Current commitment
- `recipientPublicKey_X/Y`: Recipient's public key
- `n`: Number of pending transfers to apply
- `pendingTransfersCommitments[max]`: Commitments of pending transfers

**Public Outputs**:

- `newCommitment`: Updated commitment
- `eAmount`: Encrypted new amount
- `transferCommitment`: Pending transfer commitment
- `transferEAmount`: Encrypted transfer amount

**Constraints**:

1. Verify old state
2. Apply pending transfers: `tempAmount = oldAmount + Σ(pendingTransfersAmounts[i])`
3. Check balance: `transferAmount ≤ tempAmount`
4. Calculate new amount: `newAmount = tempAmount - transferAmount`
5. Generate new state
6. Generate pending transfer using ECDH shared key

**Gas Efficiency**: Combines two operations (apply + transfer) into one proof, saving gas.

### Smart Contract Implementation

### Contract Structure

```solidity
abstract contract ConfidentialTransfers is IConfidentialTransfers, Initializable {
    using ArrayLib for uint256[];
    using ArrayLib for Payload[];

    struct ConfidentialTransfersStorage {
        uint256 maxPendingTransfers;
        InitPlonkVerifier initVerifier;
        ApplyPlonkVerifier applyVerifier;
        UpdatePlonkVerifier updateVerifier;
        TransferPlonkVerifier transferVerifier;
        ApplyAndTransferPlonkVerifier applyAndTransferVerifier;
        mapping(address account => Account) accounts;
    }
}
```

### Storage Layout

Uses ERC-7201 namespaced storage pattern to prevent storage collisions:

```solidity
bytes32 private constant CONFIDENTIAL_TRANSFERS_STORAGE_POSITION =
    0x74fe0b1f91feaaa95d609d18323a1d882fca941a422b86d407dc143fbb562900;
```

### Function Specifications

#### `cInit(InitParams calldata initParams)`

Initializes a new confidential account.

**Preconditions**:

- Account must not be initialized (`commitment == 0`)

**Postconditions**:

- Account state is set with public key and zero balance
- Nonce is set to 0

**Proof Verification**:

```solidity
pubSignals = [
    cPublicKey_X,
    cPublicKey_Y,
    newCommitment,
    eAmount
]
```

#### `cDeposit(UpdateParams calldata updateParams)`

Deposits public tokens into confidential balance.

**Preconditions**:

- Account must be initialized
- User must have approved tokens to contract

**Postconditions**:

- Account balance increases by `amount`
- Nonce increments
- Tokens are transferred from user to contract

**Proof Verification**:

```solidity
pubSignals = [
    newCommitment,
    eAmount,
    operation,      // 0 for deposit
    amount,
    oldNonce,
    oldCommitment
]
```

#### `cWithdraw(UpdateParams calldata updateParams)`

Withdraws tokens from confidential balance to public balance.

**Preconditions**:

- Account must be initialized
- Balance must be sufficient (`amount ≤ balance`)

**Postconditions**:

- Account balance decreases by `amount`
- Nonce increments
- Tokens are transferred from contract to user

**Proof Verification**: Same as `cDeposit` with `operation = 1`

#### `cTransfer(TransferParams calldata transferParams)`

Sends confidential transfer to recipient.

**Preconditions**:

- Sender account must be initialized
- Recipient account must be initialized
- Sender balance must be sufficient
- Recipient's pending transfers queue must not be full

**Postconditions**:

- Sender's balance decreases by `transferAmount`
- Sender's nonce increments
- Pending transfer is added to recipient's queue

**Proof Verification**:

```solidity
pubSignals = [
    newCommitment,              // Sender's new commitment
    eAmount,                    // Sender's encrypted amount
    transferCommitment,         // Pending transfer commitment
    transferEAmount,            // Encrypted transfer amount
    oldNonce,
    oldCommitment,
    recipientPublicKey_X,
    recipientPublicKey_Y
]
```

#### `cApply(ApplyParams calldata applyParams)`

Applies pending transfers to main balance.

**Preconditions**:

- Account must be initialized
- `pendingTransfersIndexes.length > 0`
- All indexes must be valid

**Postconditions**:

- Balance increases by sum of applied transfers
- Nonce increments
- Applied transfers are removed from queue

**Proof Verification**:

```solidity
pubSignals = [
    newCommitment,
    eAmount,
    n,                          // Number of transfers
    oldNonce,
    oldCommitment,
    pendingTransfersCommitments[0],
    pendingTransfersCommitments[1],
    ...
    pendingTransfersCommitments[MAX-1]  // Padded with 0s
]
```

#### `cApplyAndTransfer(ApplyAndTransferParams calldata applyAndTransferParams)`

Combines apply and transfer operations.

**Preconditions**:

- Same as `cApply` and `cTransfer` combined

**Postconditions**:

- Pending transfers are applied
- New transfer is sent
- All in one transaction

**Proof Verification**:

```solidity
pubSignals = [
    newCommitment,
    eAmount,
    transferCommitment,
    transferEAmount,
    oldNonce,
    oldCommitment,
    recipientPublicKey_X,
    recipientPublicKey_Y,
    n,
    pendingTransfersCommitments[0],
    ...
]
```

### Access Control

#### Auditor Management

Auditor management is now flexible. `AuditReport`s are passed with transactions. The protocol assumes an off-chain compliance requirement where transactions without valid audit reports for the designated auditor(s) are considered non-compliant or rejected by a gateway/indexer.

**Auditor Role**:

- Can decrypt `eOTK` using their private key
- Recovers `OTK` (One-Time Key)
- Uses `OTK` to decrypt `eAmount` and verify `commitment`
- Can audit transaction history and balances

### Error Handling

```solidity
error ProofVerificationFailed();
error InvalidArrayLength(uint256 expected, uint256 actual);
error AccountNotInitialized();
error AccountAlreadyInitialized();
error InvalidPendingTransfersIndexes();
error MaxPendingTransfersReached();
```

---

## State Transitions

### State Machine

```
┌──────────────┐
│Uninitialized │
└──────┬───────┘
       │ cInit
       ▼
┌──────────────┐
│  Initialized │◄─────────────────┐
│  (balance=0) │                  │
└──────┬───────┘                  │
       │                          │
       ├─ cDeposit ───────────────┤
       │                          │
       ├─ cTransfer ──────────────┤
       │                          │
       ├─ cApply ─────────────────┤
       │                          │
       ├─ cWithdraw ──────────────┤
       │                          │
       └─ cApplyAndTransfer ──────┘
```

### State Transition Rules

1. **Initialization**: `commitment == 0` → `commitment != 0`, `nonce = 0`
2. **Deposit**: `balance' = balance + amount`, `nonce' = nonce + 1`
3. **Withdraw**: `balance' = balance - amount`, `nonce' = nonce + 1` (if `balance ≥ amount`)
4. **Transfer**: `sender.balance' = sender.balance - amount`, `sender.nonce' = sender.nonce + 1`, `recipient.pendingTransfers += transfer`
5. **Apply**: `balance' = balance + Σ(pendingAmounts)`, `nonce' = nonce + 1`, `pendingTransfers.remove(indexes)`

### Invariants

1. **Balance Conservation**: Sum of all commitments equals total deposited tokens
2. **Nonce Monotonicity**: Nonce always increases
3. **Commitment Consistency**: `commitment == Poseidon([amount, BF(nonce)])`
4. **Encryption Consistency**: `eAmount` decrypts to current `amount`

---

## Security Considerations

### Cryptographic Security

1. **Poseidon Hash**: Cryptographically secure, ZK-friendly
2. **Baby Jubjub**: Well-studied curve, secure for ECDH
3. **PLONK**: Universal trusted setup, secure against quantum attacks (for now)

### Protocol Security

1. **Double-Spending Prevention**: Nonce ensures state transitions are sequential
2. **Replay Protection**: Nonce increments prevent replay attacks
3. **Balance Verification**: ZK proofs ensure balance conservation
4. **Commitment Binding**: Cannot open commitment to different values

### Auditor Security

- Auditor access is granular via `AuditReport`s.
- `OTK` (One-Time Key) architecture ensures forward secrecy if the auditor key is compromised (past transactions remain secure if OTKs were encrypted with ephemeral keys, or if only the OTAK key was compromised but not the user's secret).
- Note: If `eOTK` is derived from `ECDH(cPrivateKey, auditorPublicKey)`, then compromising the user's `cPrivateKey` reveals past OTKs.
- Auditor rotation is easier: new transactions just use the new auditor's public key for `AuditReport`s.

---

## Gas Cost Analysis

### Estimated Gas Costs

| Operation           | Proof Verification | State Updates | Total (approx) |
| ------------------- | ------------------ | ------------- | -------------- |
| `cInit`             | ~300,000           | ~50,000       | ~350,000       |
| `cDeposit`          | ~300,000           | ~100,000      | ~400,000       |
| `cTransfer`         | ~400,000           | ~150,000      | ~550,000       |
| `cApply`            | ~400,000           | ~200,000      | ~600,000       |
| `cWithdraw`         | ~300,000           | ~100,000      | ~400,000       |
| `cApplyAndTransfer` | ~400,000           | ~250,000      | ~650,000       |

**Note**: Actual gas costs depend on:

- Network congestion
- PLONK verifier implementation
- Number of pending transfers (for apply operations)

---

## Implementation Details

### Key Derivation

```typescript
// From entropy to confidential keys
entropyHash = Poseidon([entropy])
cPrivateKey = entropyHash % babyJub.subOrder
publicKey = cPrivateKey * G
```

### Blinding Factor / OTK Generation

```typescript
// Deterministic One-Time Key (OTK)
// Previously called blinding factor
OTK = Poseidon([cPrivateKey, nonce])
```

### Commitment Generation

```typescript
// Pedersen commitment
commitment = Poseidon([amount, OTK])
```

### Encryption/Decryption

```typescript
// Encryption
// Uses OTK as the key
key = OTK
entropy = Poseidon([nonce])
keystream = Poseidon([key, entropy])
ciphertext = plaintext + keystream // Field addition

// Decryption
plaintext = ciphertext - keystream
```

### ECDH Shared Key

```typescript
// Sender generates shared key
sharedKey = ECDH(senderCPrivateKey, recipientCPublicKey)

// Recipient generates same shared key
sharedKey = ECDH(recipientCPrivateKey, senderCPublicKey)
```

### Proof Generation Flow

1. **Prepare Circuit Inputs**: Gather private and public inputs
2. **Generate Witness**: Compute intermediate values
3. **Generate Proof**: Use SnarkJS PLONK prover
4. **Format for Contract**: Extract proof and public signals
5. **Submit Transaction**: Call contract function with proof

### Account Recovery

Users can recover their balance using only their Ethereum private key:

1. Derive `cPrivateKey` from entropy (derived from private key)
2. Query on-chain state: `account = getAccount(address)`
3. Decrypt balance: `amount = decryptAmount(cPrivateKey, account.state.nonce, account.state.eAmount)`
4. Verify commitment: `commitment == Poseidon([amount, BF(nonce)])`

---

## Appendix

### Constants

- `MAX_PENDING_TRANSFERS_APPLY = 10`: Maximum pending transfers in one apply operation
- `PLONK_PROOF_SIZE = 24`: Number of proof elements

### References

- [Circom Documentation](https://docs.circom.io/)
- [SnarkJS Documentation](https://github.com/iden3/snarkjs)
- [Baby Jubjub Specification](https://eips.ethereum.org/EIPS/eip-2494)
- [Poseidon Hash](https://www.poseidon-hash.info/)
