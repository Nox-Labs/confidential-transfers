import { buildBabyjub, buildPoseidon } from "circomlibjs"
import { ethers } from "ethers"
import { ConfidentialTransfers } from "../artifacts/typechain/src/ConfidentialTransfers"
import { confidentialTransfersAbi } from "../artifacts/abi/ConfidentialTransfers"
import { ConfidentialOFT } from "../artifacts/typechain/src/ConfidentialOFT"
import { confidentialOFTAbi } from "../artifacts/abi/ConfidentialOFT"
import { ConfidentialTransfersBridgeable } from "../artifacts/typechain/src/ConfidentialTransfersBridgeable"
import { confidentialTransfersBridgeableAbi } from "../artifacts/abi/ConfidentialTransfersBridgeable"

export class Utils {
  static async poseidon(inputs: bigint[]): Promise<bigint> {
    const poseidon = await buildPoseidon()
    return poseidon.F.toObject(poseidon(inputs))
  }

  static async generateCommitment(
    amount: bigint,
    otk: bigint,
  ): Promise<bigint> {
    return this.poseidon([amount, otk])
  }

  static async generateOTK(
    key: bigint,
    nonce: bigint,
    chainId: bigint,
    contractAddress: bigint,
  ): Promise<bigint> {
    return this.poseidon([key, nonce, chainId, contractAddress])
  }

  static async decryptAmount(
    key: bigint,
    nonce: bigint,
    eAmount: bigint,
    chainId: bigint,
    contractAddress: bigint,
  ): Promise<bigint> {
    const otk = await this.generateOTK(key, nonce, chainId, contractAddress)
    return await this.decipher(otk, nonce, eAmount)
  }

  static async deriveSharedKey(
    cPrivateKey: bigint,
    cPublicKeyX: bigint,
    cPublicKeyY: bigint,
  ): Promise<bigint> {
    const babyJub = await buildBabyjub()
    const sharedKeyPoint = babyJub.mulPointEscalar(
      [babyJub.F.e(cPublicKeyX), babyJub.F.e(cPublicKeyY)],
      cPrivateKey,
    )
    return babyJub.F.toObject(sharedKeyPoint[0])
  }

  static async deriveConfidentialKeys(entropy: bigint) {
    const babyJub = await buildBabyjub()
    const entropyHash = await this.poseidon([entropy])
    const cPrivateKey = entropyHash % babyJub.subOrder
    const publicKeyPoint = babyJub.mulPointEscalar(babyJub.Base8, cPrivateKey)
    return {
      cPrivateKey,
      cPublicKeyX: babyJub.F.toObject(publicKeyPoint[0]) as bigint,
      cPublicKeyY: babyJub.F.toObject(publicKeyPoint[1]) as bigint,
    }
  }

  static async cipher(
    key: bigint,
    nonce: bigint,
    plaintext: bigint,
  ): Promise<bigint> {
    const poseidon = await buildPoseidon()
    const keystream = poseidon([key, nonce])
    return poseidon.F.toObject(
      poseidon.F.add(poseidon.F.e(plaintext), keystream),
    )
  }

  static async decipher(
    key: bigint,
    nonce: bigint,
    ciphertext: bigint,
  ): Promise<bigint> {
    const poseidon = await buildPoseidon()
    const keystream = poseidon([key, nonce])
    return poseidon.F.toObject(
      poseidon.F.sub(poseidon.F.e(ciphertext), keystream),
    )
  }

  static getConfidentialTransfersInstance(
    tokenAddress: string,
    runner: ethers.ContractRunner,
  ): ConfidentialTransfers {
    return new ethers.Contract(
      tokenAddress,
      confidentialTransfersAbi,
      runner,
    ) as unknown as ConfidentialTransfers
  }

  static getConfidentialTransfersBridgeableInstance(
    tokenAddress: string,
    runner: ethers.ContractRunner,
  ): ConfidentialTransfersBridgeable {
    return new ethers.Contract(
      tokenAddress,
      confidentialTransfersBridgeableAbi,
      runner,
    ) as unknown as ConfidentialTransfersBridgeable
  }

  static getConfidentialOFTInstance(
    tokenAddress: string,
    runner: ethers.ContractRunner,
  ): ConfidentialOFT {
    return new ethers.Contract(
      tokenAddress,
      confidentialOFTAbi,
      runner,
    ) as unknown as ConfidentialOFT
  }
}
