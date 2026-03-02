import { expect } from "chai"
import { baseSetup, conn } from "../../BaseSetup.js"

describe("ConfidentialTransfers", function () {
  describe("Cold:ConfidentialTransfers", function () {
    describe("Cold:ConfidentialTransfers:addAllowedSender()", function () {
      let f: Awaited<ReturnType<typeof baseSetup>>

      beforeEach(async function () {
        f = await conn.networkHelpers.loadFixture(baseSetup)
      })

      describe("State Changes", function () {
        it("Should add allowed sender", async function () {
          const accountBefore = await f.token.getAccount(f.user1.address)
          expect(accountBefore.allowedSenders.length).to.equal(0)
          await f.token.connect(f.user1).addAllowedSender(f.user2.address)
          const accountAfter = await f.token.getAccount(f.user1.address)
          expect(accountAfter.allowedSenders.length).to.equal(1)
          expect(accountAfter.allowedSenders[0]).to.equal(f.user2.address)
        })

        it("Should emit event", async function () {
          await expect(
            f.token.connect(f.user1).addAllowedSender(f.user2.address),
          )
            .to.emit(f.token, "AllowedSenderAdded")
            .withArgs(f.user1.address, f.user2.address)
        })
      })

      describe("Reverts", function () {
        it("Should revert if the sender is already allowed to send transfers to the account", async function () {
          await f.token.connect(f.user1).addAllowedSender(f.user2.address)
          await expect(
            f.token.connect(f.user1).addAllowedSender(f.user2.address),
          ).to.be.revertedWithCustomError(f.token, "AllowedSenderAlreadyAdded")
        })
      })
    })
  })
})
