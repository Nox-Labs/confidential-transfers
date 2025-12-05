# ERC20 Confidential Transfers

[![Solidity](https://img.shields.io/badge/Solidity-^0.8.28-blue.svg)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Hardhat-^3.0-blue.svg)](https://hardhat.org/)
[![Foundry](https://img.shields.io/badge/Foundry-blue.svg)](https://getfoundry.sh/)

This project is a proof-of-concept implementation of confidential transfers for ERC20-like tokens on Ethereum Virtual Machine (EVM) compatible blockchains. It leverages zk-SNARKs (PLONK) to enable privacy-preserving transactions, allowing users to transfer tokens without revealing the amounts on-chain while keeping link between sender and receiver private.

## How It Works

The system uses an account-based model where a user's private balance is represented by a cryptographic commitment. All state transitions (like depositing, transferring, or withdrawing) are validated by zero-knowledge proofs, ensuring that all operations are valid without revealing the underlying private data (like transaction amounts or private keys).

- **ZKP Circuits**: The core logic is defined in `circom` circuits, which generate proofs for each confidential operation.
- **Smart Contracts**: The on-chain component is written in Solidity and uses both Hardhat and Foundry for development and testing. It stores user commitments and verifies the proofs submitted with each transaction.
- **Client-Side SDK**: A TypeScript-based SDK is used in the tests to derive ZK keys, generate proofs, and interact with the smart contracts.

## Features

The implementation supports the full lifecycle of a confidential token:

> Note: when word starts with `c` it stands for "confidential".

- **`cInit`**: Initializes a new confidential account for a user, creating their first zero-balance commitment on-chain and publish public key.
- **`cDeposit`**: Converts public ERC20 tokens into confidential tokens by depositing them into the contract and updating the user's private commitment.
- **`cTransfer`**: Send a confidential transfer to another user. This operation updates the sender's commitment and creates a new "pending transfer" for the recipient, which will be applied by the recipient using `cApply`.
- **`cApply`**: Allows a user to claim one or more incoming pending transfers, rolling them into their main confidential balance. The system supports applying a variable number of transfers in a single transaction.
- **`cWithdraw`**: Converts confidential tokens back into public ERC20 tokens, withdrawing them from the contract to the user's public address.

## Project Structure

```
.
├── circuits/         # Circom source code for ZKP circuits (init, transfer, etc.)
├── src/              # Solidity smart contracts
│   ├── interface/
│   ├── lib/
│   ├── verifiers/    # ZKP verifier contracts generated from circuits
│   └── ConfidentialTransfers.sol # Main abstract contract with core logic
├── test/
│   ├── hardhat/      # "Hot" and "Cold" tests written in TypeScript using Hardhat
│   └── foundry/      # Solidity-based tests using Foundry
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/en/) (v18 or higher)
- [Foundry](https://getfoundry.sh/)

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd <repository-name>
   ```
2. Install the Node.js dependencies:

   ```bash
   npm install
   ```

## Usage

### Build the Circuits

```bash
# Run the build script
npm run build:circuits:all
```

### Compile Smart Contracts

```bash
npm run build:contracts
```

### Run Tests

The project includes three types of tests:

- **Foundry Tests**: Unit tests for specific contract logic written in Solidity.

  ```bash
  npm run test:foundry
  ```
- **Hardhat "Hot" Tests**: Integration tests that generate ZKP proofs on-the-fly for each test case. They are thorough but slow.

  ```bash
  npm run test:hh:hot
  ```
- **Hardhat "Cold" Tests**: Integration tests that use pre-generated proofs. They are much faster and ideal for quick checks and CI.

  ```bash
  # First, generate the required proofs:
  npm run test:hh:cold:prepare
  ```

  ```bash
  # Then, run the cold tests:
  npm run test:hh:cold
  ```

### Open question

1. Do we need to add constraints for cPrivateKey generation in Init circuit to verify that its was correctly derived from ethPrivateKey? Or allow any private key?
2. After auditor rotation, should new auditor be able to decrypt past events?
3. Is it okay if `ConfidentialTransfersBridgeable.sol` would burn token in deposit, effecting totalSupply?
4. Is it okay for bridge in `ConfidentialTransfersBridgeable.sol` to not provide destination finality(it difficult to validate all data on src chain about dst state)? And it it okay if dst chain will send back package to src chain?
5. Maybe viewing key is better for KYT providers that single auditor.

### TODO

1. Multicall cTransfer + cApply
2. reCInit
