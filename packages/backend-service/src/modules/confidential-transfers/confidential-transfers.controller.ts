import { Body, Controller, Post } from "@nestjs/common"
import { ConfidentialTransfersService } from "./confidential-transfers.service"
import { RegisterUserDto } from "./dto/register-user.dto"
import { InitAccountDto } from "./dto/init-account.dto"
import { DepositDto } from "./dto/deposit.dto"
import { TransferDto } from "./dto/transfer.dto"
import { WithdrawDto } from "./dto/withdraw.dto"
import { ApplyDto } from "./dto/apply.dto"
import { ApplyAndTransferDto } from "./dto/applyAndTransfer.dto"

@Controller("confidential-transfers")
export class ConfidentialTransfersController {
  constructor(private readonly service: ConfidentialTransfersService) {}

  @Post("register")
  async register(@Body() dto: RegisterUserDto) {
    return this.service.registerUser(dto.userId)
  }

  @Post("init")
  async init(@Body() dto: InitAccountDto) {
    return this.service.getInitParams(dto)
  }

  @Post("deposit")
  async deposit(@Body() dto: DepositDto) {
    return this.service.getDepositParams(dto)
  }

  @Post("transfer")
  async transfer(@Body() dto: TransferDto) {
    return this.service.getTransferParams(dto)
  }

  @Post("withdraw")
  async withdraw(@Body() dto: WithdrawDto) {
    return this.service.getWithdrawParams(dto)
  }

  @Post("apply")
  async apply(@Body() dto: ApplyDto) {
    return this.service.getApplyParams(dto)
  }

  @Post("applyAndTransfer")
  async applyAndTransfer(@Body() dto: ApplyAndTransferDto) {
    return this.service.getApplyAndTransferParams(dto)
  }
}
