import { BigNumberish } from "ethers"

export type ProofOutput = {
  proof: BigNumberish[]
  pubSignals: BigNumberish[]
}

export type CircuitInitInputs = Target & CPrivateKey

export type CircuitUpdateInputs = Target &
  CPrivateKey &
  OldState & {
    operation: bigint
    amount: bigint
  }

export type CircuitTransferInputs = Target &
  CPrivateKey &
  OldState & {
    transferAmount: bigint
    recipientPublicKeyX: bigint
    recipientPublicKeyY: bigint
  }

export type CircuitApplyInputs = Target &
  CPrivateKey &
  OldState & {
    pendingTransfersAmounts: bigint[]
    pendingTransfersOTKs: bigint[]
    n: bigint
    pendingTransfersCommitments: bigint[]
  }

export type CircuitApplyAndTransferInputs = Target &
  CircuitApplyInputs &
  CircuitTransferInputs

export type CircuitInputs =
  | CircuitInitInputs
  | CircuitUpdateInputs
  | CircuitTransferInputs
  | CircuitApplyInputs
  | CircuitApplyAndTransferInputs

export type SDKOptions = {
  isOFT?: boolean
  paths: {
    helpers: string
    keys: string
  }
}

type Target = {
  chainId: bigint
  contractAddress: bigint
}

type CPrivateKey = {
  cPrivateKey: bigint
}

type OldState = {
  oldAmount: bigint
  oldNonce: bigint
  oldCommitment: bigint
}
