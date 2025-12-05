import { Injectable } from "@nestjs/common"
import { UsersRepository } from "./users.repository"
import { ethers } from "ethers"
import { ConfidentialTransfersSDK } from "@noxlabs/confidential-transfers-sdk"

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async generateEntropyForUser(userId: string): Promise<string> {
    const existingEntropy = await this.getUserEntropy(userId)
    if (existingEntropy) return existingEntropy

    // This is only for demo purposes, in production we should generate random entropy

    const entropyString = ethers.hexlify(userId)

    await this.usersRepository.save({
      userId,
      entropy: entropyString,
    })

    return entropyString
  }

  async getUserEntropy(userId: string): Promise<string | null> {
    const user = await this.usersRepository.findByUserId(userId)
    return user ? user.entropy : null
  }
}
