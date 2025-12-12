import { AuditReportStruct } from "../../artifacts/typechain/src/ConfidentialTransfers.js"
import { Payload } from "../index.js"
import { Inputs } from "./inputs.js"

export class Auditors extends Inputs {
  async createAuditReport(
    cPrivateKey: bigint,
    otk: bigint,
    nonce: bigint,
    auditorAddresses: string[]
  ): Promise<AuditReportStruct[]> {
    const { pubKey_Xs, pubKey_Ys } = await this.token.getCPublicKeys(
      auditorAddresses
    )
    const stateAuditReports: AuditReportStruct[] = []
    for (let i = 0; i < auditorAddresses.length; i++) {
      const auditorAddress = auditorAddresses[i]
      const sharedKey = await Inputs.deriveSharedKey(
        cPrivateKey,
        pubKey_Xs[i],
        pubKey_Ys[i]
      )
      const encryptedOTK = await Inputs.cipher(sharedKey, nonce, otk)
      stateAuditReports.push({
        auditor: auditorAddress,
        encryptedOTK: encryptedOTK,
      })
    }
    return stateAuditReports
  }

  async decryptAuditReport(
    cPrivateKey: bigint,
    reportCreatorAddress: string,
    nonce: bigint,
    auditReport: AuditReportStruct,
    payload: Payload
  ): Promise<bigint> {
    const { pubKey_X, pubKey_Y } = await this.token.getAccount(
      reportCreatorAddress
    )
    const sharedKey = await Inputs.deriveSharedKey(
      cPrivateKey,
      pubKey_X,
      pubKey_Y
    )
    const otk = await Inputs.decipher(
      sharedKey,
      nonce,
      BigInt(auditReport.encryptedOTK)
    )

    const amount = await Inputs.decipher(otk, nonce, BigInt(payload.eAmount))

    const commitment = await Inputs.generateCommitment(amount, otk)

    if (commitment !== BigInt(payload.commitment))
      throw new Error("Commitment payload does not match")

    return amount
  }
}
