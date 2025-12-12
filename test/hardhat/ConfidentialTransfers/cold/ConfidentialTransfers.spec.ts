import { expect } from "chai"
import {
  conn,
  baseSetup,
  baseSetupUninitializedUsers,
} from "../../BaseSetup.js"

describe("ConfidentialTransfers:cold", function () {
  let f: Awaited<ReturnType<typeof baseSetup>>
  describe("", function () {
    beforeEach(async function () {
      f = await conn.networkHelpers.loadFixture(baseSetupUninitializedUsers)
    })

    it("Should able to audit state", async function () {
      await f.cInit("cold", f.user2)

      // user activity
      const otk = await f.SDK.generateOTK(f.user1CPrivateKey, 0n)
      const auditorReports = await f.sdk.createAuditReport(
        f.user1CPrivateKey,
        otk,
        0n,
        [f.user2.address]
      )
      const filename = f.getFilename("init", f.user1.index, 0n)
      const proof = f.getProofOutput(filename)
      const params = f.sdk.getInitParams(proof, auditorReports)
      await f.token.connect(f.user1).cInit(params)

      // auditor activity
      const accountAfter = await f.token.getAccount(f.user1.address)
      expect(accountAfter.auditReports.length).to.equal(1)
      expect(accountAfter.auditReports[0].auditor).to.equal(f.user2.address)
      const amount = await f.sdk.decryptAuditReport(
        f.user2CPrivateKey,
        f.user1.address,
        accountAfter.state.nonce,
        accountAfter.auditReports[0],
        accountAfter.state
      )
      expect(amount).to.equal(0n)
    })
  })
  describe("", function () {
    beforeEach(async function () {
      f = await conn.networkHelpers.loadFixture(baseSetup)
    })

    it("Should able to recover state from on-chain data", async function () {
      const { cPrivateKey } = await f.SDK.deriveConfidentialKeys(
        BigInt(f.user1.privateKey)
      )

      const account = await f.token.getAccount(f.user1.address)

      const amount = await f.SDK.decryptAmount(
        cPrivateKey,
        account.state.nonce,
        account.state.eAmount
      )
      const otk = await f.SDK.generateOTK(cPrivateKey, account.state.nonce)
      const commitment = await f.SDK.generateCommitment(amount, otk)

      expect(amount).to.equal(0n)
      expect(commitment).to.equal(BigInt(account.state.commitment))
    })
  })
})
