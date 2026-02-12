import { expect } from "chai"

import { conn, baseSetup } from "../../BaseSetup.js"

describe("ConfidentialTransfers", function () {
  describe("Cold:ConfidentialTransfers", function () {
    describe("Cold:ConfidentialTransfers:cMint()", function () {
      let f: Awaited<ReturnType<typeof baseSetup>>
      let TARGET_AMOUNT_AFTER_MINT: bigint
      beforeEach(async function () {
        f = await conn.networkHelpers.loadFixture(baseSetup)
        const [signer, _] = await conn.ethers.getSigners()
        const tokenOwnableContract = new conn.ethers.Contract(
          await f.sdk.token.getAddress(),
          [
            "function transferOwnership(address newOwner)",
            "function owner() view returns (address)",
          ],
          signer
        )
        await f.cDeposit("cold", f.user1, f.DEPOSIT_AMOUNT) // necessary to increase nonce
        await (tokenOwnableContract as any)
          .connect(signer)
          .transferOwnership(f.user1.address)
        TARGET_AMOUNT_AFTER_MINT = f.DEPOSIT_AMOUNT + f.MINT_AMOUNT
      })

      describe("State Changes", function () {
        describe("Payload", function () {
          beforeEach(async function () {
            await f.cMint("cold", f.user1, f.MINT_AMOUNT)
          })
          it("Should update commitment", async function () {
            const accountAfter = await f.token.getAccount(f.user1.address)
            const otk = await f.sdk.generateOTK(f.user1CPrivateKey, 2n)
            const comm = await f.SDK.generateCommitment(
              TARGET_AMOUNT_AFTER_MINT,
              otk
            )
            expect(accountAfter.state.commitment).to.equal(comm)
          })

          it("Should update encrypted amount", async function () {
            const accountAfter = await f.token.getAccount(f.user1.address)
            const otk = await f.sdk.generateOTK(f.user1CPrivateKey, 2n)
            const eAmount = await f.SDK.cipher(
              otk,
              2n,
              TARGET_AMOUNT_AFTER_MINT
            )
            expect(accountAfter.state.eAmount).to.equal(eAmount)
          })

          it("Should update nonce", async function () {
            const accountAfter = await f.token.getAccount(f.user1.address)
            expect(accountAfter.state.nonce).to.equal(2n)
          })
        })

        it("Should update user on-chain confidential balance", async function () {
          await f.cMint("cold", f.user1, f.MINT_AMOUNT)
          expect(
            await f.sdk.сBalanceOf(f.user1.address, f.user1CPrivateKey)
          ).to.equal(TARGET_AMOUNT_AFTER_MINT)
        })

        it("Should update auditor reports", async function () {
          const nonce = await f.getNonce(f.user1)
          const proofFilename = f.getFilename(
            "mint",
            f.user1.index,
            nonce,
            f.MINT_AMOUNT
          )
          const proof = f.getProofOutput(proofFilename)
          const auditorReports = await f.sdk.createStateAuditReport(
            f.user1CPrivateKey,
            nonce,
            [f.user2.address]
          )
          const params = f.sdk.getMintParams(proof, auditorReports)
          await f.token.connect(f.user1).cMint(params)
          const accountAfter = await f.token.getAccount(f.user1.address)
          expect(accountAfter.auditReports.length).to.equal(1)
          expect(accountAfter.auditReports[0].auditor).to.equal(f.user2.address)
          expect(accountAfter.auditReports[0].eOTK).to.equal(
            auditorReports[0].eOTK
          )
        })

        it("Should emit event", async function () {
          const proofFilename = f.getFilename(
            "mint",
            f.user1.index,
            await f.getNonce(f.user1),
            f.MINT_AMOUNT
          )
          const proof = f.getProofOutput(proofFilename)
          const params = f.sdk.getMintParams(proof)
          await expect(f.token.connect(f.user1).cMint(params)).to.emit(
            f.token,
            "CMinted"
          )
        })
      })

      describe("Reverts", function () {
        it("Should revert if the account is not initialized", async function () {
          const params = f.sdk.getMintParams(f.MOCK_PROOF_OUTPUT)
          await expect(
            f.token.connect(f.userUninitialized).cMint(params)
          ).to.be.revertedWithCustomError(f.token, "AccountNotInitialized")
        })

        it("Should revert if the proof verification fails", async function () {
          const proofFilename = f.getFilename(
            "mint",
            f.user1.index,
            await f.getNonce(f.user1),
            f.MINT_AMOUNT
          )
          const proof = f.getProofOutput(proofFilename)
          proof.pubSignals[0] = BigInt(proof.pubSignals[0]) + 1n
          const params = f.sdk.getMintParams(proof)
          await expect(
            f.token.connect(f.user1).cMint(params)
          ).to.be.revertedWithCustomError(f.token, "ProofVerificationFailed")
        })

        it("Should revert if length in params.output mismatch", async function () {
          const proofFilename = f.getFilename(
            "mint",
            f.user1.index,
            await f.getNonce(f.user1),
            f.MINT_AMOUNT
          )
          const proof = f.getProofOutput(proofFilename)
          const params = f.sdk.getMintParams(proof)
          params.artifacts.outputs.pop()
          await expect(
            f.token.connect(f.user1).cMint(params)
          ).to.be.revertedWithCustomError(f.token, "InvalidArrayLength")
        })

        it("Should revert if proof length mismatch", async function () {
          const proofFilename = f.getFilename(
            "mint",
            f.user1.index,
            await f.getNonce(f.user1),
            f.MINT_AMOUNT
          )
          const proof = f.getProofOutput(proofFilename)
          const params = f.sdk.getMintParams(proof)
          params.artifacts.proof.pop()
          await expect(
            f.token.connect(f.user1).cMint(params)
          ).to.be.revertedWithCustomError(f.token, "InvalidArrayLength")
        })

        it("Should revert if required auditor is not found", async function () {
          await f.token.connect(f.user1).addRequiredAuditor(f.user2.address)
          const params = f.sdk.getMintParams(f.MOCK_PROOF_OUTPUT)
          await expect(
            f.token.connect(f.user1).cMint(params)
          ).to.be.revertedWithCustomError(f.token, "NotFound")
        })
      })
    })
  })
})
