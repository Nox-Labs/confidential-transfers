import { expect } from "chai"
import { baseSetup, conn } from "../../BaseSetup.js"

describe("ConfidentialTransfers", function () {
  describe("Cold:ConfidentialTransfers", function () {
    describe("Cold:ConfidentialTransfers:addRequiredAuditor()", function () {
      let f: Awaited<ReturnType<typeof baseSetup>>

      beforeEach(async function () {
        f = await conn.networkHelpers.loadFixture(baseSetup)
      })

      describe("State Changes", function () {
        it("Should add required auditor", async function () {
          const accountBefore = await f.token.getAccount(f.user1.address)
          expect(accountBefore.requiredAuditors.length).to.equal(0)
          await f.token.connect(f.user1).addRequiredAuditor(f.user2.address)
          const accountAfter = await f.token.getAccount(f.user1.address)
          expect(accountAfter.requiredAuditors.length).to.equal(1)
          expect(accountAfter.requiredAuditors[0]).to.equal(f.user2.address)
        })

        it("Should emit event", async function () {
          await expect(
            f.token.connect(f.user1).addRequiredAuditor(f.user2.address),
          )
            .to.emit(f.token, "RequiredAuditorAdded")
            .withArgs(f.user1.address, f.user2.address)
        })
      })

      describe("Reverts", function () {
        it("Should revert if the auditor account is not initialized", async function () {
          await expect(
            f.token
              .connect(f.user1)
              .addRequiredAuditor(f.userUninitialized.address),
          ).to.be.revertedWithCustomError(f.token, "AccountNotInitialized")
        })
      })
    })
  })
})
