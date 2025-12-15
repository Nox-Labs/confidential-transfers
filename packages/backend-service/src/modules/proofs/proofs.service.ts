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
    amount: bigint,
    auditors?: string[]
  ) {
    const inputs = await this.sdk.getCircuitInputsForDeposit(
      account,
      cPrivateKey,
      amount
    )
    const proof = await this.sdk.generateUpdateProof(inputs)

    let reports
    if (auditors && auditors.length > 0) {
      const nonce = (await this.sdk.token.getAccount(account)).state.nonce
      reports = await this.sdk.createStateAuditReport(
        cPrivateKey,
        nonce + 1n,
        auditors
      )
    }

    return this.sdk.getDepositParams(proof, reports)
  }

  async generateTransferProof(
    cPrivateKey: bigint,
    account: string,
    to: string,
    amount: bigint,
    auditors?: string[]
  ) {
    const inputs = await this.sdk.getCircuitInputsForTransfer(
      account,
      cPrivateKey,
      to,
      amount
    )
    const proof = await this.sdk.generateTransferProof(inputs)

    let stateAuditReports
    let transferAuditReports
    if (auditors && auditors.length > 0) {
      const nonce = (await this.sdk.token.getAccount(account)).state.nonce
      stateAuditReports = await this.sdk.createStateAuditReport(
        cPrivateKey,
        nonce + 1n,
        auditors
      )
      transferAuditReports = await this.sdk.createTransferAuditReport(
        cPrivateKey,
        nonce + 1n,
        to,
        auditors
      )
    }

    return this.sdk.getTransferParams(to, proof, stateAuditReports)
  }

  async generateWithdrawProof(
    cPrivateKey: bigint,
    account: string,
    amount: bigint,
    auditors?: string[]
  ) {
    const inputs = await this.sdk.getCircuitInputsForWithdraw(
      account,
      cPrivateKey,
      amount
    )
    const proof = await this.sdk.generateUpdateProof(inputs)

    let reports
    if (auditors && auditors.length > 0) {
      const nonce = (await this.sdk.token.getAccount(account)).state.nonce
      reports = await this.sdk.createStateAuditReport(
        cPrivateKey,
        nonce + 1n,
        auditors
      )
    }

    return this.sdk.getWithdrawParams(proof, reports)
  }

  async generateInitProof(cPrivateKey: bigint, auditors?: string[]) {
    const inputs = await this.sdk.getCircuitInputsForInit(cPrivateKey)
    const proof = await this.sdk.generateInitProof(inputs)

    let reports
    if (auditors && auditors.length > 0) {
      // Nonce is 0 for Init
      reports = await this.sdk.createStateAuditReport(cPrivateKey, 0n, auditors)
    }

    return this.sdk.getInitParams(proof, reports)
  }

  async generateApplyProof(
    cPrivateKey: bigint,
    account: string,
    pendingTransfersIndexes: number[],
    auditors?: string[]
  ) {
    const inputs = await this.sdk.getCircuitInputsForApply(
      account,
      cPrivateKey,
      pendingTransfersIndexes
    )
    const proof = await this.sdk.generateApplyProof(inputs)

    let reports
    if (auditors && auditors.length > 0) {
      const nonce = (await this.sdk.token.getAccount(account)).state.nonce
      reports = await this.sdk.createStateAuditReport(
        cPrivateKey,
        nonce + 1n,
        auditors
      )
    }

    return this.sdk.getApplyParams(pendingTransfersIndexes, proof, reports)
  }

  async generateApplyAndTransferProof(
    cPrivateKey: bigint,
    account: string,
    pendingTransfersIndexes: number[],
    to: string,
    amount: bigint,
    auditors?: string[]
  ) {
    const inputs = await this.sdk.getCircuitInputsForApplyAndTransfer(
      account,
      cPrivateKey,
      pendingTransfersIndexes,
      to,
      amount
    )
    const proof = await this.sdk.generateApplyAndTransferProof(inputs)

    let stateAuditReports
    if (auditors && auditors.length > 0) {
      const nonce = (await this.sdk.token.getAccount(account)).state.nonce
      stateAuditReports = await this.sdk.createStateAuditReport(
        cPrivateKey,
        nonce + 1n,
        auditors
      )
    }

    return this.sdk.getApplyAndTransferParams(
      to,
      pendingTransfersIndexes,
      proof,
      stateAuditReports
    )
  }
}
