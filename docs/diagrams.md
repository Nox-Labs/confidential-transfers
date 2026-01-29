```mermaid
sequenceDiagram
    actor Alice
    actor Bob
    participant Wallet
    participant ZKContract as Confidential Extension
    participant ERC20 as Public ERC20 Token

    %% 1. Deposit Flow
    Note over Alice, ZKContract: 1. Deposit Flow
    Alice->>Wallet: 1.1 Request to deposit 100 tokens

    activate Wallet
    Wallet->>Wallet: 1.2 Generate ZKP for deposit
    deactivate Wallet
    Wallet->>ZKContract: 1.3 deposit(proof, publicSignals)

    activate ZKContract
    ZKContract->>ERC20: 1.4 transfer(Alice, Contract, 100)
    ZKContract->>ZKContract: 1.6 Update Alice's private balance
    deactivate ZKContract
    ZKContract-->>Wallet: Deposit successful

    %% 2. Transfer Flow (Alice sends to Bob)
    Note over Alice, ZKContract: 2. Transfer Flow (Send)
    Alice->>Wallet: 2.1 Send 10 confidential tokens to Bob

    activate Wallet
    Wallet->>ZKContract: 2.2 Fetch Bob's public key
    ZKContract-->>Wallet: Bob's public key
    Wallet->>Wallet: 2.3 Generate ZKP for transfer
    Wallet->>Wallet: 2.4 Encrypt transfer note for Bob
    deactivate Wallet

    Wallet->>ZKContract: 2.5 confidentialTransfer(proof, publicSignals)

    activate ZKContract
    ZKContract->>ZKContract: 2.6 Verify ZKP & update Alice's state
    ZKContract->>ZKContract: 2.7 Add encrypted note to Bob's pending transfers queue
    deactivate ZKContract
    ZKContract-->>Wallet: Transfer sent

    %% 3. Apply Flow (Bob receives from Alice)
    Note over Bob, ZKContract: 3. Apply Flow (Receive)
    Bob->>Wallet: 3.1 Check for incoming funds

    activate Wallet
    Wallet->>ZKContract: 3.2 Scan for Bob's pending transfers
    ZKContract-->>Wallet: Found 1 encrypted note
    Wallet->>Wallet: 3.3 Decrypt note using shared secret
    Wallet->>Wallet: 3.4 Generate ZKP for applying the note
    deactivate Wallet

    Wallet->>ZKContract: 3.5 applyPending(proof, publicSignals)

    activate ZKContract
    ZKContract->>ZKContract: 3.6 Verify ZKP
    ZKContract->>ZKContract: 3.7 Consume note & update Bob's private balance
    deactivate ZKContract
    ZKContract-->>Wallet: Balance updated

    %% 4. Withdraw Flow
    Note over Alice, ZKContract: 4. Withdraw Flow
    Alice->>Wallet: 4.1 Request to withdraw 90 tokens

    activate Wallet
    Wallet->>Wallet: 4.2 Generate ZKP for withdrawal
    deactivate Wallet

    Wallet->>ZKContract: 4.3 withdraw(proof, publicSignals)

    activate ZKContract
    ZKContract->>ZKContract: 4.4 Verify ZKP & update Alice's private balance
    ZKContract->>ERC20: 4.5 transfer(Contracts,Alice, 90)
    deactivate ZKContract
    ZKContract-->>Wallet: Withdraw successful

```

## Architectural Diagrams

### Integration Pattern 1: Inheritance

This pattern involves creating a new token contract that inherits from both a standard ERC20 implementation (like OpenZeppelin's) and our `ERC20ConfidentialTransfers` contract.

**Pros:** All functionality is bundled into a single, unified contract address.

**Cons:** Requires deploying a brand new token; cannot be used to add confidentiality to an _existing_ ERC20 token.

```mermaid
graph TD
    subgraph New Token Contract
        A[ERC20ConfidentialTransfers<br/><br/><i>Handles all ZKP logic, private state, and confidential functions cTransfer, apply, etc.</i>];
        B[OpenZeppelin ERC20<br/><br/><i>Provides standard public function from ERC20 </i>];
        C[NewConfidentialToken<br/><br/><b>Users interact with this single contract address</b>];
    end

    A -- Inherited by --> C;
    B -- Inherited by --> C;
```

### Integration Pattern 2: Adapter (Wrapper)

> If existing token deployed with Proxy pattern, it can be upgraded to use the Confidential Extension without adapter.

This pattern uses a separate "Adapter" or "Extension" contract that "wraps" an existing, already-deployed ERC20 token. Users interact with the Adapter to access confidential features.

**Pros:** Can add confidential functionality to _any_ existing ERC20 token without needing to migrate liquidity or deploy a new token.

**Cons:** Users need to know two contract addresses (the token and the adapter). The adapter needs to hold the tokens in escrow.

```mermaid
graph TD
    subgraph System Architecture
        A[Existing ERC20 Token<br/><br/><i>e.g., WETH, USDC. Holds all public balances.</i>];
        B[Confidential Adapter Contract<br/><br/><i>Holds all shielded tokens in escrow and manages all ZKP logic and private state.</i>];
    end

    subgraph User Interactions
        C(User);
    end

    C -- "approve()" --> A;
    C -- "deposit()" --> B;
    B -- "transferFrom()"<br/>(Pulls tokens into escrow) --> A;

    C -- "confidentialTransfer()"<br/>(Interacts with private state) --> B;

    C -- "withdraw()" --> B;
    B -- "transfer()"<br/>(Releases tokens from escrow) --> A;
```

### Auditor Visibility Flow

This diagram shows the flow of information that ensures auditor visibility for every transaction.

```mermaid
graph LR
    subgraph Sender's Action
        A[1. Prepare Transaction <br/> amount, recipient, etc.];
        B[2. Fetch Auditor Public Key];
    end

    subgraph On-Chain
        C[Confidential Contract];
        D[3. Post Encrypted Notes];
    end

    subgraph Auditor's Action
        E[4. Scan On-Chain Data];
        F[5. Decrypt with Private Key];
        G[6. View Transaction Details];
    end

    A --> B;
    B --> D;
    C -.-> B;

    D --> E;
    E --> F;
    F --> G;
```

### Contract Architecture Diagram

This diagram shows the composition of the confidential transfer system at the smart contract level. It illustrates how a central logic contract (`ERC20ConfidentialTransfers`) orchestrates multiple, single-purpose ZKP verifier contracts.

```mermaid
graph TD
    subgraph "Confidential Transfer System"
        A[ERC20ConfidentialTransfers.sol<br/><i></i>];

        subgraph "ZKP Verifiers"
            B[InitVerifier.sol];
            C[Deposit/WithdrawVerifier.sol];
            D[TransferVerifier.sol];
            E[ApplyVerifier.sol];
        end
    end

    subgraph "External Dependencies"
        F[IERC20<br/><i></i>];
    end

    A -- Calls 'verifyProof()' on --> B;
    A -- Calls 'verifyProof()' on --> C;
    A -- Calls 'verifyProof()' on --> D;
    A -- Calls 'verifyProof()' on --> E;

    A -- Holds tokens in escrow via --> F;
```

### Core Concept: The Shielded Pool

This diagram illustrates the main architectural concept. The contract acts as a "shielded pool" that holds public ERC20 tokens in escrow, allowing users to transact with a private representation of those tokens on a "ZK Layer".

```mermaid
graph TD
    subgraph "Public Layer (ERC20)"
        UserA[User Alice];
        UserB[User Bob];
    end

    subgraph "Confidential Extension Contract"
        Contract[Entry / Exit Point <br/> <i>Holds public tokens in escrow</i>];

        subgraph "Confidential Layer"
            PrivateA[Alice's Private Balance];
            PrivateB[Bob's Private Balance];

            PrivateA -- "2. Confidential Transfer<br/>" --> PrivateB;
        end
    end

    UserA -- "1. Deposit<br/>(Public ERC20 In)" --> Contract;
    Contract -- Creates --> PrivateA;

    PrivateB -- "3. Withdraw<br/>(Public ERC20 Out)" --> Contract;
    Contract -- "4. Releases tokens from escrow" --> UserB;

```
