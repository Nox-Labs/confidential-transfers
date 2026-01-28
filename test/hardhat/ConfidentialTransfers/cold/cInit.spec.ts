import { expect } from "chai"
import { baseSetupUninitializedUsers, conn } from "../../BaseSetup.js"
import { getProofFilenameForColdTest } from "../../../utils/script/getProofFilenameForColdTest.js"

describe("ConfidentialTransfers", function () {
  describe("Cold:ConfidentialTransfers", function () {
    describe("Cold:ConfidentialTransfers:cInit()", function () {
      let f: Awaited<ReturnType<typeof baseSetupUninitializedUsers>>
      beforeEach(async function () {
        f = await conn.networkHelpers.loadFixture(baseSetupUninitializedUsers)
      })

      describe("State Changes", function () {
        beforeEach(async function () {
          await f.cInit("cold", f.user1)
        })

        describe("Payload", function () {
          it("Should update commitment", async function () {
            const accountAfter = await f.token.getAccount(f.user1.address)
            const otk = await f.sdk.generateOTK(f.user1CPrivateKey, 0n)
            const commitment = await f.SDK.generateCommitment(0n, otk)
            expect(accountAfter.state.commitment).to.equal(commitment)
          })

          it("Should update encrypted amount", async function () {
            const accountAfter = await f.token.getAccount(f.user1.address)
            const otk = await f.sdk.generateOTK(f.user1CPrivateKey, 0n)
            const eAmount = await f.SDK.cipher(otk, 0n, 0n)
            expect(accountAfter.state.eAmount).to.equal(eAmount)
          })

          it("Should update nonce", async function () {
            const accountAfter = await f.token.getAccount(f.user1.address)
            expect(accountAfter.state.nonce).to.equal(0n)
          })
        })

        it("Should update public key", async function () {
          const keys = await f.SDK.deriveConfidentialKeys(
            BigInt(f.user1.privateKey),
          )

          const accountAfter = await f.token.getAccount(f.user1.address)

          expect(accountAfter.pubKeyX).to.equal(keys.cPublicKeyX)
          expect(accountAfter.pubKeyY).to.equal(keys.cPublicKeyY)
        })

        it("Should update auditor reports", async function () {
          const filename = getProofFilenameForColdTest(
            "init",
            f.user1.index,
            await f.getNonce(f.user2),
          )
          const proof = f.getProofOutput(filename)
          const auditorReports = await f.sdk.createStateAuditReport(
            f.user2CPrivateKey,
            await f.getNonce(f.user2),
            [f.user1.address],
          )
          const params = f.sdk.getInitParams(proof, auditorReports)
          await f.token.connect(f.user2).cInit(params)
          const accountAfter = await f.token.getAccount(f.user2.address)
          expect(accountAfter.auditReports.length).to.equal(1)
          expect(accountAfter.auditReports[0].auditor).to.equal(f.user1.address)
          expect(accountAfter.auditReports[0].eOTK).to.equal(
            auditorReports[0].eOTK,
          )
        })

        it("Should emit event", async function () {
          const filename = getProofFilenameForColdTest(
            "init",
            f.user2.index,
            await f.getNonce(f.user2),
          )
          const proof = f.getProofOutput(filename)
          const params = f.sdk.getInitParams(proof)
          await expect(f.token.connect(f.user2).cInit(params)).to.emit(
            f.token,
            "CInitialized",
          )
        })
      })

      describe("Reverts", function () {
        it("Should revert if the proof verification fails", async function () {
          const params = f.sdk.getInitParams(f.MOCK_PROOF_OUTPUT)
          await expect(
            f.token.connect(f.user1).cInit(params),
          ).to.be.revertedWithCustomError(f.token, "ProofVerificationFailed")
        })

        it("Should revert if the account is already initialized", async function () {
          await f.cInit("cold", f.user1)
          await expect(
            f.token
              .connect(f.user1)
              .cInit(f.sdk.getInitParams(f.MOCK_PROOF_OUTPUT)),
          ).to.be.revertedWithCustomError(f.token, "AccountAlreadyInitialized")
        })

        it("Should revert if length in params.output mismatch", async function () {
          const proof = f.MOCK_PROOF_OUTPUT
          const params = f.sdk.getInitParams(proof)
          params.artifacts.outputs.pop()
          await expect(
            f.token.connect(f.user1).cInit(params),
          ).to.be.revertedWithCustomError(f.token, "InvalidArrayLength")
        })

        it("Should revert if proof length mismatch", async function () {
          const proof = f.MOCK_PROOF_OUTPUT
          const params = f.sdk.getInitParams(proof)
          params.artifacts.proof.pop()
          await expect(
            f.token.connect(f.user1).cInit(params),
          ).to.be.revertedWithCustomError(f.token, "InvalidArrayLength")
        })

        it("Should revert if required auditor is not found", async function () {
          await f.cInit("cold", f.user2)
          await f.token.connect(f.user1).addRequiredAuditor(f.user2.address)
          const params = f.sdk.getInitParams(f.MOCK_PROOF_OUTPUT)
          await expect(
            f.token.connect(f.user1).cInit(params),
          ).to.be.revertedWithCustomError(f.token, "NotFound")
        })
      })
    })
  })
})
