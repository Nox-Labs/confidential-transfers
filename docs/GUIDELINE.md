# Confidential Transfers Integration Guide

This guide provides step-by-step instructions for integrating the Confidential Transfers protocol into your project, from contract deployment to SDK integration.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Setup](#project-setup)
3. [Building ZK Circuits](#building-zk-circuits)
4. [Deploying Smart Contracts](#deploying-smart-contracts)
5. [SDK Integration](#sdk-integration)
6. [Entropy Generation Strategies](#entropy-generation-strategies)
7. [Future Roadmap](#future-roadmap)

---

## Prerequisites

Before starting, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **Foundry** - [Installation Guide](https://getfoundry.sh/)
- **Circom** - Install via npm: `npm install -g circom`
- **SnarkJS** - Included as a dependency, but can be installed globally: `npm install -g snarkjs`

---

## Project Setup

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd confidential-transfers-contracts
npm install
```

### 2. Download Powers of Tau

The PLONK trusted setup requires a powers of tau file. Download it:

```bash
npm run download:powersOfTau
```

This downloads `powersOfTau28_hez_final_16.ptau` to the project root.

---

## Building ZK Circuits

The protocol uses PLONK zero-knowledge proofs. Each operation (init, deposit, transfer, apply, withdraw, applyAndTransfer) has its own circuit.

### Build All Circuits

```bash
npm run build:circuits:all
```

This will:

1. Compile all Circom circuits
2. Generate PLONK proving keys (`.zkey` files)
3. Generate verifier Solidity contracts
4. Create WASM helpers for proof generation

### Build Individual Circuits

```bash
# Initialize account
npm run build:circuits:init

# Apply pending transfers
npm run build:circuits:apply

# Deposit/Withdraw
npm run build:circuits:update

# Transfer
npm run build:circuits:transfer

# Apply and Transfer (combined operation)
npm run build:circuits:applyAndTransfer
```

### Output Locations

- **Proving Keys**: `packages/sdk/keys/<circuit-name>/<circuit-name>_final.zkey`
- **WASM Helpers**: `packages/sdk/artifacts/proofs-helpers/<circuit-name>_js/`
- **Verifier Contracts**: `src/verifiers/<CircuitName>PlonkVerifier.sol`

---

## Deploying Smart Contracts

### 1. Compile Contracts

```bash
npm run build:contracts
```

This compiles both Foundry and Hardhat artifacts.

### 2. Deploy Verifiers

Each circuit requires its own verifier contract. Deploy them in this order:

```solidity
InitPlonkVerifier initVerifier = new InitPlonkVerifier();
ApplyPlonkVerifier applyVerifier = new ApplyPlonkVerifier();
UpdatePlonkVerifier updateVerifier = new UpdatePlonkVerifier();
TransferPlonkVerifier transferVerifier = new TransferPlonkVerifier();
ApplyAndTransferPlonkVerifier applyAndTransferVerifier = new ApplyAndTransferPlonkVerifier();
```

### 3. Deploy Main Contract

The main contract extends `ConfidentialTransfers` and requires all verifiers:

```solidity
// Example: MockERC20 with confidential transfers
MockERC20 token = new MockERC20(
    maxPendingTransfers,  // e.g., 100
    initVerifier,
    applyVerifier,
    updateVerifier,
    transferVerifier,
    applyAndTransferVerifier
);
```

### 4. Deploy Example (Anvil)

For local development with Anvil:

```bash
# Start Anvil
anvil

# In another terminal, deploy
npm run deploy:mock:anvil
```

### 5. Set Auditor (Optional)

For compliance, set an auditor address:

```solidity
token.setAuditor(auditorAddress);
```

---

## SDK Integration

### Installation

```bash
npm install @noxlabs/confidential-transfers-sdk
```

### Basic Setup

```typescript
import { SDK } from "@noxlabs/confidential-transfers-sdk"
import { ethers } from "ethers"

// Initialize provider
const provider = new ethers.JsonRpcProvider("http://localhost:8545")

// Initialize SDK
const sdk = new SDK(contractAddress, provider, {
  paths: {
    helpers: "@noxlabs/confidential-transfers-sdk/artifacts/proofs-helpers",
    keys: "<path-to-zk-keys>", // e.g., "./keys" or absolute path
  },
})
```

### Key Derivation

Before any operation, derive confidential keys from entropy:

```typescript
import { SDK } from "@noxlabs/confidential-transfers-sdk"

// Derive keys from entropy (see Entropy Generation section)
const { cPrivateKey, cPublicKey_X, cPublicKey_Y } =
  await SDK.deriveConfidentialKeys(entropy)
```

### Initialize Account

```typescript
// Get circuit inputs
const initInputs = await sdk.getCircuitInputsForInit(cPrivateKey)

// Generate proof
const initProofOutput = await sdk.generateInitProof(initInputs)

// Get transaction parameters
const initParams = sdk.getInitParams(initProofOutput)

// Execute transaction
const tx = await sdk.token.cInit(initParams)
await tx.wait()
```

### Deposit

```typescript
const amount = ethers.parseEther("100") // 100 tokens

// Get circuit inputs
const depositInputs = await sdk.getCircuitInputsForDeposit(
  userAddress,
  cPrivateKey,
  amount
)

// Generate proof
const depositProofOutput = await sdk.generateUpdateProof(depositInputs)

// Get transaction parameters
const depositParams = sdk.getDepositParams(depositProofOutput)

// Execute transaction
const tx = await sdk.token.cDeposit(depositParams)
await tx.wait()
```

### Transfer

```typescript
const recipientAddress = "0x..."
const amount = ethers.parseEther("10")

// Get circuit inputs
const transferInputs = await sdk.getCircuitInputsForTransfer(
  senderAddress,
  cPrivateKey,
  recipientAddress,
  amount
)

// Generate proof
const transferProofOutput = await sdk.generateTransferProof(transferInputs)

// Get transaction parameters
const transferParams = sdk.getTransferParams(
  recipientAddress,
  transferProofOutput
)

// Execute transaction
const tx = await sdk.token.cTransfer(transferParams)
await tx.wait()
```

### Apply Pending Transfers

```typescript
const pendingTransfersIndexes = [0, 1] // Apply first two pending transfers

// Get circuit inputs
const applyInputs = await sdk.getCircuitInputsForApply(
  userAddress,
  cPrivateKey,
  pendingTransfersIndexes
)

// Generate proof
const applyProofOutput = await sdk.generateApplyProof(applyInputs)

// Get transaction parameters
const applyParams = sdk.getApplyParams(
  pendingTransfersIndexes,
  applyProofOutput
)

// Execute transaction
const tx = await sdk.token.cApply(applyParams)
await tx.wait()
```

### Apply and Transfer (Combined)

```typescript
const recipientAddress = "0x..."
const amount = ethers.parseEther("10")
const pendingTransfersIndexes = [0, 1]

// Get circuit inputs
const applyAndTransferInputs = await sdk.getCircuitInputsForApplyAndTransfer(
  senderAddress,
  cPrivateKey,
  pendingTransfersIndexes,
  recipientAddress,
  amount
)

// Generate proof
const applyAndTransferProofOutput = await sdk.generateApplyAndTransferProof(
  applyAndTransferInputs
)

// Get transaction parameters
const applyAndTransferParams = sdk.getApplyAndTransferParams(
  recipientAddress,
  pendingTransfersIndexes,
  applyAndTransferProofOutput
)

// Execute transaction
const tx = await sdk.token.cApplyAndTransfer(applyAndTransferParams)
await tx.wait()
```

### Withdraw

```typescript
const amount = ethers.parseEther("5")

// Get circuit inputs
const withdrawInputs = await sdk.getCircuitInputsForWithdraw(
  userAddress,
  cPrivateKey,
  amount
)

// Generate proof
const withdrawProofOutput = await sdk.generateUpdateProof(withdrawInputs)

// Get transaction parameters
const withdrawParams = sdk.getWithdrawParams(withdrawProofOutput)

// Execute transaction
const tx = await sdk.token.cWithdraw(withdrawParams)
await tx.wait()
```

### Query Account State

```typescript
// Get account state
const account = await sdk.token.getAccount(userAddress)

console.log("Nonce:", account.state.nonce)
console.log("Commitment:", account.state.commitment)
console.log("Pending Transfers:", account.pendingTransfers.length)
```

### Decrypt Balance

```typescript
import { SDK } from "@noxlabs/confidential-transfers-sdk"

// Decrypt encrypted amount
const decryptedAmount = await SDK.decryptAmount(
  cPrivateKey,
  account.state.nonce,
  account.state.eAmount
)
```

---

## Entropy Generation Strategies

The `entropy` value is critical for deriving confidential keys. It must be:

- **Deterministic**: Same entropy always produces same keys
- **Recoverable**: User must be able to recover it from their Ethereum private key
- **Secure**: Should not be predictable by third parties

### Strategy 1: Direct Private Key (Simplest)

Use the Ethereum private key directly as entropy:

```typescript
import { ethers } from "ethers"

const wallet = new ethers.Wallet(privateKey)
const entropy = BigInt(wallet.privateKey) // token address can be incuded

const { cPrivateKey, cPublicKey_X, cPublicKey_Y } =
  await SDK.deriveConfidentialKeys(entropy)
```

**Pros:**

- Simple and straightforward
- Fully recoverable from private key
- No additional infrastructure needed

**Cons:**

- Directly exposes private key usage pattern
- Less flexible for key rotation scenarios

### Strategy 2: Signature-Based (Recommended for Custodial Services)

Generate random entropy, have user sign it, then use the signature:

```typescript
import { ethers } from "ethers"
import { SDK } from "@noxlabs/confidential-transfers-sdk"

// Backend: Generate random entropy
const randomEntropy = ethers.randomBytes(32)
const entropyHex = ethers.hexlify(randomEntropy)

// Store entropyHex in database associated with userId

// Frontend: User signs the entropy
const signature = await wallet.signMessage(ethers.getBytes(entropyHex))

// Backend: Use signature as entropy for key derivation
const entropy = BigInt(signature)
const { cPrivateKey, cPublicKey_X, cPublicKey_Y } =
  await SDK.deriveConfidentialKeys(entropy)
```

**Pros:**

- Entropy can be stored securely on backend
- User authentication via signature
- Supports key rotation (generate new entropy, re-sign)

**Cons:**

- Requires backend infrastructure
- Two-step process (register → sign)

---

## Future Roadmap

### Golang SDK (Planned)

We plan to develop a Golang SDK to provide native integration for Go-based applications and services. The Golang SDK will:

- **Feature Parity**: Support all operations available in the TypeScript SDK
- **Performance**: Leverage Go's performance for proof generation and cryptographic operations
- **Enterprise Integration**: Enable integration with Go-based backend services and infrastructure
- **Cross-Platform**: Support Linux, macOS, and Windows

**Expected Timeline**: Q2 2025

**Key Features**:

- Full ZK proof generation support
- Account state management
- Transaction building and submission
- Key derivation utilities
- Integration with popular Go Ethereum libraries (go-ethereum)

**Contribution**: If you're interested in contributing to the Golang SDK development, please reach out to the maintainers.

---

## Additional Resources

- [Architecture Documentation](./ConfidentialTransfers.md) - Detailed protocol architecture
- [SDK README](../packages/sdk/README.md) - SDK-specific documentation
- [Backend Service README](../packages/backend-service/README.md) - Backend service setup
- [Frontend Demo README](../packages/frontend-demo/README.md) - Demo application guide

---

## Troubleshooting

### Circuit Build Errors

If circuit builds fail:

1. Ensure `circom` is installed: `npm install -g circom`
2. Check that `powersOfTau28_hez_final_16.ptau` exists in project root
3. Verify circuit syntax in `circuits/` directory

### Proof Generation Errors

If proof generation fails:

1. Verify zk keys are in correct location (`packages/sdk/keys/`)
2. Check that WASM helpers are built (`packages/sdk/artifacts/proofs-helpers/`)
3. Ensure circuit inputs are valid (amounts, addresses, etc.)

### Contract Deployment Errors

If deployment fails:

1. Verify all verifiers are deployed first
2. Check contract addresses are correct
3. Ensure sufficient gas for deployment

---

## Support

For issues, questions, or contributions, please open an issue on the repository or contact the maintainers.
