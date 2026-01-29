import { expect } from "chai"
import { conn, baseSetupBridgeable } from "../../BaseSetup.js"

describe("ConfidentialTransfersBridgeable", function () {
  describe("Cold:ConfidentialTransfersBridgeable", function () {
    let f: Awaited<ReturnType<typeof baseSetupBridgeable>>
    describe("", function () {
      beforeEach(async function () {
        f = await conn.networkHelpers.loadFixture(baseSetupBridgeable)
      })

      describe("Internal functions", function () {
        describe("_cReceive()", function () {
          it("Should update receiver's pending transfers", async function () {
            const pendingTransfer = {
              sender: f.user1.address,
              payload: {
                nonce: 0n,
                commitment: 0n,
                eAmount: 0n,
              },
              auditReports: [],
            }
            await f.token
              .connect(f.user1)
              .receiveBridge(f.user2.address, pendingTransfer)
            const accountAfter = await f.token.getAccount(f.user2.address)
            expect(accountAfter.pendingTransfers.length).to.equal(1)
            const lastPendingTransfer = accountAfter.pendingTransfers[0]
            expect(lastPendingTransfer.sender).to.equal(f.user1.address)
            expect(lastPendingTransfer.payload.nonce).to.equal(0n)
            expect(lastPendingTransfer.payload.commitment).to.equal(0n)
            expect(lastPendingTransfer.payload.eAmount).to.equal(0n)
            expect(lastPendingTransfer.auditReports.length).to.equal(0)
          })
        })

        describe("_cSend()", function () {
          it("Should update sender's state", async function () {
            await f.cDeposit("cold", f.user1, f.DEPOSIT_AMOUNT)
            const filename = f.getFilename(
              "transfer",
              f.user1.index,
              await f.getNonce(f.user1),
              f.TRANSFER_AMOUNT
            )
            const proof = f.getProofOutput(filename)
            const params = f.sdk.getTransferParams(f.user2.address, proof)
            const accountBefore = await f.token.getAccount(f.user1.address)
            await f.token.connect(f.user1).bridge(params)
            const accountAfter = await f.token.getAccount(f.user1.address)
            expect(accountAfter.state.nonce).to.not.equal(
              accountBefore.state.nonce
            )
            expect(accountAfter.state.commitment).to.not.equal(
              accountBefore.state.commitment
            )
            expect(accountAfter.state.eAmount).to.not.equal(
              accountBefore.state.eAmount
            )
          })
        })
      })
    })
  })
})
