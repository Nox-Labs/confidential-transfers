import { expect } from "chai"

import { conn, baseSetupBridgeable } from "../../BaseSetup.js"
import {
  type ProofOutput,
  type PendingTransfer,
} from "@noxlabs/confidential-transfers-sdk"
import { type MockConfidentialTransfersBridgeable } from "../../../../out/hardhat/typechain/test/utils/mock/MockConfidentialTransfersBridgeable.js"
import { type cClaimParams } from "@noxlabs/confidential-transfers-sdk"
describe("ConfidentialTransfersBridgeable", function () {
  describe("Cold:ConfidentialTransfersBridgeable", function () {
    describe("Cold:ConfidentialTransfersBridgeable:cClaim()", function () {
      let f: Awaited<ReturnType<typeof baseSetupBridgeable>>

      let pt: PendingTransfer
      let params: cClaimParams
      let proof: ProofOutput

      beforeEach(async function () {
        f = await conn.networkHelpers.loadFixture(baseSetupBridgeable)

        await f.cDeposit("cold", f.user1, f.DEPOSIT_AMOUNT)
        await f.cTransfer("cold", f.user1, f.user2.address, f.TRANSFER_AMOUNT)

        const nonce = await f.getNonce(f.user1)

        const transferFilename = f.getFilename(
          "transfer",
          f.user1.index,
          nonce - 1n,
          f.TRANSFER_AMOUNT,
        )

        const transferProof = f.getProofOutput(transferFilename)

        pt = {
          sender: f.user1.address,
          payload: {
            nonce: nonce,
            commitment: transferProof.pubSignals[2],
            eAmount: transferProof.pubSignals[3],
          },
          auditReports: [],
        }

        const recipientAccount = await f.token.getAccount(f.user2.address)

        await (f.token as unknown as MockConfidentialTransfersBridgeable)
          .connect(f.user2)
          .addFailedCrossChainTransfer(
            recipientAccount.pubKeyX,
            recipientAccount.pubKeyY,
            pt,
          )

        expect(
          (await f.token.getFailedCrossChainTransfers(f.user1.address)).length,
        ).to.equal(1)

        const filename = f.getFilename(
          "claim",
          f.user1.index,
          await f.getNonce(f.user1),
        )
        proof = f.getProofOutput(filename)
        params = f.sdk.getClaimParams(0, proof)
      })

      describe("State Changes", function () {
        it("Should update sender's state", async function () {
          await f.token.connect(f.user1).cClaim(params)
          const account = await f.token.getAccount(f.user1.address)
          expect(account.state.commitment).to.equal(proof.pubSignals[0])
          expect(account.state.eAmount).to.equal(proof.pubSignals[1])
        })

        it("Should remove failed cross-chain transfer", async function () {
          await f.token.connect(f.user1).cClaim(params)
          expect(
            await f.token.getFailedCrossChainTransfers(f.user1.address),
          ).to.have.length(0)
        })

        it("Should emit event", async function () {
          await expect(f.token.connect(f.user1).cClaim(params)).to.emit(
            f.token,
            "CFailedTransferClaimed",
          )
        })
      })

      describe("Reverts", function () {
        it("Should revert if the proof verification fails", async function () {
          params.artifacts.proof[0] = BigInt(params.artifacts.proof[0]) + 1n
          await expect(
            f.token.connect(f.user1).cClaim(params),
          ).to.be.revertedWithCustomError(f.token, "ProofVerificationFailed")
        })

        it("Should revert if length in params.output mismatch", async function () {
          params.artifacts.outputs.pop()
          await expect(
            f.token.connect(f.user1).cClaim(params),
          ).to.be.revertedWithCustomError(f.token, "InvalidArrayLength")
        })

        it("Should revert if required auditor is not found", async function () {
          await f.token.connect(f.user1).addRequiredAuditor(f.user2.address)
          await expect(
            f.token.connect(f.user1).cClaim(params),
          ).to.be.revertedWithCustomError(f.token, "NotFound")
        })
      })
    })
  })
})
