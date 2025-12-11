import { expect } from "chai"
import { baseSetup, conn } from "../../BaseSetup.js"

describe("ConfidentialTransfers/cold", function () {
  describe("cInit()", function () {
    let f: Awaited<ReturnType<typeof baseSetup>>

    before(async function () {
      f = await conn.networkHelpers.loadFixture(baseSetup)
    })

    it("Should update public key", async function () {
      const keys = await f.ConfidentialTransfersSDK.deriveConfidentialKeys(
        BigInt(f.user1.privateKey)
      )

      const accountAfter = await f.token.getAccount(f.user1.address)

      expect(accountAfter.pubKey_X).to.equal(keys.cPublicKey_X)
      expect(accountAfter.pubKey_Y).to.equal(keys.cPublicKey_Y)
    })

    it("Should update nonce", async function () {
      const accountAfter = await f.token.getAccount(f.user1.address)
      expect(accountAfter.state.nonce).to.equal(0n)
    })

    it("Should update encrypted amount", async function () {
      const accountAfter = await f.token.getAccount(f.user1.address)
      expect(accountAfter.state.eAmount).to.not.equal(0n)
    })

    it("Should update commitment", async function () {
      const accountAfter = await f.token.getAccount(f.user1.address)
      expect(accountAfter.state.commitment).to.not.equal(0n)
    })

    it("Should revert if the proof verification fails", async function () {
      const proof = f.MOCK_PROOF_OUTPUT
      const params = f.sdk.getInitParams(proof)
      await expect(
        f.token.connect(f.userUninitialized).cInit(params)
      ).to.be.revertedWithCustomError(f.token, "ProofVerificationFailed")
    })

    it("Should revert if the account is already initialized", async function () {
      await expect(
        f.token.connect(f.user1).cInit(f.sdk.getInitParams(f.MOCK_PROOF_OUTPUT))
      ).to.be.revertedWithCustomError(f.token, "AccountAlreadyInitialized")
    })

    it("Should revert if length in params.output mismatch", async function () {
      const proof = f.MOCK_PROOF_OUTPUT
      const params = f.sdk.getInitParams(proof)
      params.artifacts.outputs.pop()
      await expect(
        f.token.connect(f.userUninitialized).cInit(params)
      ).to.be.revertedWithCustomError(f.token, "InvalidArrayLength")
    })

    it("Should revert if length in params.output mismatch", async function () {
      const proof = f.MOCK_PROOF_OUTPUT
      const params = f.sdk.getInitParams(proof)
      params.artifacts.proof.pop()
      await expect(
        f.token.connect(f.userUninitialized).cInit(params)
      ).to.be.revertedWithCustomError(f.token, "InvalidArrayLength")
    })
  })
})
