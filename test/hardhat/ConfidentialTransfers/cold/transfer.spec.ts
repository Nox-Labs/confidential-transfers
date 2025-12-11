import type { ProofOutput } from "../../../../packages/sdk/src/modules/types.js"
import type { AccountStruct } from "../../../../out/hardhat/typechain/src/ConfidentialTransfers.js"
import { baseSetup, conn } from "../../BaseSetup.js"
import { expect } from "chai"

describe("ConfidentialTransfers/cold", function () {
  describe("cTransfer()", function () {
    let f: Awaited<ReturnType<typeof baseSetup>>

    let accountBefore: AccountStruct
    let accountAfter: AccountStruct

    let proof: ProofOutput

    beforeEach(async function () {
      f = await conn.networkHelpers.loadFixture(baseSetup)

      await f.cDeposit("cold", f.user1, f.DEPOSIT_AMOUNT)

      accountBefore = await f.token.getAccount(f.user1.address)

      proof = await f.cTransfer(
        "cold",
        f.user1,
        f.user2.address,
        f.TRANSFER_AMOUNT
      )

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

    it("Should update user's on-chain confidential balance", async function () {
      expect(
        await f.sdk.сBalanceOf(f.user1.address, f.user1CPrivateKey)
      ).to.equal(f.DEPOSIT_AMOUNT - f.TRANSFER_AMOUNT)
    })

    it("Should not change shielded pool balance", async function () {
      expect(await f.token.balanceOf(await f.token.getAddress())).to.equal(
        f.DEPOSIT_AMOUNT
      )
    })

    it("Should add a pending transfer to the recipient's account", async function () {
      const recipientAccount = await f.token.getAccount(f.user2.address)
      expect(recipientAccount.pendingTransfers.length).to.equal(1)
    })

    it("Should revert if the proof verification fails", async function () {
      const filename = f.getFilename(
        "transfer",
        f.user1.index,
        await f.getNonce(f.user1),
        f.TRANSFER_AMOUNT
      )
      const proof = f.getProofOutput(filename)
      proof.pubSignals[0] = BigInt(proof.pubSignals[0]) + 1n
      const params = f.sdk.getTransferParams(f.user2.address, proof)
      await expect(
        f.token.connect(f.user1).cTransfer(params)
      ).to.be.revertedWithCustomError(f.token, "ProofVerificationFailed")
    })

    it("Should revert if the account is not initialized", async function () {
      const proof = f.MOCK_PROOF_OUTPUT
      const params = f.sdk.getTransferParams(f.userUninitialized.address, proof)
      await expect(
        f.token.connect(f.userUninitialized).cTransfer(params)
      ).to.be.revertedWithCustomError(f.token, "AccountNotInitialized")
    })

    it("Should revert if max pending transfers is reached", async function () {
      await f.cTransfer("cold", f.user1, f.user2.address, f.TRANSFER_AMOUNT)
      await f.cTransfer("cold", f.user1, f.user2.address, f.TRANSFER_AMOUNT)
      await f.cTransfer("cold", f.user1, f.user2.address, f.TRANSFER_AMOUNT)

      const params = f.sdk.getTransferParams(
        f.user2.address,
        f.MOCK_PROOF_OUTPUT
      )
      await expect(
        f.token.connect(f.user1).cTransfer(params)
      ).to.be.revertedWithCustomError(f.token, "MaxPendingTransfersReached")
    })
  })
})
