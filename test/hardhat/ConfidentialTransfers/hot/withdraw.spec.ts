import { expect } from "chai"

import { baseSetup, conn } from "../../BaseSetup.js"

describe("ConfidentialTransfers", function () {
  describe("Hot:ConfidentialTransfers", function () {
    describe("Hot:ConfidentialTransfers:cWithdraw()", function () {
      it("Should withdraw the funds from the zk layer", async function () {
        const { token, user1, INITIAL_BALANCE, sdk, cDeposit, SDK } =
          await conn.networkHelpers.loadFixture(baseSetup)

        expect(await token.balanceOf(user1.address)).to.equal(INITIAL_BALANCE)

        const depositAmount = conn.ethers.parseEther("100")
        await cDeposit("hot", user1, depositAmount)

        const withdrawAmount = conn.ethers.parseEther("1")
        const { cPrivateKey } = await SDK.deriveConfidentialKeys(
          BigInt(user1.privateKey),
        )
        const proofOutput = await sdk.generateUpdateProof(
          await sdk.getCircuitInputsForWithdraw(
            user1.address,
            cPrivateKey,
            withdrawAmount,
          ),
        )
        const params = sdk.getWithdrawParams(proofOutput)
        await token.connect(user1).cWithdraw(params)

        const newCommitment = params.artifacts.outputs[0]
        const newEncryptedAmount = params.artifacts.outputs[1]

        const account = await token.getAccount(user1.address)

        const decryptedAmount = await sdk.сBalanceOf(user1.address, cPrivateKey)

        expect(account.state.nonce).to.equal(2n)
        expect(account.state.commitment).to.equal(newCommitment)
        expect(account.state.eAmount).to.equal(newEncryptedAmount)
        expect(decryptedAmount).to.equal(depositAmount - withdrawAmount)
        expect(await token.balanceOf(user1.address)).to.equal(
          INITIAL_BALANCE - depositAmount + withdrawAmount,
        )
        expect(await token.balanceOf(await token.getAddress())).to.equal(
          depositAmount - withdrawAmount,
        )
      })
    })
  })
})
