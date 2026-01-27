import { ConfidentialTransfers } from "../artifacts/typechain/src/ConfidentialTransfers.js"
import { ConfidentialOFT } from "../artifacts/typechain/src/ConfidentialOFT.js"
import { ConfidentialTransfersBridgeable } from "../artifacts/typechain/src/ConfidentialTransfersBridgeable.js"
import { Proofs } from "./proofs.js"
import { SDKOptions } from "./types.js"

export class Token extends Proofs {
  constructor(
    readonly token:
      | ConfidentialTransfers
      | ConfidentialTransfersBridgeable
      | ConfidentialOFT,
    options: SDKOptions,
  ) {
    super(options)
  }

  /* MISC */

  async сBalanceOf(address: string, cPrivateKey: bigint): Promise<bigint> {
    const accountData = await this.token.getAccount(address)
    return await Proofs.decryptAmount(
      cPrivateKey,
      accountData.state.nonce,
      BigInt(accountData.state.eAmount),
    )
  }
}
