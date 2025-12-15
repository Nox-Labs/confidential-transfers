# Confidential Transfers SDK

The Confidential Transfers SDK is a TypeScript library that provides a set of functions to interact with the ERC20 Confidential Transfers extension.

## Installation

1. Install the package:

```bash
npm install @nox-labs/confidential-transfers-sdk
```

2. Install the zk keys or generate them

## How to use

1. Import the package:

```typescript
import { SDK } from "@nox-labs/confidential-transfers-sdk"
```

2. Initialize the SDK:

```typescript
const sdk = new SDK(contractAddress, provider, {
  paths: {
    helpers: "@nox-labs/confidential-transfers-sdk/artifacts/proofs-helpers",
    keys: "<path to downloaded zk keys>",
  },
})
```

3. Generate the confidential keys:

```typescript
const { cPrivateKey, cPublicKey_X, cPublicKey_Y } =
  await SDK.deriveConfidentialKeys(entropy)
```

> The `entropy` could be any string, but it's should be somehow derived from the user's private key or private key should be involved in the derivation. We recommend two options:
>
> 1. Use the user's master private key as the entropy: `entropy = ethPrivateKey`.
> 2. Use this derivation process: `entropy = (random bytes > sign by user > signature)`

4. Generate the proof:

```typescript
const initInputs = await sdk.getCircuitInputsForInit(cPrivateKey)
const initProofOutput = await sdk.generateInitProof(initInputs)
const initParams = sdk.getInitParams(initProofOutput)
await sdk.token.cInit(initParams)
```
