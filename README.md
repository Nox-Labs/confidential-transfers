# ERC20 Confidential Transfers

This project is a proof-of-concept implementation of confidential transfers for ERC20-like tokens on Ethereum Virtual Machine (EVM) compatible blockchains. It leverages zk-SNARKs (PLONK) to enable privacy-preserving transactions, allowing users to transfer tokens without revealing the amounts on-chain while keeping the link between sender and receiver private.

## How It Works

The system uses an **Account-Based Model** where a user's private balance is represented by a cryptographic commitment. All state transitions (deposits, transfers, withdrawals) are validated by zero-knowledge proofs, ensuring correctness without revealing underlying private data.

- **Confidentiality**: Balances and transfer amounts are hidden using Pedersen commitments.
- **Compliance**: The protocol supports a flexible **Auditor** role. Transactions include encrypted **Audit Reports** (using One-Time Audit Keys), enabling designated auditors to decrypt transaction details for regulatory compliance without exposing data to the public.
- **Recoverability**: Users can recover their confidential state and funds using only their Ethereum private key (via deterministic entropy derivation).

### Technology Stack

- **ZKP Circuits**: Written in `circom`, implementing the core logic for state transitions.
- **Proving System**: PLONK (Universal Trusted Setup).
- **Smart Contracts**: Solidity contracts for verification and state management.
- **Cryptography**: Poseidon Hash, Baby Jubjub Curve (ECDH), Pedersen Commitments.

## Features

The implementation supports the full lifecycle of a confidential token:

> Note: The prefix `c` stands for "confidential".

- **`cInit`**: Initializes a new confidential account for a user, creating their first zero-balance commitment and publishing their public key.
- **`cDeposit`**: Converts public ERC20 tokens into confidential tokens by depositing them into the contract.
- **`cTransfer`**: Sends a confidential transfer to another user. This creates a "pending transfer" for the recipient.
- **`cApply`**: Allows a recipient to claim incoming pending transfers, rolling them into their main confidential balance. Supports batching multiple transfers.
- **`cApplyAndTransfer`**: **Gas Optimization**. Combines `cApply` and `cTransfer` in a single transaction, allowing users to receive funds and immediately send them out efficiently.
- **`cWithdraw`**: Converts confidential tokens back into public ERC20 tokens, withdrawing them to the user's public address.

## Project Structure

```
.
├── circuits/         # Circom source code for ZKP circuits
│   ├── modules/      # Reusable circuit components (State generation, Checks)
│   ├── utils/        # Cryptographic primitives (Poseidon, ECDH, OTK)
│   └── *.circom      # Main entry point circuits
├── src/              # Solidity smart contracts
│   ├── interface/    # Interfaces and Struct definitions
│   ├── verifiers/    # Auto-generated ZKP verifier contracts
│   └── ConfidentialTransfers.sol # Core abstract contract
├── packages/         # Monorepo packages
│   ├── sdk/          # TypeScript SDK for key derivation and proof generation
│   ├── frontend-demo/# Next.js Demo Application
│   └── backend-service/ # NestJS Service example
└── test/             # Comprehensive test suite (Foundry & Hardhat)
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/en/) (v18 or higher)
- [Foundry](https://getfoundry.sh/) (for Solidity tests)
- [Circom](https://github.com/iden3/circom) (for ZK circuits)

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd <repository-name>
   ```

2. Install dependencies:

   ```bash
   npm install
   npm run download:powersOfTau
   ```

## Usage

### Build

Compile circuits and smart contracts:

```bash
# Build all ZK circuits (requires circom installed)
npm run build:circuits:all

# Compile contracts
npm run build:contracts
```

### Testing

Test build on top of [SDK](./packages/sdk/) so first build the SDK and then run the tests.

```bash
npm run build:sdk
```

The project includes three tiers of tests:

1. **Foundry Tests** (Unit Logic):

   ```bash
   npm run test:foundry
   ```

2. **Hardhat "Cold" Tests** (Fast Integration):
   Use pre-generated proofs for quick iteration.

   ```bash
   npm run test:hh:cold:prepare # Generate proofs once
   npm run test:hh:cold         # Run tests
   ```

3. **Hardhat "Hot" Tests** (Full Integration):
   Generate real ZK proofs on-the-fly. Slower but comprehensive.

   ```bash
   npm run test:hh:hot
   ```

### Demo Application

The project includes a demo application that allows you to interact with the confidential transfers contract. See [frontend-demo](./packages/frontend-demo/README.md) for more details.

## Documentation

For more detailed information, check the `docs/` directory:

- [Technical Specification](docs/TechnicalSpecification.md)
- [Integration Guidelines](docs/GUIDELINE.md)
- [Custody Guidelines](docs/CustodyIntegration.md)
- [Npm package](https://www.npmjs.com/package/@noxlabs/confidential-transfers)
