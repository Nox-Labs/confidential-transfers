import {
  CircuitInitInputs,
  CircuitUpdateInputs,
  CircuitTransferInputs,
  CircuitApplyInputs,
  CircuitApplyAndTransferInputs,
  CircuitClaimInputs,
} from "./types.js"
import { Token } from "./token.js"
import type { ConfidentialTransfersBridgeable } from "../artifacts/typechain/src/ConfidentialTransfersBridgeable.js"

export class Inputs extends Token {
  MAX_PENDING_TRANSFERS_APPLY = 10

  /**
   *
   * @param cPrivateKey Should be derived from the user's private key or signature
   * @returns
   */
  async getCircuitInputsForInit(
    cPrivateKey: bigint,
  ): Promise<CircuitInitInputs> {
    return {
      ...(await this.getTarget()),
      cPrivateKey,
    }
  }

  async getCircuitInputsForDeposit(
    account: string,
    cPrivateKey: bigint,
    amount: bigint,
  ): Promise<CircuitUpdateInputs> {
    return await this.getCircuitInputsForUpdate(
      account,
      cPrivateKey,
      0n,
      amount,
    )
  }

  async getCircuitInputsForWithdraw(
    account: string,
    cPrivateKey: bigint,
    amount: bigint,
  ): Promise<CircuitUpdateInputs> {
    return await this.getCircuitInputsForUpdate(
      account,
      cPrivateKey,
      1n,
      amount,
    )
  }

  async getCircuitInputsForTransfer(
    account: string,
    cPrivateKey: bigint,
    to: string,
    transferAmount: bigint,
  ): Promise<CircuitTransferInputs> {
    const senderAccountData = await this.token.getAccount(account)

    const oldNonce = senderAccountData.state.nonce

    const oldAmount = await this.decryptAmount(
      cPrivateKey,
      oldNonce,
      senderAccountData.state.eAmount,
    )

    const { pubKeyX, pubKeyY } = await this.token.getAccount(to)

    return {
      ...(await this.getTarget()),
      cPrivateKey,
      oldAmount,
      oldNonce,
      oldCommitment: BigInt(senderAccountData.state.commitment),
      transferAmount,
      recipientPublicKeyX: pubKeyX,
      recipientPublicKeyY: pubKeyY,
    }
  }

  async getCircuitInputsForApply(
    account: string,
    cPrivateKey: bigint,
    pendingTransfersIndexes: number[],
  ): Promise<CircuitApplyInputs> {
    if (pendingTransfersIndexes.length > this.MAX_PENDING_TRANSFERS_APPLY)
      throw new Error(
        `Max pending transfers apply is ${this.MAX_PENDING_TRANSFERS_APPLY}`,
      )

    const senderAccountData = await this.token.getAccount(account)

    const oldNonce = senderAccountData.state.nonce

    const oldAmount = await this.decryptAmount(
      cPrivateKey,
      oldNonce,
      senderAccountData.state.eAmount,
    )

    const filteredPendingTransfers = senderAccountData.pendingTransfers.filter(
      (_, index) => pendingTransfersIndexes.includes(index),
    )

    const { pubKeyXs, pubKeyYs } = await this.token.getCPublicKeys(
      filteredPendingTransfers.map((transfer) => transfer.sender),
    )

    const decryptedAmountsWithOTKs = await Promise.all(
      filteredPendingTransfers.map(async (transfer, index) => {
        const pubKeyX = pubKeyXs[index]
        const pubKeyY = pubKeyYs[index]
        const sharedKey = await Token.deriveSharedKey(
          cPrivateKey,
          pubKeyX,
          pubKeyY,
        )

        const amount = await this.decryptAmount(
          sharedKey,
          transfer.payload.nonce,
          transfer.payload.eAmount,
        )

        const otk = await this.generateOTK(sharedKey, transfer.payload.nonce)

        return { amount, otk }
      }),
    )

    const MAX = this.MAX_PENDING_TRANSFERS_APPLY

    const pendingTransfersCommitments = Array(MAX).fill(0n)
    for (let i = 0; i < filteredPendingTransfers.length; i++)
      pendingTransfersCommitments[i] = BigInt(
        filteredPendingTransfers[i].payload.commitment,
      )

    const pendingTransfersAmounts = Array(MAX).fill(0n)
    for (let i = 0; i < decryptedAmountsWithOTKs.length; i++)
      pendingTransfersAmounts[i] = decryptedAmountsWithOTKs[i].amount

    const pendingTransfersOTKs = Array(MAX).fill(0n)
    for (let i = 0; i < decryptedAmountsWithOTKs.length; i++)
      pendingTransfersOTKs[i] = decryptedAmountsWithOTKs[i].otk

    return {
      ...(await this.getTarget()),
      cPrivateKey,
      oldAmount,
      oldNonce,
      oldCommitment: senderAccountData.state.commitment,
      n: BigInt(pendingTransfersIndexes.length),
      pendingTransfersCommitments,
      pendingTransfersAmounts,
      pendingTransfersOTKs,
    }
  }

  async getCircuitInputsForApplyAndTransfer(
    account: string,
    cPrivateKey: bigint,
    pendingTransfersIndexes: number[],
    to: string,
    transferAmount: bigint,
  ): Promise<CircuitApplyAndTransferInputs> {
    return {
      ...(await this.getCircuitInputsForApply(
        account,
        cPrivateKey,
        pendingTransfersIndexes,
      )),
      ...(await this.getCircuitInputsForTransfer(
        account,
        cPrivateKey,
        to,
        transferAmount,
      )),
    }
  }

  async getCircuitInputsForClaim(
    account: string,
    cPrivateKey: bigint,
    indexToClaim: number,
    cPrivateKeyUsedInTransfer?: bigint,
  ): Promise<CircuitClaimInputs> {
    cPrivateKeyUsedInTransfer = cPrivateKeyUsedInTransfer ?? cPrivateKey

    const failedCrossChainTransfers = await (
      this.token as ConfidentialTransfersBridgeable
    ).getFailedCrossChainTransfers(account)

    if (failedCrossChainTransfers.length <= indexToClaim)
      throw new Error("No failed cross-chain transfers found")

    const transferToClaim = failedCrossChainTransfers[indexToClaim]

    const accountData = await this.token.getAccount(account)

    const oldNonce = accountData.state.nonce

    const oldAmount = await this.decryptAmount(
      cPrivateKey,
      oldNonce,
      accountData.state.eAmount,
    )

    const sharedKey = await Token.deriveSharedKey(
      cPrivateKeyUsedInTransfer,
      transferToClaim.recipientPubKeyX,
      transferToClaim.recipientPubKeyY,
    )

    const pendingAmount = await this.decryptAmount(
      sharedKey,
      transferToClaim.pendingTransfer.payload.nonce,
      transferToClaim.pendingTransfer.payload.eAmount,
    )

    return {
      ...(await this.getTarget()),
      cPrivateKey,
      cPrivateKeyUsedInTransfer,
      recipientPublicKeyX: transferToClaim.recipientPubKeyX,
      recipientPublicKeyY: transferToClaim.recipientPubKeyY,
      pendingTransferNonce: transferToClaim.pendingTransfer.payload.nonce,
      pendingTransferAmount: pendingAmount,
      pendingTransferCommitment:
        transferToClaim.pendingTransfer.payload.commitment,
      oldAmount,
      oldNonce,
      oldCommitment: BigInt(accountData.state.commitment),
    }
  }

  private async getCircuitInputsForUpdate(
    account: string,
    cPrivateKey: bigint,
    operation: bigint,
    amount: bigint,
  ): Promise<CircuitUpdateInputs> {
    const accountData = await this.token.getAccount(account)

    const oldNonce = accountData.state.nonce

    const oldAmount = await this.decryptAmount(
      cPrivateKey,
      oldNonce,
      accountData.state.eAmount,
    )

    return {
      ...(await this.getTarget()),
      cPrivateKey,
      oldAmount,
      oldNonce,
      oldCommitment: BigInt(accountData.state.commitment),
      operation,
      amount,
    }
  }
}
