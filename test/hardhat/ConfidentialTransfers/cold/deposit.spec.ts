import { expect } from "chai"
import { conn, baseSetup } from "../../BaseSetup.js"
import type { ProofOutput } from "../../../../packages/sdk/src/modules/types.js"
import type { AccountStruct } from "../../../../out/hardhat/typechain/src/ConfidentialTransfers.js"

describe("ConfidentialTransfers/cold", function () {
  describe("cDeposit()", function () {
    let f: Awaited<ReturnType<typeof baseSetup>>
    let proof: ProofOutput

    let accountBefore: AccountStruct
    let accountAfter: AccountStruct

    beforeEach(async function () {
      f = await conn.networkHelpers.loadFixture(baseSetup)

      accountBefore = await f.token.getAccount(f.user1.address)

      proof = await f.cDeposit("cold", f.user1, f.DEPOSIT_AMOUNT)

      accountAfter = await f.token.getAccount(f.user1.address)
    })

    it("Should update commitment", async function () {
      expect(accountAfter.state.commitment).to.equal(proof.pubSignals[0])
    })

    it("Should update encrypted amount", async function () {
      expect(accountAfter.state.eAmount).to.equal(proof.pubSignals[1])
    })

    it("Should update nonce", async function () {
      expect(accountAfter.state.nonce).to.equal(
        BigInt(accountBefore.state.nonce) + 1n
      )
    })

    it("Should update user's on-chain public balance", async function () {
      expect(await f.token.balanceOf(f.user1.address)).to.equal(
        f.INITIAL_BALANCE - f.DEPOSIT_AMOUNT
      )
    })

    it("Should update user's on-chain confidential balance", async function () {
      expect(
        await f.sdk.сBalanceOf(f.user1.address, f.user1CPrivateKey)
      ).to.equal(f.DEPOSIT_AMOUNT)
    })

    it("Should transfer the tokens to the shielded pool", async function () {
      expect(await f.token.balanceOf(await f.token.getAddress())).to.equal(
        f.DEPOSIT_AMOUNT
      )
    })

    it("Should update user's on-chain confidential balance after a second deposit", async function () {
      const proofFilename = f.getFilename(
        "deposit",
        f.user1.index,
        await f.getNonce(f.user1),
        f.DEPOSIT_AMOUNT
      )

      const proof = f.getProofOutput(proofFilename)
      const params = f.sdk.getDepositParams(proof)
      await f.token.connect(f.user1).cDeposit(params)

      expect(
        await f.sdk.сBalanceOf(f.user1.address, f.user1CPrivateKey)
      ).to.equal(f.DEPOSIT_AMOUNT * 2n)
    })

    it("Should revert if the account is not initialized", async function () {
      const { token, userUninitialized, sdk } = f

      const proof = f.MOCK_PROOF_OUTPUT
      const params = sdk.getDepositParams(proof)
      await expect(
        token.connect(userUninitialized).cDeposit(params)
      ).to.be.revertedWithCustomError(token, "AccountNotInitialized")
    })

    it("Should revert if the proof verification fails", async function () {
      const proofFilename = f.getFilename(
        "deposit",
        f.user1.index,
        await f.getNonce(f.user1),
        f.DEPOSIT_AMOUNT
      )
      const proof = f.getProofOutput(proofFilename)
      proof.pubSignals[0] = BigInt(proof.pubSignals[0]) + 1n
      const params = f.sdk.getDepositParams(proof)
      await expect(
        f.token.connect(f.user1).cDeposit(params)
      ).to.be.revertedWithCustomError(f.token, "ProofVerificationFailed")
    })
  })
})
