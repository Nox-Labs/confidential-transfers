import { BigNumberish } from "ethers"

export type ProofOutput = {
  proof: BigNumberish[]
  pubSignals: BigNumberish[]
}

export type CircuitInitInputs = CPrivateKey & AuditorPublicKeys

export type CircuitUpdateInputs = CPrivateKey &
  AuditorPublicKeys &
  OldState & {
    operation: bigint
    amount: bigint
  }

export type CircuitTransferInputs = CPrivateKey &
  AuditorPublicKeys &
  OldState & {
    transferAmount: bigint
    recipientPublicKey_X: bigint
    recipientPublicKey_Y: bigint
  }

export type CircuitApplyInputs = CPrivateKey &
  AuditorPublicKeys &
  OldState & {
    pendingTransfersAmounts: bigint[]
    pendingTransfersBF: bigint[]
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

export type SDKOptions = {
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

type AuditorPublicKeys = {
  auditorPublicKey_X: bigint
  auditorPublicKey_Y: bigint
}
