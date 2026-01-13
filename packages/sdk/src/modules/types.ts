import { BigNumberish } from "ethers"

export type ProofOutput = {
  proof: BigNumberish[]
  pubSignals: BigNumberish[]
}

export type CircuitInitInputs = CPrivateKey

export type CircuitUpdateInputs = CPrivateKey &
  OldState & {
    operation: bigint
    amount: bigint
  }

export type CircuitTransferInputs = CPrivateKey &
  OldState & {
    transferAmount: bigint
    recipientPublicKey_X: bigint
    recipientPublicKey_Y: bigint
  }

export type CircuitApplyInputs = CPrivateKey &
  OldState & {
    pendingTransfersAmounts: bigint[]
    pendingTransfersOTKs: bigint[]
    n: bigint
    pendingTransfersCommitments: bigint[]
  }

export type CircuitApplyAndTransferInputs = CircuitApplyInputs &
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

type CPrivateKey = {
  cPrivateKey: bigint
}

type OldState = {
  oldAmount: bigint
  oldNonce: bigint
  oldCommitment: bigint
}
