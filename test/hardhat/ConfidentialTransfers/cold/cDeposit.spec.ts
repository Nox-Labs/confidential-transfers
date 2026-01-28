import { expect } from "chai"

import { conn, baseSetup } from "../../BaseSetup.js"

describe("ConfidentialTransfers", function () {
  describe("Cold:ConfidentialTransfers", function () {
    describe("Cold:ConfidentialTransfers:cDeposit()", function () {
      let f: Awaited<ReturnType<typeof baseSetup>>
      beforeEach(async function () {
        f = await conn.networkHelpers.loadFixture(baseSetup)
      })

      describe("State Changes", function () {
        beforeEach(async function () {
          await f.cDeposit("cold", f.user1, f.DEPOSIT_AMOUNT)
        })

        describe("Payload", function () {
          it("Should update commitment", async function () {
            const accountAfter = await f.token.getAccount(f.user1.address)
            const otk = await f.sdk.generateOTK(f.user1CPrivateKey, 1n)
            const comm = await f.SDK.generateCommitment(f.DEPOSIT_AMOUNT, otk)
            expect(accountAfter.state.commitment).to.equal(comm)
          })

          it("Should update encrypted amount", async function () {
            const accountAfter = await f.token.getAccount(f.user1.address)
            const otk = await f.sdk.generateOTK(f.user1CPrivateKey, 1n)
            const eAmount = await f.SDK.cipher(otk, 1n, f.DEPOSIT_AMOUNT)
            expect(accountAfter.state.eAmount).to.equal(eAmount)
          })

          it("Should update nonce", async function () {
            const accountAfter = await f.token.getAccount(f.user1.address)
            expect(accountAfter.state.nonce).to.equal(1n)
          })
        })

        it("Should update user on-chain public balance", async function () {
          expect(await f.token.balanceOf(f.user1.address)).to.equal(
            f.INITIAL_BALANCE - f.DEPOSIT_AMOUNT,
          )
        })

        it("Should update user on-chain confidential balance", async function () {
          expect(
            await f.sdk.сBalanceOf(f.user1.address, f.user1CPrivateKey),
          ).to.equal(f.DEPOSIT_AMOUNT)
        })

        it("Should update balance of tokens in the shielded pool (contract's balance)", async function () {
          expect(await f.token.balanceOf(await f.token.getAddress())).to.equal(
            f.DEPOSIT_AMOUNT,
          )
        })

        it("Should update user on-chain confidential balance after a second deposit", async function () {
          await f.cDeposit("cold", f.user1, f.DEPOSIT_AMOUNT)

          expect(
            await f.sdk.сBalanceOf(f.user1.address, f.user1CPrivateKey),
          ).to.equal(f.DEPOSIT_AMOUNT * 2n)
        })

        it("Should update auditor reports", async function () {
          const nonce = await f.getNonce(f.user1)
          const proofFilename = f.getFilename(
            "deposit",
            f.user1.index,
            nonce,
            f.DEPOSIT_AMOUNT,
          )
          const proof = f.getProofOutput(proofFilename)
          const auditorReports = await f.sdk.createStateAuditReport(
            f.user1CPrivateKey,
            nonce,
            [f.user2.address],
          )
          const params = f.sdk.getDepositParams(proof, auditorReports)
          await f.token.connect(f.user1).cDeposit(params)
          const accountAfter = await f.token.getAccount(f.user1.address)
          expect(accountAfter.auditReports.length).to.equal(1)
          expect(accountAfter.auditReports[0].auditor).to.equal(f.user2.address)
          expect(accountAfter.auditReports[0].eOTK).to.equal(
            auditorReports[0].eOTK,
          )
        })

        it("Should emit event", async function () {
          const proofFilename = f.getFilename(
            "deposit",
            f.user1.index,
            await f.getNonce(f.user1),
            f.DEPOSIT_AMOUNT,
          )
          const proof = f.getProofOutput(proofFilename)
          const params = f.sdk.getDepositParams(proof)
          await expect(f.token.connect(f.user1).cDeposit(params)).to.emit(
            f.token,
            "CDeposited",
          )
        })
      })

      describe("Reverts", function () {
        it("Should revert if the account is not initialized", async function () {
          const params = f.sdk.getDepositParams(f.MOCK_PROOF_OUTPUT)
          await expect(
            f.token.connect(f.userUninitialized).cDeposit(params),
          ).to.be.revertedWithCustomError(f.token, "AccountNotInitialized")
        })

        it("Should revert if the proof verification fails", async function () {
          const proofFilename = f.getFilename(
            "deposit",
            f.user1.index,
            await f.getNonce(f.user1),
            f.DEPOSIT_AMOUNT,
          )
          const proof = f.getProofOutput(proofFilename)
          proof.pubSignals[0] = BigInt(proof.pubSignals[0]) + 1n
          const params = f.sdk.getDepositParams(proof)
          await expect(
            f.token.connect(f.user1).cDeposit(params),
          ).to.be.revertedWithCustomError(f.token, "ProofVerificationFailed")
        })

        it("Should revert if length in params.output mismatch", async function () {
          const proofFilename = f.getFilename(
            "deposit",
            f.user1.index,
            await f.getNonce(f.user1),
            f.DEPOSIT_AMOUNT,
          )
          const proof = f.getProofOutput(proofFilename)
          const params = f.sdk.getDepositParams(proof)
          params.artifacts.outputs.pop()
          await expect(
            f.token.connect(f.user1).cDeposit(params),
          ).to.be.revertedWithCustomError(f.token, "InvalidArrayLength")
        })

        it("Should revert if proof length mismatch", async function () {
          const proofFilename = f.getFilename(
            "deposit",
            f.user1.index,
            await f.getNonce(f.user1),
            f.DEPOSIT_AMOUNT,
          )
          const proof = f.getProofOutput(proofFilename)
          const params = f.sdk.getDepositParams(proof)
          params.artifacts.proof.pop()
          await expect(
            f.token.connect(f.user1).cDeposit(params),
          ).to.be.revertedWithCustomError(f.token, "InvalidArrayLength")
        })

        it("Should revert if required auditor is not found", async function () {
          await f.token.connect(f.user1).addRequiredAuditor(f.user2.address)
          const params = f.sdk.getDepositParams(f.MOCK_PROOF_OUTPUT)
          await expect(
            f.token.connect(f.user1).cDeposit(params),
          ).to.be.revertedWithCustomError(f.token, "NotFound")
        })
      })
    })
  })
})
