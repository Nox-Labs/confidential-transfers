import { baseSetup, conn } from "../../BaseSetup.js"
import { expect } from "chai"

describe("ConfidentialTransfers", function () {
  describe("Hot:ConfidentialTransfers", function () {
    describe("Hot:ConfidentialTransfers:cTransfer()", function () {
      it("Should transfer funds from user1 to user2", async function () {
        const { token, user1, user2, INITIAL_BALANCE, cDeposit, sdk, SDK } =
          await conn.networkHelpers.loadFixture(baseSetup)

        await cDeposit("hot", user1, INITIAL_BALANCE)

        const transferAmount = conn.ethers.parseEther("10")

        const { cPrivateKey } = await SDK.deriveConfidentialKeys(
          BigInt(user1.privateKey),
        )
        const proofOutput = await sdk.generateTransferProof(
          await sdk.getCircuitInputsForTransfer(
            user1.address,
            cPrivateKey,
            user2.address,
            transferAmount,
          ),
        )
        const params = sdk.getTransferParams(user2.address, proofOutput)

        await token.connect(user1).cTransfer(params)

        const senderBalance = await sdk.сBalanceOf(user1.address, cPrivateKey)
        expect(senderBalance).to.equal(INITIAL_BALANCE - transferAmount)

        const recipientAccountData = await token.getAccount(user2.address)
        expect(recipientAccountData.pendingTransfers.length).to.equal(1)
      })
    })
  })
})
