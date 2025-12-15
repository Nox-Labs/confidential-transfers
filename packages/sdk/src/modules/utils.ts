import { buildBabyjub, buildPoseidon } from "circomlibjs"

export class Utils {
  static async poseidon(inputs: bigint[]): Promise<bigint> {
    const poseidon = await buildPoseidon()
    return poseidon.F.toObject(poseidon(inputs))
  }

  static async generateCommitment(
    amount: bigint,
    otk: bigint
  ): Promise<bigint> {
    return this.poseidon([amount, otk])
  }

  static async generateOTK(key: bigint, nonce: bigint): Promise<bigint> {
    return this.poseidon([key, nonce])
  }

  static async generateTransferOTK(
    cPrivateKey: bigint,
    nonce: bigint,
    cPublicKey_X: bigint,
    cPublicKey_Y: bigint
  ): Promise<bigint> {
    const sharedKey = await this.deriveSharedKey(
      cPrivateKey,
      cPublicKey_X,
      cPublicKey_Y
    )
    return this.generateOTK(sharedKey, nonce)
  }

  static async decryptAmount(
    key: bigint,
    nonce: bigint,
    eAmount: bigint
  ): Promise<bigint> {
    const otk = await this.generateOTK(key, nonce)
    return await this.decipher(otk, nonce, eAmount)
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

  static async cipher(
    key: bigint,
    nonce: bigint,
    plaintext: bigint
  ): Promise<bigint> {
    const poseidon = await buildPoseidon()
    const keystream = poseidon([key, nonce])
    return poseidon.F.toObject(
      poseidon.F.add(poseidon.F.e(plaintext), keystream)
    )
  }

  static async decipher(
    key: bigint,
    nonce: bigint,
    ciphertext: bigint
  ): Promise<bigint> {
    const poseidon = await buildPoseidon()
    const keystream = poseidon([key, nonce])
    return poseidon.F.toObject(
      poseidon.F.sub(poseidon.F.e(ciphertext), keystream)
    )
  }
}
