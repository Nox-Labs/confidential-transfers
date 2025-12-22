import { ConfidentialTransfers } from "../artifacts/typechain/src/ConfidentialTransfers.js"
import { Proofs } from "./proofs.js"
import { SDKOptions } from "./types.js"

export class Token extends Proofs {
  constructor(readonly token: ConfidentialTransfers, options: SDKOptions) {
    super(options)
  }

  /* MISC */

  async сBalanceOf(address: string, cPrivateKey: bigint): Promise<bigint> {
    const accountData = await this.token.getAccount(address)
    return await Proofs.decryptAmount(
      cPrivateKey,
      accountData.state.nonce,
      BigInt(accountData.state.eAmount)
    )
  }
}
