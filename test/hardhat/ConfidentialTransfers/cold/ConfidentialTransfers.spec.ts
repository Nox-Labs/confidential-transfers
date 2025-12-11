import { expect } from "chai"
import { conn, baseSetup } from "../../BaseSetup.js"

describe("ConfidentialTransfers/cold", function () {
  let f: Awaited<ReturnType<typeof baseSetup>>

  beforeEach(async function () {
    f = await conn.networkHelpers.loadFixture(baseSetup)
  })

  it("Should able to recover state from on-chain data", async function () {
    const { cPrivateKey } =
      await f.ConfidentialTransfersSDK.deriveConfidentialKeys(
        BigInt(f.user1.privateKey)
      )

    const account = await f.token.getAccount(f.user1.address)

    const amount = await f.ConfidentialTransfersSDK.decryptAmount(
      cPrivateKey,
      account.state.nonce,
      account.state.eAmount
    )
    const otk = await f.ConfidentialTransfersSDK.generateOTK(
      cPrivateKey,
      account.state.nonce
    )
    const commitment = await f.ConfidentialTransfersSDK.generateCommitment(
      amount,
      otk
    )

    expect(amount).to.equal(0n)
    expect(commitment).to.equal(BigInt(account.state.commitment))
  })
})
