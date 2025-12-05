# Confidential ERC20 Transfer Protocol: Architectural Analysis and Design Specification

- **Document Version: 0.2 (draft)**
- **Date: October 2025**
- **Author: Nox Labs**

---

### TL;DR

The Problem: Institutional players require a method to transfer ERC20 tokens on the public Ethereum network without disclosing transaction amounts to the public, while meeting strict security and compliance standards. The Solution: We propose the a Layer 1 smart contract extension that acts as a "shielded pool" for ERC20

#### How it Works:

1. Technology: Zero-Knowledge Proofs (ZKP)
2. Key Features:
   - Confidentiality: Transaction amounts are completely hidden from the public.
   - Full Recoverability: Users can restore their private balance with only their private key. No risk of fund loss from client-side failures.
   - No Off-Chain Dependencies: The protocol does not require any trusted indexers or external services to function.
   - Compliance-Ready: A built-in, non-custodial Auditor role provides full transactional transparency to a designated party, meeting regulatory requirements.
   - The Trade-off: This architecture prioritizes security, recoverability, and on-chain integrity over low transaction costs. The resulting gas fees will be high, which is deemed an acceptable trade-off for high-value institutional transactions.

### Initial Project Brief & Core Requirements

1. Primary Objective: To develop a smart contract-based extension for the existing ERC20 token that enables confidential peer-to-peer transfers.
2. Core Functional Requirements:

   - Privacy: The amount of each transaction must be concealed from public view.
   - Target Audience: The solution must be tailored for institutional clients, prioritizing security and compliance over low cost.
   - Architectural Model: The user-facing experience should be simple, abstracting away any underlying cryptographic complexity.
   - Recoverability: The system must guarantee that a user can recover access to their funds even if all local/client-side data is lost.
   - System Integrity: The protocol must be self-reliant and not depend on trusted off-chain services (like indexers) for its core operation.

3. Core Non-Functional Requirements (Security & Compliance):
   Auditability: The system must include a mechanism for a designated Auditor to view the details of all transactions for compliance purposes.
   Trustlessness: The security of the protocol must rely solely on cryptography and the underlying security of the Ethereum blockchain.
   Robustness: The protocol must be resilient to denial-of-service attacks.

## 1. Analysis of Existing Confidentiality Solutions in Distributed Ledger Technologies

The inherent transparency of public blockchain networks, particularly the Ethereum Virtual Machine (EVM), presents significant challenges for institutional and enterprise use cases where financial privacy is a paramount concern. Publicly auditable transaction histories expose sensitive data, including transaction amounts, counterparty relationships, and strategic capital flows. This analysis evaluates the primary technological paradigms developed to address on-chain privacy, assessing their suitability for implementing a confidential transfer mechanism for an ERC20-compliant token targeted at institutional participants.

#### Methodological Approaches to On-Chain Privacy

The landscape of confidentiality-enhancing technologies can be broadly categorized into four distinct methodological approaches, each offering a unique set of trade-offs between privacy, trust assumptions, computational overhead, and practical usability.

##### Anonymity via Mixing Protocols (e.g., Tornado Cash)

Mechanism: These protocols achieve privacy by breaking the on-chain link between a depositor and a withdrawer. Users deposit fixed denominations of a token into a common smart contract pool. After a variable time delay, the user can withdraw the same amount to a new, unlinked address by providing a cryptographic proof of deposit (typically a Zero-Knowledge Proof).

Privacy Type: Anonymity. The protocol obfuscates the transaction graph but does not conceal the transaction amount itself, which is constrained to predefined denominations.

Analysis: While effective at providing a high degree of anonymity for the transacting parties, this model is fundamentally unsuitable for institutional settlement. The constraints of fixed-value deposits preclude the transfer of arbitrary amounts required for real-world financial transactions. Furthermore, the commingling of funds in a large, unregulated public pool presents significant regulatory and compliance risks, making it an untenable solution for institutional actors.

##### Hardware-Based Privacy via Trusted Execution Environments (TEEs)

Mechanism: This approach leverages secure hardware enclaves (e.g., Intel SGX) to perform computations on encrypted data. State transitions are executed within a protected environment on a validator node, which is inaccessible to the node's host system. The TEE provides a cryptographic attestation confirming that the correct logic was executed on the encrypted state. This attestation is then verified on-chain.

Privacy Type: Confidentiality of computation. Both state and transaction data remain encrypted throughout the process.

Analysis: TEEs offer a highly flexible and performant solution, capable of supporting arbitrary, complex smart contract logic in a private manner. However, this model introduces a fundamental shift in trust assumption, from trust in mathematics (cryptography) to trust in a hardware manufacturer (e.g., Intel). The security of the entire system becomes contingent on the integrity of the TEE and its resilience to sophisticated physical and side-channel attacks. For a trust-minimized institutional protocol, introducing a hardware-based trust assumption is a significant architectural compromise.

##### Fully Homomorphic Encryption (FHE)

Mechanism: FHE is a cryptographic paradigm that allows for arbitrary computations to be performed directly on encrypted data without ever decrypting it. In a theoretical blockchain context, validators could process transactions on FHE-encrypted state, updating it to a new encrypted state without gaining any knowledge of the underlying values.

Privacy Type: Perfect computational confidentiality.

Analysis: While representing the theoretical zenith of computational privacy, FHE is currently computationally infeasible for practical application in blockchain systems. The computational overhead is several orders of magnitude greater than that of unencrypted operations, which would translate to astronomically high and prohibitive gas costs on an EVM-based network. FHE remains a subject of academic research and is not a viable technology for production systems at this time.

#### Cryptography-Based Privacy via Zero-Knowledge Proofs (ZKP)

Mechanism: ZKPs allow a "prover" to convince a "verifier" that a statement is true, without revealing any information beyond the validity of the statement itself. In a transaction context, a user can generate a ZKP that proves a state transition is valid (e.g., they own the input funds, the input value equals the output value, the remaining balance is non-negative) without revealing the specific amounts or secret keys involved.

Privacy Type: Confidentiality and/or Anonymity. ZKP systems are highly flexible and can be designed to hide various aspects of a transaction.

Analysis: ZKP-based systems are widely regarded as the industry standard for implementing trust-minimized privacy on public blockchains. Their security relies solely on established mathematical principles. The primary drawbacks are the computational intensity of proof generation (performed off-chain by the user) and the gas cost of proof verification (performed on-chain by a smart contract). However, the existence of EVM precompiles for pairing-based cryptography (EIP-197) makes on-chain verification economically viable, particularly for high-value institutional transactions where gas costs are a secondary concern to security and confidentiality.

#### Our decision:

Based on the requirements for a trust-minimized, secure, and flexible protocol for institutional-grade confidential transfers, Zero-Knowledge Proofs (ZKP) are identified as the most suitable core technology. This approach provides robust mathematical guarantees of privacy without introducing new trust assumptions (as with TEEs), while being computationally practical for deployment on the EVM (unlike FHE) and offering the required flexibility for arbitrary transaction values (unlike Mixers).

## 2. Analysis of ZKP Implementation Models on the EVM

Having selected Zero-Knowledge Proofs (ZKP) as the foundational technology, the next critical decision lies in the architectural model for representing and managing private state on-chain. The choice of data model has profound implications for user experience, gas efficiency, security, and, most importantly, the mechanism for fund recovery. This section analyzes the three primary architectural models for implementing a ZKP-based confidential token system on the EVM.

#### Model A: The UTXO (Note-based) Model

Architectural Concept: This model emulates the "Unspent Transaction Output" (UTXO) structure pioneered by Bitcoin. A user's balance is not a single state variable but the sum of a collection of discrete, unspent cryptographic notes. Each note is a Pedersen Commitment, which conceals its value, and is stored on-chain as a leaf in a Merkle tree. A transaction consumes one or more existing notes and creates new notes for the recipient and for the sender's change.

On-Chain State: The smart contract's state is minimal, primarily storing the Merkle root of all notes and a set of nullifiers (cryptographic identifiers of spent notes) to prevent double-spending.

Transaction Flow: A single, atomic transfer transaction provides a ZKP that proves ownership of the input notes, their validity within the Merkle tree, and that the sum of input values equals the sum of output values.

Pros:

- Robust Recoverability: A user can fully reconstruct their balance state by scanning the chain's event history with a secret viewing key. Loss of local client data does not result in a loss of funds.
- High Gas Efficiency (Storage): The on-chain state footprint is minimal, as the contract only stores a single merkleRoot and appends to the nullifier set, making it highly scalable in terms of the number of users and notes.
- Useful tooling: There are several tools available for working with UTXO-based systems.

Cons:

- Reliance on Off-Chain Infrastructure: This model is critically dependent on an off-chain indexer service. Without an indexer to scan and process the entire history of notes, a user's client application would be unable to discover its own notes and calculate its balance in a timely manner.
- Complex Client-Side Logic: The client application (wallet) must manage a set of UTXOs, implement coin selection algorithms, and handle change outputs. This logic is significantly more complex than managing a simple account balance.
- Audit complexity: The auditability of the protocol is complex, as it requires the auditor to scan the entire history of notes and nullifiers.

#### Model B: The Pure Account Model

Architectural Concept: This model mirrors the native account-based structure of Ethereum. Each user is associated with a single on-chain state variable representing their encrypted balance, typically as a Pedersen Commitment.

Transaction Flow: The process is bifurcated into four distinct on-chain transactions:

- deposit: The user bridge his token to private layer with corresponding private balance witch is encrypted with his private key.
- send: The sender provides a ZKP to validate a debit from their own private balance and atomically adds a to Pedersen Commitment representing the transfer to the recipient's public commitment.
- withdraw: The user provides a ZKP to prove sufficient funds and initiates a debit from their private balance and transfers the base token back to them.

Pros:

- Conceptual Simplicity: The account-based abstraction is intuitive for users and developers familiar with the ERC20 standard.
- Audit Simplicity: The audit is simple, as it only require to decrypt user balance.

Cons:

- Fatal Recovery Flaw: This model's primary drawback is its fragility. The on-chain commitment cannot be decrypted without the corresponding secret amount and blinding factor. If the user loses this local, off-chain state, their encrypted on-chain balance becomes an unspendable artifact, and the funds are permanently and irrecoverably lost.
- Interactivity Requirement: The model inherently requires interaction between the sender and recipient to complete a transfer, which is impractical for most blockchain use cases.
- State Race Condition Vulnerability: Even if interactivity is solved by passing encrypted messages on-chain, the model is vulnerable. If two senders create transactions for the same recipient concurrently, the second transaction to be mined will be based on a stale state. This results in the recipient receiving a correct public balance commitment but being unable to compute the corresponding secret blinding factor, permanently freezing the received funds.

#### Our decision: Model C - The Advanced Account Model

Architectural Concept: Recognizing the fatal flaws in the UTXO model (indexer dependency) and the Pure Account model (fund loss, interactivity, state races), we propose a hybrid architecture. The "Advanced Account Model" builds on the conceptual simplicity of the account model but introduces two critical modifications to make it robust, recoverable, and non-interactive.

Core Modifications:

1. **Solving the Recovery Flaw with On-Chain Encrypted State:** To eliminate the risk of permanent fund loss, an symmetrically encrypted copy of the user's private balance is stored on-chain alongside their public commitment. Blinding factor is deterministically derived from the user's private key.
2. **Solving the Interactivity and Race Condition Flaws with a `send`/`apply` Mechanism:** To enable non-interactive transfers and prevent state corruption, the process is bifurcated. A `send` transaction, authorized by the sender's ZKP, **only modifies the sender's own state**. It does not directly credit the recipient. Instead, it places an encrypted "pending transfer" note into a dedicated on-chain queue for the recipient. The recipient can then later, at their convenience, execute an `apply` transaction, which consumes their pending notes based on the most current state of their account and atomically updates their main balance, authorized by their own ZKP. This decoupling completely eliminates the race condition vulnerability.

Pros:

- Conceptual Simplicity: The account-based abstraction is intuitive for users and developers familiar with the ERC20 standard.
- Audit Simplicity: The audit is simple, as it only require to decrypt user balance.
- Recovery problem is solved

Cons:

- Inefficiency of `send`/`apply` mechanism: The `send` transaction is not atomic, as it does not credit the recipient. This means that the recipient may not be able to spend the funds immediately, which is inefficient. But this could be solved if some kind of multicall function is present in the contract. So it's question about functionality of UI.

## 3. Analysis of Implementation Tooling and Frameworks

The implementation of a ZKP-based confidentiality protocol is a complex undertaking that requires a specialized toolchain for cryptographic circuit development, smart contract implementation, and client-side integration. This section evaluates the available tooling and frameworks, concluding with a recommendation for a specific technology stack that aligns with the project's architectural goals and the broader EVM ecosystem.

A complete end-to-end solution can be deconstructed into three primary components, each requiring a distinct set of tools:

1. ZKP Circuit Development: The logic that defines the rules of a valid transaction.
2. On-Chain Contracts: The EVM smart contracts that act as the trust anchor and verifier.
3. Client-Side Logic: The off-chain software responsible for state management, proof generation, and transaction submission.

### ZKP Circuit Development Tooling

The choice of tooling for ZKP development involves selecting a complete stack, typically comprising a development language (for writing circuits) and a proving system (the underlying cryptographic engine). This choice is critical as it dictates performance, security, and gas efficiency.

#### Stack 1: Circom + Groth16 (The Gas-Optimized L1 Stack)

Overview: This is the most established and battle-tested stack for developing ZKP applications on the L1 EVM. It pairs the Circom DSL with the Groth16 proving system to produce highly optimized artifacts for on-chain verification.

Strengths:

- Unmatched Gas Efficiency: Groth16 is the only proving system currently supported by EVM precompiles (EIP-197), making its on-chain verification significantly cheaper than any other system.
- Ecosystem Maturity: Circom has the largest ecosystem, with extensive, audited open-source libraries (e.g., circomlib) that are critical for building secure financial protocols.

Weaknesses:

- Per-Circuit Trusted Setup: The primary drawback of Groth16 is the requirement for a new, specific trusted setup ceremony for every single circuit. Any change or bug fix necessitates a complete and complex re-deployment.
- Steep Learning Curve: Circom's low-level syntax is difficult to master and can be prone to error if not handled by experienced developers.

#### Stack 2: Noir/Circom + PLONK (The Developer-Friendly & Flexible Stack)

Overview: This stack pairs Noir, a modern, Rust-like DSL, with the PLONK proving system. It prioritizes developer experience and architectural flexibility.

Strengths:

- Superior Developer Experience: Noir's syntax is high-level and intuitive, reducing development time and the likelihood of bugs.
- Universal Trusted Setup: PLONK's major advantage is its use of a single, universal, and updatable trusted setup. Circuits can be updated and deployed without requiring a new ceremony, offering immense flexibility.

Weaknesses:

- Higher L1 Gas Cost: Lacking precompile support, PLONK verifiers must be implemented in Solidity/Yul, resulting in significantly higher gas costs for on-chain verification compared to Groth16.
- Immaturity: As a newer stack, the ecosystem and available libraries for Noir are less extensive than for Circom.

#### Stack 3: Cairo + STARKs (The L2 Scalability Stack)

Overview: This stack pairs the Cairo language with STARKs, a type of ZKP that requires no trusted setup. It is purpose-built by StarkWare for their L2 scaling solution, StarkNet.

Strengths:

- No Trusted Setup ("Transparency"): This is a major security and logistical advantage, removing a key centralizing vector.

Weaknesses:

- Prohibitively High L1 Verification Cost: The trade-off for transparency is a very large proof size. Verifying a STARK proof directly on the L1 EVM is extremely gas-intensive, making it economically unfeasible for a single L1 transaction.
- L2-Specific Ecosystem: The entire toolchain is designed for the StarkNet L2 and is not intended for generating verifiers for standard L1 EVM contracts.

#### Conclusion and Recommendation

The choice of ZKP stack presents a clear trade-off between L1 efficiency, architectural flexibility, and development velocity.

| Stack            | L1 Gas Cost | Trusted Setup | Maturity & Risk | Target Use Case                |
| :--------------- | :---------- | :------------ | :-------------- | :----------------------------- |
| Circom + Groth16 | Lowest      | Per-Circuit   | Highest         | L1 Applications                |
| Noir + PLONK     | High        | Universal     | Medium          | L1 Apps (gas-insensitive), L2s |
| Cairo + STARKs   | Prohibitive | None          | High            | L2 Rollups                     |

Cairo + STARKs are immediately disqualified due to prohibitive L1 verification costs. The decision is between Groth16's efficiency and PLONK's flexibility.

For this project an institutional grade protocol on L1 where long term stability is a feature and gas costs for end-users are a primary concern, the benefits of Groth16's efficiency and the maturity of the Circom ecosystem outweigh the flexibility offered by PLONK. The operational overhead of a per-circuit trusted setup is a one-time cost that is acceptable for establishing a secure, long-lasting standard.

Recommendation: The **Circom + Groth16** stack is the recommended choice. It is the most conservative, lowest-risk, and most gas-efficient solution for the specific requirements of this L1 project.

### On-Chain Development and Client-Side Integration

While the cryptographic core (ZKP circuits) requires bespoke development, the on-chain contracts and client-side application can leverage existing tools to accelerate development and reduce risk.

The primary challenge is that the most mature open-source frameworks, such as Paladin (a Linux Foundation project), are architected around a UTXO-based state model. While these frameworks are not a turnkey solution for our chosen Advanced Account Model, their underlying components (audited cryptographic libraries, client-side SDKs for proof generation) are invaluable foundational elements.

The recommended approach is a hybrid one: build the custom on-chain contracts and ZKP logic for our account model, but heavily rely on the battle-tested libraries and client-side tooling from the existing ecosystem to handle fundamental cryptographic operations and proof generation.

A critical success factor for adoption will be the development of a highly intuitive client-side interface (e.g., a web application or SDK). This interface must abstract away the immense complexity of the underlying protocol—state management, `send`/`apply` mechanics, proof generation, and recovery flows—to provide a seamless and simple user experience, comparable to that of a standard ERC20 transfer.

## 4. Final Architecture Specification

### 4.1. Architectural Model: The Advanced Account Model

The protocol implements the **Advanced Account Model**, a non-interactive, fully recoverable account-based system. Each user address is mapped to a single private account state on-chain. This model is chosen for its user experience benefits and robustness against client-side data loss.

### 4.2. ZKP Technology Stack

- Proving System: Groth16. Chosen for its unmatched on-chain verification efficiency on the L1 EVM via precompiles.
- Circuit DSL: Circom. Chosen for its maturity, extensive libraries (circomlib), and direct compatibility with Groth16.
- Core Hash Function: Poseidon. Used for all on-chain hashing (commitments, nullifiers) due to its extreme efficiency within ZKP circuits.
- Symmetric Encryption: A Poseidon-based stream cipher. A shared secret derived via ECDH is used as a seed for a Poseidon-based keystream, which is then XORed (field addition) with the plaintext data (`amount`, `blindingFactor`).

### 4.3. Key Derivation Scheme

All cryptographic keys are derived from the user's standard Ethereum private key (`sk`) to ensure full recoverability.

- Private Key (`usk` - User Secret Key): `usk = keccak256("<string>", sk)`
- Public Key (`upk` - User Public Key): `upk = usk * G` where `G` is the generator point of the BabyJubJub curve. This key is used to receive encrypted transfers.
- Symmetric Encryption Key (`esk` - Encryption/Decryption Key): `esk = keccak256("<string>", sk)` This key is used for the Poseidon based stream cipher encryption of the user's on-chain recovery state.
- Blinding Factor (`r`): The blinding factor for the Pedersen commitment is derived deterministically to ensure recoverability. `r = poseidon("<string>", usk, tokenAddress, nonce)`. A unique `r` is generated for each state update by incrementing the `nonce`.

### 4.4. Core Functions and ZKP Circuits

#### `deposit(uint256 amount)`

- Flow: A public function. The user calls `deposit` on the ERC20 token to approve the SCICP contract, then calls `deposit` on the SCICP contract. The contract pulls the tokens and internally calls `applyPending` to credit the user's private balance. The initial state (`amount`, `r`) is encrypted with the user's `esk` and stored on-chain.

#### `send(address recipient, bytes calldata proof, ...)`

- ZKP Circuit Inputs:
  - Private: `userSecretKey`, `oldAmount`, `oldBlindingFactor`, `oldNonce`, `transferAmount`.
  - Public: `oldCommitment`, `newCommitment`, `pendingTransferCommitment`, `recipientPublicKey`.
- MAIN Circuit Constraints:
  1. Prove ownership of `oldCommitment` by deriving the public key from `userSecretKey` and checking against the sender's address.
  2. Verify `oldCommitment == poseidon(oldAmount, oldBlindingFactor)`.
  3. Enforce nonce increment: `newNonce = oldNonce + 1`.
  4. Enforce balance conservation: `newAmount = oldAmount - transferAmount`.
  5. Perform a range check: `transferAmount >= 0` and `oldAmount >= transferAmount`.
  6. Calculate the new state commitment: `newCommitment = poseidon(newAmount, poseidon("BLINDING_FACTOR", usk, newNonce))`.
  7. Create the `pendingTransferCommitment` and the encrypted payload for the recipient.
- Contract Logic: The contract verifies the proof, updates the sender's state (`newCommitment`, new encrypted recovery payload, new nonce), and adds the `pendingTransfer` to the recipient's queue.

#### `applyPending(bytes calldata proof, ...)`

- ZKP Circuit Inputs:
  - Private: `userSecretKey`, `oldAmount`, `oldBlindingFactor`, `oldNonce`, `pendingAmounts[]`, `pendingBlindingFactors[]`.
  - Public: `oldCommitment`, `newCommitment`, `pendingTransferCommitments[]`.
- MAIN Circuit Constraints:
  1. Prove ownership of `oldCommitment`.
  2. For each pending transfer, verify that `pendingTransferCommitments[i]` corresponds to the private inputs `pendingAmounts[i]` and `pendingBlindingFactors[i]`.
  3. Calculate the new amount: `newAmount = oldAmount + sum(pendingAmounts)`.
  4. Calculate the new state commitment: `newCommitment = poseidon(newAmount, poseidon("BLINDING_FACTOR", usk, newNonce))`.
- Contract Logic: The contract verifies the proof, updates the user's state (`newCommitment`, etc.), and clears their `pendingTransfers` queue.

#### `withdraw(uint256 amount, bytes calldata proof, ...)`

- Flow: Similar to `send`, but the ZKP proves a debit from the private balance. On successful verification, the contract transfers the `amount` of the base ERC20 token back to the user.

### 4.5. Auditor Key Rotation

The protocol will implement a Push Model key rotation for compliance.

- Mechanism: During each `send` and `applyPending` transaction, the ZKP circuit will enforce the creation of a second encrypted payload containing the transaction details (`amount`, etc.). This payload is encrypted with the public key of the `auditor` address currently stored in the contract.
- Rotation Procedure:
  1. An authorized admin calls `setAuditor(newAuditorAddress)`.
  2. From this point forward, all new transaction payloads are encrypted for the new auditor.
  3. Access to historical data is handled via a secure, off-chain handover process. The outgoing auditor is legally and contractually obligated to provide the incoming auditor with their private viewing key.
- Justification: This model is chosen for its on-chain simplicity and superior UX (no action required from users). The reliance on an off-chain process for historical data is deemed an acceptable operational risk for the target institutional audience.

### 4.6. Cross-chain compatibility

The best candidate for implementing cross-chain transfers is LayerZero with their OFT. Our implementation is very low-level and can be easily and trivially added to OFT to obtain ConfidentialOFT. This will be achieved by performing all ZKP validations on the sending blockchain and performing a regular send that will add tokens to the recipient's pendingTransfer on another blockchain.

But there is one problem: in this case, at the moment of sending the cross-chain message, it will be necessary to perform a public burn from the shield pool. There are two solutions to this problem:

1. Burn and mint tokens upon deposit and withdrawal. From a technical point of view, this is the ideal solution, but from a business point of view, it causes a totalSupply problem because it will be significantly lower than the actual values. If this is acceptable, then this option should be implemented 100%.
2. Introduce a new bot participant who will regulate the set of transfers. That is, when a user sends 100 tokens, the debt of tokens to the system is recorded in an encrypted field that only the settler has access to, and, for example, once a day or once a week, the settler will apply the total change for that period of time to the public totalSupply. There are two problems with this implementation: the first is the obvious appearance of a new off-chain entity, and the second is that during this period of time, several transfers must occur in order to provide at least some privacy for the funds.

# DRAFTS

### To be discussed

- Do we need to limit max amount of pending transfers?
- Do we sure that Groth16 is better for this project than PLONK? How often zk circuit will be updated?
- How to allow new auditor see past transfers?
- Do we list all constraints in the MAIN ZKP circuit?
- Maybe usk should be derived from signature of some data (`"<string>", sk`)?
- How to make transferFrom works with with private balances? Do we need them?
- ...

#### Railgun Research

Reviewing Railgun Ethereum contract, I analyze some transactions (transfers) and calculate the average gas cost at 1,000,000, with a range of 500,000 to 2,000,000. Thus, for a calm blockchain with ~ 0.5 gwei for gas, the transfer cost is about 1–2 dollars . On October 10, 2025, when the blockchain was very active, the average gas price was ~ 15 gwei, and the transfer cost was about 20–40 dollars.

This is quite acceptable for institutional use.

#### Groth16 vs. PLONK

I write a simple 30-line circom scheme and compile it into Groth16Verifier.sol (using precompiles) and PlonkVerifier.sol (assembly implementation). So, after simple tests verifying the proof on the chain, I get the following: Groth16 — 200,000 gas, Plonk — 270,000. Trying to predict the gas cost for a real scheme, I would say that Groth16 is 300,000–400,000, Plonk 800,000–1,000,000 gas.
In terms of institutional use, Plonk, with its single ceremony, would be the best choice.

As for institutional usage Plonk with his only ones ceremony would be better choice.Auditor key rotation

I see only two feasible options:

1. Push model – with each transfer, in addition to the main logic, users must encode the amount for the auditor. The main problem is that when the auditor changes, they cannot decode past events.
2. Pull model – each user shares their viewing key in the chain with the auditor, and from that moment on, the auditor can decode their transfers.
   Problems – the auditor cannot decrypt the amounts until the user shares their key. When changing auditors, ALL users must share their key with the new auditor, but the previous auditor will still be able to decrypt new events.

In terms of institutional use, the first option is better because the UX is better and the problem can be solved if the previous auditor shares their “private viewing key” with the new auditor.
