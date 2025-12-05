import { Injectable } from "@nestjs/common"

export interface UserEntity {
  userId: string // e.g. Ethereum Address
  entropy: string // Hex string of random bytes
}

@Injectable()
export class UsersRepository {
  // Mock DB
  private readonly users: Map<string, UserEntity> = new Map()

  async save(user: UserEntity): Promise<void> {
    this.users.set(user.userId.toLowerCase(), user)
  }

  async findByUserId(userId: string): Promise<UserEntity | undefined> {
    return this.users.get(userId.toLowerCase())
  }
}
