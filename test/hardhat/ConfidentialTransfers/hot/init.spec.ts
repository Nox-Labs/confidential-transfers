import { expect } from "chai"
import { baseSetup, conn } from "../../BaseSetup.js"

describe("ConfidentialTransfers", function () {
  describe("ConfidentialTransfers:hot", function () {
    describe("ConfidentialTransfers:hot:cInit()", function () {
      it("Should initialize the user account", async function () {
        const { token, userUninitialized, sdk, cInit, SDK } =
          await conn.networkHelpers.loadFixture(baseSetup)

        const { cPrivateKey, cPublicKey_X, cPublicKey_Y } =
          await SDK.deriveConfidentialKeys(BigInt(userUninitialized.privateKey))

        const accountBefore = await token.getAccount(userUninitialized.address)

        expect(accountBefore.state.nonce).to.equal(0n)
        expect(accountBefore.state.commitment).to.equal(0n)
        expect(accountBefore.state.eAmount).to.equal(0n)
        expect(accountBefore.pubKey_X).to.equal(0n)
        expect(accountBefore.pubKey_Y).to.equal(0n)

        await cInit("hot", userUninitialized)

        const balance = await sdk.сBalanceOf(
          userUninitialized.address,
          cPrivateKey
        )
        expect(balance).to.equal(0n)

        const accountAfter = await token.getAccount(userUninitialized.address)

        expect(accountAfter.state.nonce).to.equal(0n)
        expect(accountAfter.state.commitment).to.not.equal(0n)
        expect(accountAfter.state.eAmount).to.not.equal(0n)
        expect(accountAfter.pubKey_X).to.equal(cPublicKey_X)
        expect(accountAfter.pubKey_Y).to.equal(cPublicKey_Y)
      })
    })
  })
})
