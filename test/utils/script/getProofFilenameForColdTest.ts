import { ethers } from "ethers"

export const PROOFS_DIR = "test/utils/script/proofs"

export const DEPOSIT_AMOUNT = ethers.parseEther("100")
export const WITHDRAW_AMOUNT = ethers.parseEther("10")
export const TRANSFER_AMOUNT = ethers.parseEther("10")

export type Operation =
  | "init"
  | "deposit"
  | "transfer"
  | "apply"
  | "withdraw"
  | "applyAndTransfer"
  | "claim"

export const getProofFilenameForColdTest = (
  operation: Operation,
  user: number,
  nonce: bigint | number,
  amount?: bigint,
  indexes?: number[],
) =>
  `${operation}-user:${user}-nonce:${nonce}${
    amount ? `-amount:${amount.toString()}` : ""
  }${indexes ? `-indexes:[${indexes.join(",")}]` : ""}`
