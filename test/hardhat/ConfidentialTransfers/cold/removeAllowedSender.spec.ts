import { expect } from "chai"
import { baseSetup, conn } from "../../BaseSetup.js"

describe("ConfidentialTransfers", function () {
  describe("Cold:ConfidentialTransfers", function () {
    describe("Cold:ConfidentialTransfers:removeAllowedSender()", function () {
      let f: Awaited<ReturnType<typeof baseSetup>>
      beforeEach(async function () {
        f = await conn.networkHelpers.loadFixture(baseSetup)
      })

      describe("State Changes", function () {
        it("Should remove allowed sender", async function () {
          await f.token.connect(f.user1).addAllowedSender(f.user2.address)
          await f.token.connect(f.user1).removeAllowedSender(f.user2.address)
          const accountAfter = await f.token.getAccount(f.user1.address)
          expect(accountAfter.allowedSenders.length).to.equal(0)
        })

        it("Should emit event", async function () {
          await f.token.connect(f.user1).addAllowedSender(f.user2.address)
          await expect(
            f.token.connect(f.user1).removeAllowedSender(f.user2.address),
          )
            .to.emit(f.token, "AllowedSenderRemoved")
            .withArgs(f.user1.address, f.user2.address)
        })
      })

      describe("Reverts", function () {
        it("Should revert if the sender is not found", async function () {
          await f.token.connect(f.user1).addAllowedSender(f.user1.address)
          await expect(
            f.token.connect(f.user1).removeAllowedSender(f.user2.address),
          ).to.be.revertedWithCustomError(f.token, "NotFound")
        })
      })
    })
  })
})
