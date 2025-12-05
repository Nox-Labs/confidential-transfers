import { buildBabyjub, buildPoseidon } from "circomlibjs"

export class Utils {
  static async poseidon(inputs: bigint[]): Promise<bigint> {
    const poseidon = await buildPoseidon()
    return poseidon.F.toObject(poseidon(inputs))
  }

  static async generateCommitment(amount: bigint, bf: bigint): Promise<bigint> {
    return this.poseidon([amount, bf])
  }

  static async generateBlindingFactor(
    key: bigint,
    nonce: bigint
  ): Promise<bigint> {
    return this.poseidon([key, nonce])
  }

  static async decryptAmount(
    key: bigint,
    nonce: bigint,
    eAmount: bigint
  ): Promise<bigint> {
    const poseidon = await buildPoseidon()
    const F = poseidon.F

    const entropy = F.toObject(poseidon([nonce]))

    const keystream1 = poseidon([key, entropy])

    const plaintextAmount = F.sub(F.e(eAmount), keystream1)

    return F.toObject(plaintextAmount)
  }

  static async deriveSharedKey(
    recipientCPrivateKey: bigint,
    senderCPublicKey_X: bigint,
    senderCPublicKey_Y: bigint
  ): Promise<bigint> {
    const babyJub = await buildBabyjub()
    const sharedKeyPoint = babyJub.mulPointEscalar(
      [babyJub.F.e(senderCPublicKey_X), babyJub.F.e(senderCPublicKey_Y)],
      recipientCPrivateKey
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
      cPublicKey_X: babyJub.F.toObject(publicKeyPoint[0]) as bigint,
      cPublicKey_Y: babyJub.F.toObject(publicKeyPoint[1]) as bigint,
    }
  }
}
