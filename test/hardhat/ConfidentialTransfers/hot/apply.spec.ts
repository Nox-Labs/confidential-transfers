import { baseSetup, conn } from "../../BaseSetup.js"
import { expect } from "chai"

describe("ConfidentialTransfers", function () {
  describe("Hot:ConfidentialTransfers", function () {
    describe("Hot:ConfidentialTransfers:cApply()", function () {
      it("Should apply the pending transfers", async function () {
        const {
          token,
          user1,
          user2,
          INITIAL_BALANCE,
          cDeposit,
          sdk,
          SDK,
          cTransfer,
        } = await conn.networkHelpers.loadFixture(baseSetup)

        await cDeposit("hot", user1, INITIAL_BALANCE)

        const transferAmount = conn.ethers.parseEther("10")

        await cTransfer("hot", user1, user2.address, transferAmount)

        const pendingTransfersIndexes = [0]

        const { cPrivateKey } = await SDK.deriveConfidentialKeys(
          BigInt(user2.privateKey),
        )
        const applyInputs = await sdk.getCircuitInputsForApply(
          user2.address,
          cPrivateKey,
          pendingTransfersIndexes,
        )

        const proofOutput = await sdk.generateApplyProof(applyInputs)

        const params = sdk.getApplyParams(pendingTransfersIndexes, proofOutput)

        await token.connect(user2).cApply(params)

        const decryptedAmount = await sdk.сBalanceOf(user2.address, cPrivateKey)
        expect(decryptedAmount).to.equal(transferAmount)

        const newCommitment = params.artifacts.outputs[0]
        const newEncryptedAmount = params.artifacts.outputs[1]

        const accountData = await token.getAccount(user2.address)
        expect(accountData.state.nonce).to.equal(1n)
        expect(accountData.state.commitment).to.equal(newCommitment)
        expect(accountData.state.eAmount).to.equal(newEncryptedAmount)
        expect(accountData.pendingTransfers.length).to.equal(0)
      }).timeout(50000)
    })
  })
})
