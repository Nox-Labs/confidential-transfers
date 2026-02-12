import { BigNumberish } from "ethers"

export type ProofOutput = {
  proof: BigNumberish[]
  pubSignals: BigNumberish[]
}

export type Target = {
  chainId: bigint
  contractAddress: bigint
}

export type CPrivateKey = {
  cPrivateKey: bigint
}

export type OldState = {
  oldAmount: bigint
  oldNonce: bigint
  oldCommitment: bigint
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

export type CircuitApplyAndTransferInputs = CircuitApplyInputs &
  CircuitTransferInputs

export type CircuitClaimInputs = Target &
  CPrivateKey &
  OldState & {
    cPrivateKeyUsedInTransfer: bigint
    recipientPublicKeyX: bigint
    recipientPublicKeyY: bigint
    pendingTransferNonce: bigint
    pendingTransferAmount: bigint
    pendingTransferCommitment: bigint
  }

export type CircuitInputs =
  | CircuitInitInputs
  | CircuitUpdateInputs
  | CircuitTransferInputs
  | CircuitApplyInputs
  | CircuitApplyAndTransferInputs
  | CircuitClaimInputs

export type SDKOptions = {
  type?:
    | "ConfidentialTransfers"
    | "ConfidentialTransfersBridgeable"
    | "ConfidentialOFT"
  paths: {
    helpers: string
    keys: string
  }
}
