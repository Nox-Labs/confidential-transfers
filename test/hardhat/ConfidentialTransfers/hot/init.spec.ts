import { expect } from "chai"
import { baseSetup, conn } from "../../BaseSetup.js"

describe("ConfidentialTransfers", function () {
  describe("Hot:ConfidentialTransfers", function () {
    describe("Hot:ConfidentialTransfers:cInit()", function () {
      it("Should initialize the user account", async function () {
        const { token, userUninitialized, sdk, cInit, SDK } =
          await conn.networkHelpers.loadFixture(baseSetup)

        const { cPrivateKey, cPublicKeyX, cPublicKeyY } =
          await SDK.deriveConfidentialKeys(BigInt(userUninitialized.privateKey))

        const accountBefore = await token.getAccount(userUninitialized.address)

        expect(accountBefore.state.nonce).to.equal(0n)
        expect(accountBefore.state.commitment).to.equal(0n)
        expect(accountBefore.state.eAmount).to.equal(0n)
        expect(accountBefore.pubKeyX).to.equal(0n)
        expect(accountBefore.pubKeyY).to.equal(0n)

        await cInit("hot", userUninitialized)

        const balance = await sdk.сBalanceOf(
          userUninitialized.address,
          cPrivateKey,
        )
        expect(balance).to.equal(0n)

        const accountAfter = await token.getAccount(userUninitialized.address)

        expect(accountAfter.state.nonce).to.equal(0n)
        expect(accountAfter.state.commitment).to.not.equal(0n)
        expect(accountAfter.state.eAmount).to.not.equal(0n)
        expect(accountAfter.pubKeyX).to.equal(cPublicKeyX)
        expect(accountAfter.pubKeyY).to.equal(cPublicKeyY)
      })
    })
  })
})
