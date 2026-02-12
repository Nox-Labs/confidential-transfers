import { AuditReportStruct } from "../artifacts/typechain/src/ConfidentialTransfers.js"
import { Payload } from "../index.js"
import { Inputs } from "./inputs.js"

export class Auditors extends Inputs {
  async createStateAuditReport(
    cPrivateKey: bigint,
    nonce: bigint,
    auditorAddresses: string[],
  ): Promise<AuditReportStruct[]> {
    const otk = await this.generateOTK(cPrivateKey, nonce)
    return await this.createAuditReport(
      cPrivateKey,
      otk,
      nonce,
      auditorAddresses,
    )
  }

  async createTransferAuditReport(
    cPrivateKey: bigint,
    nonce: bigint,
    recipientAddress: string,
    auditorAddresses: string[],
  ): Promise<AuditReportStruct[]> {
    const { pubKeyX, pubKeyY } = await this.token.getAccount(recipientAddress)

    const sharedKey = await Inputs.deriveSharedKey(
      cPrivateKey,
      pubKeyX,
      pubKeyY,
    )
    const otk = await this.generateOTK(sharedKey, nonce)
    return await this.createAuditReport(
      cPrivateKey,
      otk,
      nonce,
      auditorAddresses,
    )
  }

  private async createAuditReport(
    cPrivateKey: bigint,
    otk: bigint,
    nonce: bigint,
    auditorAddresses: string[],
  ): Promise<AuditReportStruct[]> {
    const { pubKeyXs, pubKeyYs } =
      await this.token.getCPublicKeys(auditorAddresses)
    const stateAuditReports: AuditReportStruct[] = []
    for (let i = 0; i < auditorAddresses.length; i++) {
      const auditorAddress = auditorAddresses[i]
      const sharedKey = await Inputs.deriveSharedKey(
        cPrivateKey,
        pubKeyXs[i],
        pubKeyYs[i],
      )
      const eOTK = await Inputs.cipher(sharedKey, nonce, otk)
      stateAuditReports.push({
        auditor: auditorAddress,
        eOTK: eOTK,
      })
    }
    return stateAuditReports
  }

  async decryptAuditReport(
    cPrivateKey: bigint,
    senderAddress: string,
    eOTK: bigint,
    payload: Payload,
  ): Promise<bigint> {
    const { pubKeyX, pubKeyY } = await this.token.getAccount(senderAddress)
    const sharedKey = await Inputs.deriveSharedKey(
      cPrivateKey,
      pubKeyX,
      pubKeyY,
    )
    const otk = await Inputs.decipher(
      sharedKey,
      BigInt(payload.nonce),
      BigInt(eOTK),
    )
    const amount = await Inputs.decipher(
      otk,
      BigInt(payload.nonce),
      BigInt(payload.eAmount),
    )

    const commitment = await Inputs.generateCommitment(amount, otk)

    if (commitment !== BigInt(payload.commitment))
      throw new Error("Commitment payload does not match")

    return amount
  }
}
