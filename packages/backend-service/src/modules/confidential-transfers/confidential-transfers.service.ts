import { ConfidentialTransfersSDK } from "@noxlabs/confidential-transfers-sdk"
import { Injectable, UnauthorizedException } from "@nestjs/common"
import { UsersService } from "../users/users.service"
import { ProofsService } from "../proofs/proofs.service"
import { ethers } from "ethers"
import { InitAccountDto } from "./dto/init-account.dto"
import { DepositDto } from "./dto/deposit.dto"
import { TransferDto } from "./dto/transfer.dto"
import { WithdrawDto } from "./dto/withdraw.dto"
import { ApplyDto } from "./dto/apply.dto"
import { ApplyAndTransferDto } from "./dto/applyAndTransfer.dto"

@Injectable()
export class ConfidentialTransfersService {
  constructor(
    private readonly usersService: UsersService,
    private readonly proofsService: ProofsService
  ) {}

  async registerUser(userId: string) {
    return {
      entropy: await this.usersService.generateEntropyForUser(userId),
    }
  }

  async getInitParams(dto: InitAccountDto) {
    await this.validateSignature(dto.userId, dto.signature)
    const keys = await ConfidentialTransfersSDK.deriveConfidentialKeys(
      BigInt(dto.signature)
    )

    return await this.proofsService.generateInitProof(keys.cPrivateKey)
  }

  async getDepositParams(dto: DepositDto) {
    await this.validateSignature(dto.userId, dto.signature)
    const keys = await ConfidentialTransfersSDK.deriveConfidentialKeys(
      BigInt(dto.signature)
    )

    return await this.proofsService.generateDepositProof(
      keys.cPrivateKey,
      dto.userId,
      BigInt(dto.amount)
    )
  }

  async getTransferParams(dto: TransferDto) {
    await this.validateSignature(dto.userId, dto.signature)
    const keys = await ConfidentialTransfersSDK.deriveConfidentialKeys(
      BigInt(dto.signature)
    )

    return await this.proofsService.generateTransferProof(
      keys.cPrivateKey,
      dto.userId,
      dto.to,
      BigInt(dto.amount)
    )
  }

  async getWithdrawParams(dto: WithdrawDto) {
    await this.validateSignature(dto.userId, dto.signature)
    const keys = await ConfidentialTransfersSDK.deriveConfidentialKeys(
      BigInt(dto.signature)
    )

    return await this.proofsService.generateWithdrawProof(
      keys.cPrivateKey,
      dto.userId,
      BigInt(dto.amount)
    )
  }

  async getApplyParams(dto: ApplyDto) {
    await this.validateSignature(dto.userId, dto.signature)
    const keys = await ConfidentialTransfersSDK.deriveConfidentialKeys(
      BigInt(dto.signature)
    )

    return await this.proofsService.generateApplyProof(
      keys.cPrivateKey,
      dto.userId,
      dto.pendingTransfersIndexes
    )
  }

  async getApplyAndTransferParams(dto: ApplyAndTransferDto) {
    await this.validateSignature(dto.userId, dto.signature)
    const keys = await ConfidentialTransfersSDK.deriveConfidentialKeys(
      BigInt(dto.signature)
    )

    return await this.proofsService.generateApplyAndTransferProof(
      keys.cPrivateKey,
      dto.userId,
      dto.pendingTransfersIndexes,
      dto.to,
      BigInt(dto.amount)
    )
  }

  private async validateSignature(
    userId: string,
    signature: string
  ): Promise<string> {
    const entropy = await this.usersService.getUserEntropy(userId)
    if (!entropy) throw new UnauthorizedException("User not registered")

    try {
      const recoveredAddr = ethers.verifyMessage(
        ethers.getBytes(entropy),
        signature
      )
      if (recoveredAddr.toLowerCase() !== userId.toLowerCase())
        throw new UnauthorizedException("Invalid signature")

      return entropy
    } catch (e) {
      throw new UnauthorizedException("Invalid signature format")
    }
  }
}
