import { expect } from "chai"

import { conn, baseSetupBridgeable } from "../../BaseSetup.js"

describe("ConfidentialTransfersBridgeable", function () {
  describe("Cold:ConfidentialTransfersBridgeable", function () {
    describe("Cold:ConfidentialTransfersBridgeable:cWithdraw()", function () {
      let f: Awaited<ReturnType<typeof baseSetupBridgeable>>
      beforeEach(async function () {
        f = await conn.networkHelpers.loadFixture(baseSetupBridgeable)
        await f.cDeposit("cold", f.user1, f.DEPOSIT_AMOUNT)
      })

      describe("State Changes", function () {
        it("Should mint tokens", async function () {
          expect(await f.token.balanceOf(await f.token.getAddress())).to.equal(
            0n,
          )
          const totalSupplyBefore = await f.token.totalSupply()
          await f.cWithdraw("cold", f.user1, f.WITHDRAW_AMOUNT)
          const totalSupplyAfter = await f.token.totalSupply()
          expect(totalSupplyAfter).to.equal(
            totalSupplyBefore + f.WITHDRAW_AMOUNT,
          )
          expect(await f.token.balanceOf(await f.token.getAddress())).to.equal(
            0n,
          )
        })

        it("Should update state of the sender", async function () {
          const accountBefore = await f.token.getAccount(f.user1.address)
          await f.cWithdraw("cold", f.user1, f.WITHDRAW_AMOUNT)
          const accountAfter = await f.token.getAccount(f.user1.address)
          expect(accountAfter.state.nonce).to.not.equal(
            accountBefore.state.nonce,
          )
          expect(accountAfter.state.commitment).to.not.equal(
            accountBefore.state.commitment,
          )
          expect(accountAfter.state.eAmount).to.not.equal(
            accountBefore.state.eAmount,
          )
        })
      })
    })
  })
})
