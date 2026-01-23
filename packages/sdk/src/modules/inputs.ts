import {
  CircuitInitInputs,
  CircuitUpdateInputs,
  CircuitTransferInputs,
  CircuitApplyInputs,
  CircuitApplyAndTransferInputs,
} from "./types.js"
import { Token } from "./token.js"

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
    const network = await this.token.runner?.provider?.getNetwork()
    if (!network) throw new Error("Network not found")
    return {
      chainId: BigInt(network.chainId),
      contractAddress: BigInt(await this.token.getAddress()),
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

    const oldAmount = await Token.decryptAmount(
      cPrivateKey,
      oldNonce,
      senderAccountData.state.eAmount,
    )

    const { pubKeyX, pubKeyY } = await this.token.getAccount(to)

    const network = await this.token.runner?.provider?.getNetwork()
    if (!network) throw new Error("Network not found")

    return {
      chainId: BigInt(network.chainId),
      contractAddress: BigInt(await this.token.getAddress()),
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

    const oldAmount = await Token.decryptAmount(
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

        const amount = await Token.decryptAmount(
          sharedKey,
          transfer.payload.nonce,
          transfer.payload.eAmount,
        )

        const otk = await Token.generateOTK(sharedKey, transfer.payload.nonce)

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

    const network = await this.token.runner?.provider?.getNetwork()
    if (!network) throw new Error("Network not found")

    return {
      chainId: BigInt(network.chainId),
      contractAddress: BigInt(await this.token.getAddress()),
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

  private async getCircuitInputsForUpdate(
    account: string,
    cPrivateKey: bigint,
    operation: bigint,
    amount: bigint,
  ): Promise<CircuitUpdateInputs> {
    const accountData = await this.token.getAccount(account)

    const oldNonce = accountData.state.nonce

    const oldAmount = await Token.decryptAmount(
      cPrivateKey,
      oldNonce,
      accountData.state.eAmount,
    )

    const network = await this.token.runner?.provider?.getNetwork()
    if (!network) throw new Error("Network not found")

    return {
      chainId: BigInt(network.chainId),
      contractAddress: BigInt(await this.token.getAddress()),
      cPrivateKey,
      oldAmount,
      oldNonce,
      oldCommitment: BigInt(accountData.state.commitment),
      operation,
      amount,
    }
  }
}
