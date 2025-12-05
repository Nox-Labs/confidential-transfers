import {
  ApplyAndTransferParamsStruct,
  ApplyParamsStruct,
  InitParamsStruct,
  TransferParamsStruct,
  UpdateParamsStruct,
} from "../../artifacts/typechain/src/ConfidentialTransfers.js"
import {
  CircuitInitInputs,
  CircuitUpdateInputs,
  CircuitTransferInputs,
  CircuitApplyInputs,
  ProofOutput,
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
    cPrivateKey: bigint
  ): Promise<CircuitInitInputs> {
    return {
      cPrivateKey,
      ...(await this.getAuditorPublicKey()),
    }
  }

  async getCircuitInputsForDeposit(
    account: string,
    cPrivateKey: bigint,
    amount: bigint
  ): Promise<CircuitUpdateInputs> {
    return await this.getCircuitInputsForUpdate(
      account,
      cPrivateKey,
      0n,
      amount
    )
  }

  async getCircuitInputsForWithdraw(
    account: string,
    cPrivateKey: bigint,
    amount: bigint
  ): Promise<CircuitUpdateInputs> {
    return await this.getCircuitInputsForUpdate(
      account,
      cPrivateKey,
      1n,
      amount
    )
  }

  async getCircuitInputsForTransfer(
    account: string,
    cPrivateKey: bigint,
    to: string,
    transferAmount: bigint
  ): Promise<CircuitTransferInputs> {
    const senderAccountData = await this.token.getAccount(account)

    const oldNonce = senderAccountData.state.nonce

    const oldAmount = await Token.decryptAmount(
      cPrivateKey,
      oldNonce,
      senderAccountData.state.eAmount
    )

    const {
      state: { pubKey_X, pubKey_Y },
    } = await this.token.getAccount(to)

    return {
      cPrivateKey,
      oldAmount,
      oldNonce,
      oldCommitment: BigInt(senderAccountData.state.commitment),
      transferAmount,
      recipientPublicKey_X: pubKey_X,
      recipientPublicKey_Y: pubKey_Y,
      ...(await this.getAuditorPublicKey()),
    }
  }

  async getCircuitInputsForApply(
    account: string,
    cPrivateKey: bigint,
    pendingTransfersIndexes: number[]
  ): Promise<CircuitApplyInputs> {
    if (pendingTransfersIndexes.length > this.MAX_PENDING_TRANSFERS_APPLY)
      throw new Error(
        `Max pending transfers apply is ${this.MAX_PENDING_TRANSFERS_APPLY}`
      )

    const senderAccountData = await this.token.getAccount(account)

    const oldNonce = senderAccountData.state.nonce

    const oldAmount = await Token.decryptAmount(
      cPrivateKey,
      oldNonce,
      senderAccountData.state.eAmount
    )

    const filteredPendingTransfers = senderAccountData.pendingTransfers.filter(
      (_, index) => pendingTransfersIndexes.includes(index)
    )

    const decryptedAmountsAndBf = await Promise.all(
      filteredPendingTransfers.map(async (transfer) => {
        const sharedKey = await Token.deriveSharedKey(
          cPrivateKey,
          transfer.pubKey_X,
          transfer.pubKey_Y
        )

        const amount = await Token.decryptAmount(
          sharedKey,
          transfer.nonce,
          transfer.eAmount
        )

        const bf = await Token.generateBlindingFactor(sharedKey, transfer.nonce)

        return { amount, bf }
      })
    )

    const MAX = this.MAX_PENDING_TRANSFERS_APPLY

    const pendingTransfersCommitments = Array(MAX).fill(0n)
    for (let i = 0; i < filteredPendingTransfers.length; i++)
      pendingTransfersCommitments[i] = BigInt(
        filteredPendingTransfers[i].commitment
      )

    const pendingTransfersAmounts = Array(MAX).fill(0n)
    for (let i = 0; i < decryptedAmountsAndBf.length; i++)
      pendingTransfersAmounts[i] = decryptedAmountsAndBf[i].amount

    const pendingTransfersBF = Array(MAX).fill(0n)
    for (let i = 0; i < decryptedAmountsAndBf.length; i++)
      pendingTransfersBF[i] = decryptedAmountsAndBf[i].bf

    return {
      cPrivateKey,
      oldAmount,
      oldNonce,
      oldCommitment: senderAccountData.state.commitment,
      n: BigInt(pendingTransfersIndexes.length),
      pendingTransfersCommitments,
      pendingTransfersAmounts,
      pendingTransfersBF,
      ...(await this.getAuditorPublicKey()),
    }
  }

  async getCircuitInputsForApplyAndTransfer(
    account: string,
    cPrivateKey: bigint,
    pendingTransfersIndexes: number[],
    to: string,
    transferAmount: bigint
  ): Promise<CircuitApplyAndTransferInputs> {
    return {
      ...(await this.getCircuitInputsForApply(
        account,
        cPrivateKey,
        pendingTransfersIndexes
      )),
      ...(await this.getCircuitInputsForTransfer(
        account,
        cPrivateKey,
        to,
        transferAmount
      )),
    }
  }

  /* PARAMS */

  getInitParams(output: ProofOutput): InitParamsStruct {
    return {
      artifacts: {
        proof: output.proof,
        outputs: output.pubSignals.slice(0, 5),
      },
    }
  }

  getWithdrawParams(proofOutput: ProofOutput): UpdateParamsStruct {
    return this.getUpdateParams(proofOutput)
  }

  getDepositParams(proofOutput: ProofOutput): UpdateParamsStruct {
    return this.getUpdateParams(proofOutput)
  }

  getApplyParams(
    pendingTransfersIndexes: number[],
    proofOutput: ProofOutput
  ): ApplyParamsStruct {
    return {
      pendingTransfersIndexes,
      artifacts: {
        proof: proofOutput.proof,
        outputs: proofOutput.pubSignals.slice(0, 3),
      },
    }
  }

  getTransferParams(
    recipientAddress: string,
    proofOutput: ProofOutput
  ): TransferParamsStruct {
    return {
      recipient: recipientAddress,
      artifacts: {
        proof: proofOutput.proof,
        outputs: proofOutput.pubSignals.slice(0, 6),
      },
    }
  }

  getApplyAndTransferParams(
    recipientAddress: string,
    pendingTransfersIndexes: number[],
    proofOutput: ProofOutput
  ): ApplyAndTransferParamsStruct {
    return {
      recipient: recipientAddress,
      pendingTransfersIndexes,
      artifacts: {
        proof: proofOutput.proof,
        outputs: proofOutput.pubSignals.slice(0, 6),
      },
    }
  }

  /* PRIVATE */

  private async getCircuitInputsForUpdate(
    account: string,
    cPrivateKey: bigint,
    operation: bigint,
    amount: bigint
  ): Promise<CircuitUpdateInputs> {
    const accountData = await this.token.getAccount(account)

    const oldNonce = accountData.state.nonce

    const oldAmount = await Token.decryptAmount(
      cPrivateKey,
      oldNonce,
      accountData.state.eAmount
    )

    return {
      cPrivateKey,
      oldAmount,
      oldNonce,
      oldCommitment: BigInt(accountData.state.commitment),
      operation,
      amount,
      ...(await this.getAuditorPublicKey()),
    }
  }

  private getUpdateParams(output: ProofOutput): UpdateParamsStruct {
    return {
      amount: output.pubSignals[6],
      artifacts: {
        proof: output.proof,
        outputs: output.pubSignals.slice(0, 3),
      },
    }
  }
}
