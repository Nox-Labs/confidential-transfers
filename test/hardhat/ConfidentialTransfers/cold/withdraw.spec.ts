import { expect } from "chai"

import { baseSetup, conn } from "../../BaseSetup.js"
import type { AccountStruct } from "../../../../out/hardhat/typechain/src/ConfidentialTransfers.js"
import type { ProofOutput } from "../../../../packages/sdk/src/modules/types.js"

describe("ConfidentialTransfers/cold", function () {
  describe("cWithdraw()", function () {
    let f: Awaited<ReturnType<typeof baseSetup>>

    let accountBefore: AccountStruct
    let accountAfter: AccountStruct

    let proof: ProofOutput

    beforeEach(async function () {
      f = await conn.networkHelpers.loadFixture(baseSetup)

      await f.cDeposit("cold", f.user1, f.DEPOSIT_AMOUNT)

      accountBefore = await f.token.getAccount(f.user1.address)

      proof = await f.cWithdraw("cold", f.user1, f.WITHDRAW_AMOUNT)

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
        f.INITIAL_BALANCE - f.DEPOSIT_AMOUNT + f.WITHDRAW_AMOUNT
      )
    })

    it("Should update user's on-chain confidential balance", async function () {
      expect(
        await f.sdk.сBalanceOf(f.user1.address, f.user1CPrivateKey)
      ).to.equal(f.DEPOSIT_AMOUNT - f.WITHDRAW_AMOUNT)
    })

    it("Should transfer the tokens from the shielded pool to the user", async function () {
      expect(await f.token.balanceOf(await f.token.getAddress())).to.equal(
        f.DEPOSIT_AMOUNT - f.WITHDRAW_AMOUNT
      )
    })

    it("Should revert if the proof verification fails", async function () {
      const proofFilename = f.getFilename(
        "withdraw",
        f.user1.index,
        await f.getNonce(f.user1),
        f.WITHDRAW_AMOUNT
      )
      const proof = f.getProofOutput(proofFilename)
      proof.pubSignals[0] = BigInt(proof.pubSignals[0]) + 1n
      const params = f.sdk.getWithdrawParams(proof)
      await expect(
        f.token.connect(f.user1).cWithdraw(params)
      ).to.be.revertedWithCustomError(f.token, "ProofVerificationFailed")
    })

    it("Should revert if the account is not initialized", async function () {
      const proof = f.MOCK_PROOF_OUTPUT
      const params = f.sdk.getWithdrawParams(proof)
      await expect(
        f.token.connect(f.userUninitialized).cWithdraw(params)
      ).to.be.revertedWithCustomError(f.token, "AccountNotInitialized")
    })
  })
})
