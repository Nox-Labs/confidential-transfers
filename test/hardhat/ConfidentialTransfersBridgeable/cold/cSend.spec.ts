import { expect } from "chai"
import { conn, baseSetupBridgeable } from "../../BaseSetup.js"
import { type MockConfidentialTransfersBridgeable } from "../../../../out/hardhat/typechain/test/utils/mock/MockConfidentialTransfersBridgeable.js"

describe("ConfidentialTransfersBridgeable", function () {
  describe("Cold:ConfidentialTransfersBridgeable", function () {
    describe("Cold:ConfidentialTransfersBridgeable:cSend()", function () {
      let f: Awaited<ReturnType<typeof baseSetupBridgeable>>
      beforeEach(async function () {
        f = await conn.networkHelpers.loadFixture(baseSetupBridgeable)
      })

      it("Should update sender's state", async function () {
        await f.cDeposit("cold", f.user1, f.DEPOSIT_AMOUNT)
        const filename = f.getFilename(
          "transfer",
          f.user1.index,
          await f.getNonce(f.user1),
          f.TRANSFER_AMOUNT,
        )
        const proof = f.getProofOutput(filename)
        const params = f.sdk.getTransferParams(f.user2.address, proof)
        const accountBefore = await f.token.getAccount(f.user1.address)
        await (f.token as unknown as MockConfidentialTransfersBridgeable)
          .connect(f.user1)
          .bridge(params)
        const accountAfter = await f.token.getAccount(f.user1.address)
        expect(accountAfter.state.nonce).to.not.equal(accountBefore.state.nonce)
        expect(accountAfter.state.commitment).to.not.equal(
          accountBefore.state.commitment,
        )
        expect(accountAfter.state.eAmount).to.not.equal(
          accountBefore.state.eAmount,
        )
      })

      // it("Should emit event", async function () {
      //   await expect(
      //     (f.token as unknown as MockConfidentialTransfersBridgeable)
      //       .connect(f.user1)
      //       .bridge(params),
      //   ).to.emit(f.token, "CSent")
      // })
    })
  })
})
