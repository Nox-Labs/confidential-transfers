import { Injectable, OnModuleInit } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { SDK } from "@noxlabs/confidential-transfers-sdk"

@Injectable()
export class ProofsService implements OnModuleInit {
  sdk: SDK

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const rpcUrl = this.configService.get<string>("rpcUrl")
    const contractAddress = this.configService.get<string>("contractAddress")

    const proofsHelpersPath =
      this.configService.get<string>("proofsHelpersPath")
    const proofsKeysPath = this.configService.get<string>("proofsKeysPath")

    this.sdk = new SDK(contractAddress, rpcUrl, {
      paths: {
        helpers: proofsHelpersPath,
        keys: proofsKeysPath,
      },
    })
  }

  async generateDepositProof(
    cPrivateKey: bigint,
    account: string,
    amount: bigint
  ) {
    const inputs = await this.sdk.getCircuitInputsForDeposit(
      account,
      cPrivateKey,
      amount
    )
    const proof = await this.sdk.generateUpdateProof(inputs)
    return this.sdk.getDepositParams(proof)
  }

  async generateTransferProof(
    cPrivateKey: bigint,
    account: string,
    to: string,
    amount: bigint
  ) {
    const inputs = await this.sdk.getCircuitInputsForTransfer(
      account,
      cPrivateKey,
      to,
      amount
    )
    const proof = await this.sdk.generateTransferProof(inputs)
    return this.sdk.getTransferParams(to, proof)
  }

  async generateWithdrawProof(
    cPrivateKey: bigint,
    account: string,
    amount: bigint
  ) {
    const inputs = await this.sdk.getCircuitInputsForWithdraw(
      account,
      cPrivateKey,
      amount
    )
    const proof = await this.sdk.generateUpdateProof(inputs)
    return this.sdk.getWithdrawParams(proof)
  }

  async generateInitProof(cPrivateKey: bigint) {
    const inputs = await this.sdk.getCircuitInputsForInit(cPrivateKey)
    const proof = await this.sdk.generateInitProof(inputs)
    return this.sdk.getInitParams(proof)
  }

  async generateApplyProof(
    cPrivateKey: bigint,
    account: string,
    pendingTransfersIndexes: number[]
  ) {
    const inputs = await this.sdk.getCircuitInputsForApply(
      account,
      cPrivateKey,
      pendingTransfersIndexes
    )
    const proof = await this.sdk.generateApplyProof(inputs)
    return this.sdk.getApplyParams(pendingTransfersIndexes, proof)
  }

  async generateApplyAndTransferProof(
    cPrivateKey: bigint,
    account: string,
    pendingTransfersIndexes: number[],
    to: string,
    amount: bigint
  ) {
    const inputs = await this.sdk.getCircuitInputsForApplyAndTransfer(
      account,
      cPrivateKey,
      pendingTransfersIndexes,
      to,
      amount
    )
    const proof = await this.sdk.generateApplyAndTransferProof(inputs)
    return this.sdk.getApplyAndTransferParams(
      to,
      pendingTransfersIndexes,
      proof
    )
  }
}
