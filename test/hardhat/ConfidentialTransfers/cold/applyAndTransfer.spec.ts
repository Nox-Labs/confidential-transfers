import { baseSetup, conn } from "../../BaseSetup.js"
import { expect } from "chai"
import type { ProofOutput } from "../../../../packages/sdk/src/modules/types.js"

describe("ConfidentialTransfers/cold", function () {
  let f: Awaited<ReturnType<typeof baseSetup>>

  beforeEach(async function () {
    f = await conn.networkHelpers.loadFixture(baseSetup)

    await f.cDeposit("cold", f.user1, f.DEPOSIT_AMOUNT)

    await f.cTransfer("cold", f.user1, f.user2.address, f.TRANSFER_AMOUNT)
  })

  describe("cApplyAndTransfer()", function () {
    let proof: ProofOutput
    beforeEach(async function () {
      proof = await f.cApplyAndTransfer(
        "cold",
        f.user2,
        [0],
        f.user1.address,
        f.TRANSFER_AMOUNT
      )
    })

    it("Should update commitment", async function () {
      const accountAfter = await f.token.getAccount(f.user2.address)
      expect(accountAfter.state.commitment).to.equal(proof.pubSignals[0])
    })

    it("Should update encrypted amount", async function () {
      const accountAfter = await f.token.getAccount(f.user2.address)
      expect(accountAfter.state.eAmount).to.equal(proof.pubSignals[1])
    })

    it("Should update nonce", async function () {
      expect(await f.getNonce(f.user2)).to.equal(1n)
    })

    it("Should update user's on-chain confidential balance", async function () {
      expect(
        await f.sdk.сBalanceOf(f.user2.address, f.user2CPrivateKey)
      ).to.equal(0)
    })

    it("Should increase recipient pending transfers queue", async function () {
      expect(
        (await f.token.getAccount(f.user1.address)).pendingTransfers.length
      ).to.equal(1)
    })

    it("Should decrease sender pending transfers queue", async function () {
      const accountAfter = await f.token.getAccount(f.user2.address)
      expect(accountAfter.pendingTransfers.length).to.equal(0)
    })
  })

  describe("cApplyAndTransfer() with multiple pending transfers", function () {
    beforeEach(async function () {
      await f.cTransfer("cold", f.user1, f.user2.address, f.TRANSFER_AMOUNT)
      await f.cTransfer("cold", f.user1, f.user2.address, f.TRANSFER_AMOUNT)
    })

    it("Should complete first pending transfers", async function () {
      const accountBefore = await f.token.getAccount(f.user2.address)
      await f.cApplyAndTransfer(
        "cold",
        f.user2,
        [0],
        f.user1.address,
        f.TRANSFER_AMOUNT
      )
      const accountAfter = await f.token.getAccount(f.user2.address)

      expect(accountAfter.pendingTransfers.length).to.equal(2)
      expect(accountAfter.pendingTransfers[0].payload.commitment).to.equal(
        accountBefore.pendingTransfers[2].payload.commitment
      )
      expect(accountAfter.pendingTransfers[1].payload.commitment).to.equal(
        accountBefore.pendingTransfers[1].payload.commitment
      )
    })

    it("Should complete pending transfer from middle", async function () {
      const accountBefore = await f.token.getAccount(f.user2.address)
      await f.cApplyAndTransfer(
        "cold",
        f.user2,
        [1],
        f.user1.address,
        f.TRANSFER_AMOUNT
      )
      const accountAfter = await f.token.getAccount(f.user2.address)

      expect(accountAfter.pendingTransfers.length).to.equal(2)
      expect(accountAfter.pendingTransfers[0].payload.commitment).to.equal(
        accountBefore.pendingTransfers[0].payload.commitment
      )
      expect(accountAfter.pendingTransfers[1].payload.commitment).to.equal(
        accountBefore.pendingTransfers[2].payload.commitment
      )
    })

    it("Should complete last pending transfer", async function () {
      const accountBefore = await f.token.getAccount(f.user2.address)
      await f.cApplyAndTransfer(
        "cold",
        f.user2,
        [2],
        f.user1.address,
        f.TRANSFER_AMOUNT
      )
      const accountAfter = await f.token.getAccount(f.user2.address)

      expect(accountAfter.pendingTransfers.length).to.equal(2)
      expect(accountAfter.pendingTransfers[0].payload.commitment).to.equal(
        accountBefore.pendingTransfers[0].payload.commitment
      )
      expect(accountAfter.pendingTransfers[1].payload.commitment).to.equal(
        accountBefore.pendingTransfers[1].payload.commitment
      )
    })

    it("Should complete two sequential pending transfers", async function () {
      const accountBefore = await f.token.getAccount(f.user2.address)
      await f.cApplyAndTransfer(
        "cold",
        f.user2,
        [0, 1],
        f.user1.address,
        f.TRANSFER_AMOUNT
      )
      const accountAfter = await f.token.getAccount(f.user2.address)

      expect(accountAfter.pendingTransfers.length).to.equal(1)
      expect(accountAfter.pendingTransfers[0].payload.commitment).to.equal(
        accountBefore.pendingTransfers[2].payload.commitment
      )

      expect(
        await f.sdk.сBalanceOf(f.user2.address, f.user2CPrivateKey)
      ).to.equal(f.TRANSFER_AMOUNT * 2n - f.TRANSFER_AMOUNT)
    })

    it("Should complete two non-sequential pending transfers", async function () {
      const accountBefore = await f.token.getAccount(f.user2.address)
      await f.cApplyAndTransfer(
        "cold",
        f.user2,
        [0, 2],
        f.user1.address,
        f.TRANSFER_AMOUNT
      )
      const accountAfter = await f.token.getAccount(f.user2.address)

      expect(accountAfter.pendingTransfers.length).to.equal(1)
      expect(accountAfter.pendingTransfers[0].payload.commitment).to.equal(
        accountBefore.pendingTransfers[1].payload.commitment
      )

      expect(
        await f.sdk.сBalanceOf(f.user2.address, f.user2CPrivateKey)
      ).to.equal(f.TRANSFER_AMOUNT * 2n - f.TRANSFER_AMOUNT)
    })

    it("Should complete all pending transfers", async function () {
      await f.cApplyAndTransfer(
        "cold",
        f.user2,
        [0, 1, 2],
        f.user1.address,
        f.TRANSFER_AMOUNT
      )
      const accountAfter = await f.token.getAccount(f.user2.address)

      expect(accountAfter.pendingTransfers.length).to.equal(0)
      expect(
        await f.sdk.сBalanceOf(f.user2.address, f.user2CPrivateKey)
      ).to.equal(f.TRANSFER_AMOUNT * 3n - f.TRANSFER_AMOUNT)
    })
  })

  describe("cApplyAndTransfer() reverted", function () {
    it("Should revert if the proof verification fails", async function () {
      const indexes = [0]

      const filename = f.getFilename(
        "applyAndTransfer",
        f.user2.index,
        await f.getNonce(f.user2),
        undefined,
        indexes
      )

      const proof = f.getProofOutput(filename)
      proof.pubSignals[0] = BigInt(proof.pubSignals[0]) + 1n
      await expect(
        f.token.connect(f.user2).cApply(f.sdk.getApplyParams(indexes, proof))
      ).to.be.revertedWithCustomError(f.token, "ProofVerificationFailed")
    })

    it("Should revert if length in params.output mismatch", async function () {
      const indexes = [0]
      const filename = f.getFilename(
        "applyAndTransfer",
        f.user2.index,
        await f.getNonce(f.user2),
        undefined,
        indexes
      )

      const proof = f.getProofOutput(filename)
      const params = f.sdk.getApplyParams(indexes, proof)
      params.artifacts.outputs.pop()
      await expect(
        f.token.connect(f.user2).cApply(params)
      ).to.be.revertedWithCustomError(f.token, "InvalidArrayLength")
    })

    // it("Should revert if duplicate indexes are provided", async function () {
    //   await f.cTransfer("cold", f.user1, f.user2.address, f.TRANSFER_AMOUNT)

    //   const indexes = [0, 0]
    //   const filename = f.getFilename(
    //     "applyAndTransfer",
    //     f.user2.index,
    //     await f.getNonce(f.user2),
    //     undefined,
    //     indexes
    //   )
    //   const proof = f.getProofOutput(filename)
    //   await expect(
    //     f.token.connect(f.user2).cApply(f.sdk.getApplyParams(indexes, proof))
    //   ).to.be.revertedWithCustomError(f.token, "DuplicateIndex")
    // })
  })
})
