import { expect } from "chai"
import { conn, baseSetupBridgeable } from "../../BaseSetup.js"
import { type MockConfidentialTransfersBridgeable } from "../../../../out/hardhat/typechain/test/utils/mock/MockConfidentialTransfersBridgeable.js"
import { type PendingTransfer } from "@noxlabs/confidential-transfers-sdk"

describe("ConfidentialTransfersBridgeable", function () {
  describe("Cold:ConfidentialTransfersBridgeable", function () {
    describe("Cold:ConfidentialTransfersBridgeable:cReceive()", function () {
      let f: Awaited<ReturnType<typeof baseSetupBridgeable>>

      let pt: PendingTransfer

      beforeEach(async function () {
        f = await conn.networkHelpers.loadFixture(baseSetupBridgeable)

        pt = {
          sender: f.user1.address,
          payload: {
            nonce: 0n,
            commitment: 0n,
            eAmount: 0n,
          },
          auditReports: [],
        }
      })

      it("Should update receiver's pending transfers when sender's public keys match", async function () {
        const accountBefore = await f.token.getAccount(f.user2.address)

        await (f.token as unknown as MockConfidentialTransfersBridgeable)
          .connect(f.user1)
          .receiveBridge(
            f.user2.address,
            accountBefore.pubKeyX,
            accountBefore.pubKeyY,
            pt,
            "0x",
          )
        const accountAfter = await f.token.getAccount(f.user2.address)
        expect(accountAfter.pendingTransfers.length).to.equal(1)

        const newPt = accountAfter.pendingTransfers[0]
        expect(newPt.sender).to.equal(f.user1.address)
        expect(newPt.payload.nonce).to.equal(pt.payload.nonce)
        expect(newPt.payload.commitment).to.equal(pt.payload.commitment)
        expect(newPt.payload.eAmount).to.equal(pt.payload.eAmount)
        expect(newPt.auditReports.length).to.equal(pt.auditReports.length)
      })

      it("Should add failed cross-chain transfer when sender's public keys don't match", async function () {
        await (f.token as unknown as MockConfidentialTransfersBridgeable)
          .connect(f.user1)
          .receiveBridge(f.user2.address, 52n, 52n, pt, "0x")
        const accountAfter = await f.token.getAccount(f.user2.address)
        expect(accountAfter.pendingTransfers.length).to.equal(0)

        const failed = await f.token.getFailedCrossChainTransfers(
          f.user1.address,
        )
        expect(failed.length).to.equal(1)
        expect(failed[0].pendingTransfer.sender).to.equal(f.user1.address)
        expect(failed[0].pendingTransfer.payload.nonce).to.equal(
          pt.payload.nonce,
        )
        expect(failed[0].pendingTransfer.payload.commitment).to.equal(
          pt.payload.commitment,
        )
        expect(failed[0].pendingTransfer.payload.eAmount).to.equal(
          pt.payload.eAmount,
        )
        expect(failed[0].pendingTransfer.auditReports.length).to.equal(
          pt.auditReports.length,
        )
      })

      it("Should emit event", async function () {
        const accountBefore = await f.token.getAccount(f.user2.address)

        await expect(
          (f.token as unknown as MockConfidentialTransfersBridgeable)
            .connect(f.user1)
            .receiveBridge(
              f.user2.address,
              accountBefore.pubKeyX,
              accountBefore.pubKeyY,
              pt,
              "0x",
            ),
        ).to.emit(f.token, "CReceived")
      })
    })
  })
})
