import { expect } from "chai"
import {
  conn,
  baseSetup,
  baseSetupUninitializedUsers,
} from "../../BaseSetup.js"

describe("ConfidentialTransfers", function () {
  describe("Cold:ConfidentialTransfers", function () {
    let f: Awaited<ReturnType<typeof baseSetupUninitializedUsers>>
    describe("", function () {
      beforeEach(async function () {
        f = await conn.networkHelpers.loadFixture(baseSetupUninitializedUsers)
      })

      it("Should able to audit state", async function () {
        await f.cInit("cold", f.user2)

        {
          // user activity
          const stateAuditorReports = await f.sdk.createStateAuditReport(
            f.user1CPrivateKey,
            0n,
            [f.user2.address],
          )
          const filename = f.getFilename("init", f.user1.index, 0n)
          const proof = f.getProofOutput(filename)
          const params = f.sdk.getInitParams(proof, stateAuditorReports)
          await f.token.connect(f.user1).cInit(params)
        }

        // auditor activity
        const accountAfter = await f.token.getAccount(f.user1.address)
        expect(accountAfter.auditReports.length).to.equal(1)
        expect(accountAfter.auditReports[0].auditor).to.equal(f.user2.address)
        const amount = await f.sdk.decryptAuditReport(
          f.user2CPrivateKey,
          f.user1.address,
          accountAfter.auditReports[0].eOTK,
          accountAfter.state,
        )
        expect(amount).to.equal(0n)
      })

      it("Should able to audit pending transfer", async function () {
        await f.cInit("cold", f.user1)
        await f.cInit("cold", f.user2)
        await f.cDeposit("cold", f.user1, f.DEPOSIT_AMOUNT)

        // user activity
        const nonce = await f.getNonce(f.user1)
        const stateAuditorReports = await f.sdk.createStateAuditReport(
          f.user1CPrivateKey,
          nonce + 1n,
          [f.user2.address],
        )
        const transferAuditorReports = await f.sdk.createTransferAuditReport(
          f.user1CPrivateKey,
          nonce + 1n,
          f.user2.address,
          [f.user2.address],
        )
        const filename = f.getFilename(
          "transfer",
          f.user1.index,
          nonce,
          f.TRANSFER_AMOUNT,
        )
        const params = f.sdk.getTransferParams(
          f.user2.address,
          f.getProofOutput(filename),
          stateAuditorReports,
          transferAuditorReports,
        )
        await f.token.connect(f.user1).cTransfer(params)

        // auditor activity
        const accountAfter = await f.token.getAccount(f.user2.address)
        expect(accountAfter.pendingTransfers.length).to.equal(1)
        expect(accountAfter.pendingTransfers[0].auditReports.length).to.equal(1)
        expect(
          accountAfter.pendingTransfers[0].auditReports[0].auditor,
        ).to.equal(f.user2.address)
        const amount = await f.sdk.decryptAuditReport(
          f.user2CPrivateKey,
          accountAfter.pendingTransfers[0].sender,
          accountAfter.pendingTransfers[0].auditReports[0].eOTK,
          accountAfter.pendingTransfers[0].payload,
        )
        expect(amount).to.equal(f.TRANSFER_AMOUNT)
      })

      it("Should pass if all required auditors are found", async function () {
        await f.cInit("cold", f.user2)
        await f.token.connect(f.user1).addRequiredAuditor(f.user2.address)
        const stateAuditorReports = await f.sdk.createStateAuditReport(
          f.user1CPrivateKey,
          0n,
          [f.user2.address],
        )
        const filename = f.getFilename("init", f.user1.index, 0n)
        const proof = f.getProofOutput(filename)
        const params = f.sdk.getInitParams(proof, stateAuditorReports)
        await f.token.connect(f.user1).cInit(params)
      })
    })
    describe("", function () {
      beforeEach(async function () {
        f = await conn.networkHelpers.loadFixture(baseSetup)
      })

      it("Should able to recover state from on-chain data", async function () {
        const { cPrivateKey } = await f.SDK.deriveConfidentialKeys(
          BigInt(f.user1.privateKey),
        )

        const account = await f.token.getAccount(f.user1.address)

        const amount = await f.sdk.decryptAmount(
          cPrivateKey,
          account.state.nonce,
          account.state.eAmount,
        )
        const otk = await f.sdk.generateOTK(cPrivateKey, account.state.nonce)
        const commitment = await f.SDK.generateCommitment(amount, otk)

        expect(amount).to.equal(0n)
        expect(commitment).to.equal(BigInt(account.state.commitment))
      })
    })
  })
})
