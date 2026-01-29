import { ConfidentialTransfers } from "../artifacts/typechain/src/ConfidentialTransfers.js"
import { ConfidentialOFT } from "../artifacts/typechain/src/ConfidentialOFT.js"
import { ConfidentialTransfersBridgeable } from "../artifacts/typechain/src/ConfidentialTransfersBridgeable.js"
import { Proofs } from "./proofs.js"
import { SDKOptions, Target } from "./types.js"

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
    return await this.decryptAmount(
      cPrivateKey,
      accountData.state.nonce,
      BigInt(accountData.state.eAmount),
    )
  }

  async generateOTK(key: bigint, nonce: bigint): Promise<bigint> {
    const { chainId, contractAddress } = await this.getTarget()
    return await Proofs.generateOTK(key, nonce, chainId, contractAddress)
  }

  async decryptAmount(
    key: bigint,
    nonce: bigint,
    eAmount: bigint,
  ): Promise<bigint> {
    const { chainId, contractAddress } = await this.getTarget()
    return await Proofs.decryptAmount(
      key,
      nonce,
      eAmount,
      chainId,
      contractAddress,
    )
  }

  async getTarget(): Promise<Target> {
    const network = await this.token.runner?.provider?.getNetwork()
    if (!network) throw new Error("Network not found")
    return {
      chainId: BigInt(network.chainId),
      contractAddress: BigInt(await this.token.getAddress()),
    }
  }
}
