import { baseSetup, conn } from "../../BaseSetup.js"
import { expect } from "chai"

describe("ConfidentialTransfers", function () {
  describe("Cold:ConfidentialTransfers", function () {
    describe("Cold:ConfidentialTransfers:cApplyAndTransfer()", function () {
      let f: Awaited<ReturnType<typeof baseSetup>>

      beforeEach(async function () {
        f = await conn.networkHelpers.loadFixture(baseSetup)
        await f.cDeposit("cold", f.user1, f.DEPOSIT_AMOUNT)
        await f.cTransfer("cold", f.user1, f.user2.address, f.TRANSFER_AMOUNT)
      })

      describe("State Changes", function () {
        beforeEach(async function () {
          await f.cApplyAndTransfer(
            "cold",
            f.user2,
            [0],
            f.user1.address,
            f.TRANSFER_AMOUNT
          )
        })

        describe("Payload", function () {
          it("Should update commitment", async function () {
            const accountAfter = await f.token.getAccount(f.user2.address)
            const otk = await f.SDK.generateOTK(f.user2CPrivateKey, 1n)
            const comm = await f.SDK.generateCommitment(0n, otk)
            expect(accountAfter.state.commitment).to.equal(comm)
          })

          it("Should update encrypted amount", async function () {
            const accountAfter = await f.token.getAccount(f.user2.address)
            const otk = await f.SDK.generateOTK(f.user2CPrivateKey, 1n)
            const eAmount = await f.SDK.cipher(otk, 1n, 0n)
            expect(accountAfter.state.eAmount).to.equal(eAmount)
          })

          it("Should update nonce", async function () {
            expect(await f.getNonce(f.user2)).to.equal(1n)
          })
        })

        it("Should update user on-chain confidential balance", async function () {
          expect(
            await f.sdk.сBalanceOf(f.user2.address, f.user2CPrivateKey)
          ).to.equal(0)
        })

        it("Should update recipient pending transfers queue", async function () {
          expect(
            (await f.token.getAccount(f.user1.address)).pendingTransfers.length
          ).to.equal(1)
        })

        it("Should update sender pending transfers queue", async function () {
          const accountAfter = await f.token.getAccount(f.user2.address)
          expect(accountAfter.pendingTransfers.length).to.equal(0)
        })
      })

      describe("With multiple pending transfers", function () {
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

      describe("", function () {
        describe("State Changes", function () {
          it("Should update auditor reports", async function () {
            const nonce = await f.getNonce(f.user2)
            const proofFilename = f.getFilename(
              "applyAndTransfer",
              f.user2.index,
              nonce,
              undefined,
              [0]
            )
            const proof = f.getProofOutput(proofFilename)
            const stateAuditorReports = await f.sdk.createStateAuditReport(
              f.user2CPrivateKey,
              nonce,
              [f.user1.address]
            )
            const params = f.sdk.getApplyAndTransferParams(
              f.user1.address,
              [0],
              proof,
              stateAuditorReports
            )
            await f.token.connect(f.user2).cApplyAndTransfer(params)
            const accountAfter = await f.token.getAccount(f.user2.address)
            expect(accountAfter.auditReports.length).to.equal(1)
            expect(accountAfter.auditReports[0].auditor).to.equal(
              f.user1.address
            )
            expect(accountAfter.auditReports[0].eOTK).to.equal(
              stateAuditorReports[0].eOTK
            )
          })
          it("Should emit event", async function () {
            const proofFilename = f.getFilename(
              "applyAndTransfer",
              f.user2.index,
              await f.getNonce(f.user2),
              undefined,
              [0]
            )
            const proof = f.getProofOutput(proofFilename)
            const params = f.sdk.getApplyAndTransferParams(
              f.user1.address,
              [0],
              proof
            )
            await expect(f.token.connect(f.user2).cApplyAndTransfer(params))
              .to.emit(f.token, "CApplied")
              .and.emit(f.token, "CTransferred")
          })
        })

        describe("Reverts", function () {
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
              f.token
                .connect(f.user2)
                .cApply(f.sdk.getApplyParams(indexes, proof))
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

          it("Should revert if proof length mismatch", async function () {
            const indexes = [0]
            const filename = f.getFilename(
              "applyAndTransfer",
              f.user2.index,
              await f.getNonce(f.user2),
              undefined,
              indexes
            )
            const proof = f.getProofOutput(filename)
            const params = f.sdk.getApplyAndTransferParams(
              f.user1.address,
              [0],
              proof
            )
            params.artifacts.proof.pop()
            await expect(
              f.token.connect(f.user2).cApplyAndTransfer(params)
            ).to.be.revertedWithCustomError(f.token, "InvalidArrayLength")
          })

          it("Should revert if required auditor is not found", async function () {
            await f.cTransfer(
              "cold",
              f.user1,
              f.user2.address,
              f.TRANSFER_AMOUNT
            )
            await f.token.connect(f.user2).addRequiredAuditor(f.user1.address)
            const params = f.sdk.getApplyAndTransferParams(
              f.user1.address,
              [0],
              f.MOCK_PROOF_OUTPUT
            )
            await expect(
              f.token.connect(f.user2).cApplyAndTransfer(params)
            ).to.be.revertedWithCustomError(f.token, "NotFound")
          })
        })
      })
    })
  })
})
