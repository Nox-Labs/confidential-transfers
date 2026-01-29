import { expect } from "chai"
import { baseSetup, conn } from "../../BaseSetup.js"

describe("ConfidentialTransfers", function () {
  describe("Cold:ConfidentialTransfers", function () {
    describe("Cold:ConfidentialTransfers:removeRequiredAuditor()", function () {
      let f: Awaited<ReturnType<typeof baseSetup>>
      beforeEach(async function () {
        f = await conn.networkHelpers.loadFixture(baseSetup)
      })

      describe("State Changes", function () {
        it("Should remove required auditor", async function () {
          await f.token.connect(f.user1).addRequiredAuditor(f.user2.address)
          await f.token.connect(f.user1).removeRequiredAuditor(f.user2.address)
          const accountAfter = await f.token.getAccount(f.user1.address)
          expect(accountAfter.requiredAuditors.length).to.equal(0)
        })

        it("Should emit event", async function () {
          await f.token.connect(f.user1).addRequiredAuditor(f.user2.address)
          await expect(
            f.token.connect(f.user1).removeRequiredAuditor(f.user2.address),
          )
            .to.emit(f.token, "RequiredAuditorRemoved")
            .withArgs(f.user1.address, f.user2.address)
        })
      })

      describe("Reverts", function () {
        it("Should revert if the auditor is not found", async function () {
          await expect(
            f.token.connect(f.user1).removeRequiredAuditor(f.user2.address),
          ).to.be.revertedWithCustomError(f.token, "NotFound")
        })
      })
    })
  })
})
