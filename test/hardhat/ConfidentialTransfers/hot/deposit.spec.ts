import { expect } from "chai"
import { conn } from "../../BaseSetup.js"
import { baseSetup } from "../../BaseSetup.js"

describe("ConfidentialTransfers", function () {
  describe("Hot:ConfidentialTransfers", function () {
    describe("Hot:ConfidentialTransfers:cDeposit()", function () {
      it("Should deposit the funds to the zk layer", async function () {
        const { token, user1, INITIAL_BALANCE, sdk, SDK } =
          await conn.networkHelpers.loadFixture(baseSetup)

        expect(await token.balanceOf(user1.address)).to.equal(INITIAL_BALANCE)

        const depositAmount = conn.ethers.parseEther("1")

        const { cPrivateKey } = await SDK.deriveConfidentialKeys(
          BigInt(user1.privateKey),
        )
        const proofOutput = await sdk.generateUpdateProof(
          await sdk.getCircuitInputsForDeposit(
            user1.address,
            cPrivateKey,
            depositAmount,
          ),
        )
        const params = sdk.getDepositParams(proofOutput)

        await token.connect(user1).cDeposit(params)

        const newCommitment = params.artifacts.outputs[0]
        const newEncryptedAmount = params.artifacts.outputs[1]

        const account = await token.getAccount(user1.address)

        const decryptedAmount = await sdk.сBalanceOf(user1.address, cPrivateKey)

        expect(account.state.nonce).to.equal(1n)
        expect(account.state.commitment).to.equal(newCommitment)
        expect(account.state.eAmount).to.equal(newEncryptedAmount)
        expect(decryptedAmount).to.equal(depositAmount)
        expect(await token.balanceOf(user1.address)).to.equal(
          INITIAL_BALANCE - depositAmount,
        )
        expect(await token.balanceOf(await token.getAddress())).to.equal(
          depositAmount,
        )
      })
    })
  })
})
