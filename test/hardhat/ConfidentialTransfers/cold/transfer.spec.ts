import { baseSetup, conn } from "../../BaseSetup.js"
import { expect } from "chai"

describe("ConfidentialTransfers", function () {
  describe("ConfidentialTransfers/cold", function () {
    describe("Cold:ConfidentialTransfers:cTransfer()", function () {
      let f: Awaited<ReturnType<typeof baseSetup>>

      beforeEach(async function () {
        f = await conn.networkHelpers.loadFixture(baseSetup)
        await f.cDeposit("cold", f.user1, f.DEPOSIT_AMOUNT)
      })

      describe("State Changes", function () {
        beforeEach(async function () {
          await f.cTransfer("cold", f.user1, f.user2.address, f.TRANSFER_AMOUNT)
        })

        describe("Payload", function () {
          it("Should update commitment", async function () {
            const accountAfter = await f.token.getAccount(f.user1.address)
            const otk = await f.SDK.generateOTK(f.user1CPrivateKey, 2n)
            const amount = f.DEPOSIT_AMOUNT - f.TRANSFER_AMOUNT
            const comm = await f.SDK.generateCommitment(amount, otk)
            expect(accountAfter.state.commitment).to.equal(comm)
          })

          it("Should update encrypted amount", async function () {
            const accountAfter = await f.token.getAccount(f.user1.address)
            const otk = await f.SDK.generateOTK(f.user1CPrivateKey, 2n)
            const amount = f.DEPOSIT_AMOUNT - f.TRANSFER_AMOUNT
            const eAmount = await f.SDK.cipher(otk, 2n, amount)
            expect(accountAfter.state.eAmount).to.equal(eAmount)
          })

          it("Should update nonce", async function () {
            const accountAfter = await f.token.getAccount(f.user1.address)
            expect(accountAfter.state.nonce).to.equal(2n)
          })
        })

        it("Should update user on-chain confidential balance", async function () {
          expect(
            await f.sdk.сBalanceOf(f.user1.address, f.user1CPrivateKey)
          ).to.equal(f.DEPOSIT_AMOUNT - f.TRANSFER_AMOUNT)
        })

        it("Should update recipient's pending transfers queue", async function () {
          const recipientAccount = await f.token.getAccount(f.user2.address)
          expect(recipientAccount.pendingTransfers.length).to.equal(1)
        })

        it("Should update auditor reports", async function () {
          const nonce = await f.getNonce(f.user1)
          const proofFilename = f.getFilename(
            "transfer",
            f.user1.index,
            nonce,
            f.TRANSFER_AMOUNT
          )
          const proof = f.getProofOutput(proofFilename)

          const stateAuditorReports = await f.sdk.createStateAuditReport(
            f.user1CPrivateKey,
            nonce,
            [f.user2.address]
          )
          const transferAuditorReports = await f.sdk.createTransferAuditReport(
            f.user1CPrivateKey,
            nonce,
            f.user2.address,
            [f.user2.address]
          )
          const params = f.sdk.getTransferParams(
            f.user2.address,
            proof,
            stateAuditorReports,
            transferAuditorReports
          )
          await f.token.connect(f.user1).cTransfer(params)
          const accountAfter = await f.token.getAccount(f.user1.address)
          expect(accountAfter.auditReports.length).to.equal(1)
          expect(accountAfter.auditReports[0].auditor).to.equal(f.user2.address)
          expect(accountAfter.auditReports[0].eOTK).to.equal(
            stateAuditorReports[0].eOTK
          )
          const recipientAccountPendingTransfers = (
            await f.token.getAccount(f.user2.address)
          ).pendingTransfers
          expect(
            recipientAccountPendingTransfers[1].auditReports.length
          ).to.equal(1)
          expect(
            recipientAccountPendingTransfers[1].auditReports[0].auditor
          ).to.equal(f.user2.address)
          expect(
            recipientAccountPendingTransfers[1].auditReports[0].eOTK
          ).to.equal(transferAuditorReports[0].eOTK)
        })

        it("Should emit event", async function () {
          const proofFilename = f.getFilename(
            "transfer",
            f.user1.index,
            await f.getNonce(f.user1),
            f.TRANSFER_AMOUNT
          )
          const proof = f.getProofOutput(proofFilename)
          const params = f.sdk.getTransferParams(f.user2.address, proof)
          await expect(f.token.connect(f.user1).cTransfer(params)).to.emit(
            f.token,
            "CTransferred"
          )
        })
      })

      describe("Reverts", function () {
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
          const params = f.sdk.getTransferParams(
            f.userUninitialized.address,
            proof
          )
          await expect(
            f.token.connect(f.userUninitialized).cTransfer(params)
          ).to.be.revertedWithCustomError(f.token, "AccountNotInitialized")
        })

        it("Should revert if max pending transfers is reached", async function () {
          await f.cTransfer("cold", f.user1, f.user2.address, f.TRANSFER_AMOUNT)
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

        it("Should revert if length in params.output mismatch", async function () {
          const params = f.sdk.getTransferParams(
            f.user2.address,
            f.MOCK_PROOF_OUTPUT
          )
          params.artifacts.outputs.pop()
          await expect(
            f.token.connect(f.user1).cTransfer(params)
          ).to.be.revertedWithCustomError(f.token, "InvalidArrayLength")
        })

        it("Should revert if proof length mismatch", async function () {
          const params = f.sdk.getTransferParams(
            f.user2.address,
            f.MOCK_PROOF_OUTPUT
          )
          params.artifacts.proof.pop()
          await expect(
            f.token.connect(f.user1).cTransfer(params)
          ).to.be.revertedWithCustomError(f.token, "InvalidArrayLength")
        })

        it("Should revert if required auditor is not found", async function () {
          await f.token.connect(f.user1).addRequiredAuditor(f.user2.address)
          const params = f.sdk.getTransferParams(
            f.user2.address,
            f.MOCK_PROOF_OUTPUT
          )
          await expect(
            f.token.connect(f.user1).cTransfer(params)
          ).to.be.revertedWithCustomError(f.token, "NotFound")
        })
      })
    })
  })
})
