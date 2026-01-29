# Confidential Transfers SDK

The Confidential Transfers SDK is a TypeScript library that provides a set of functions to interact with the ERC20 Confidential Transfers extension.

- [Npm package](https://www.npmjs.com/package/@noxlabs/confidential-transfers-sdk)

## Installation

1. Install the package:

```bash
npm install @noxlabs/confidential-transfers-sdk
```

2. Install the zk keys or generate them

```bash
KEYS_SOURCE_URL="https://tan-hollow-gerbil-264.mypinata.cloud/ipfs/bafybeib7myufblrjs6tsmv3pb5guunwk4byg43qoxj6d5bjtipx2aptlke"
curl -L "${KEYS_SOURCE_URL}/init/init_final.zkey" -o keys/init/init_final.zkey
curl -L "${KEYS_SOURCE_URL}/apply/apply_final.zkey" -o keys/apply/apply_final.zkey
curl -L "${KEYS_SOURCE_URL}/update/update_final.zkey" -o keys/update/update_final.zkey
curl -L "${KEYS_SOURCE_URL}/transfer/transfer_final.zkey" -o keys/transfer/transfer_final.zkey
curl -L "${KEYS_SOURCE_URL}/applyAndTransfer/applyAndTransfer_final.zkey" -o keys/applyAndTransfer/applyAndTransfer_final.zkey
```

## How to use

1. Import the package:

```typescript
import { SDK } from "@noxlabs/confidential-transfers-sdk"
```

2. Initialize the SDK:

```typescript
const sdk = new SDK(contractAddress, provider, {
  paths: {
    helpers: "@noxlabs/confidential-transfers-sdk/artifacts/proofs-helpers",
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
