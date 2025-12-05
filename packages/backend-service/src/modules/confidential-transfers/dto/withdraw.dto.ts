import { IsNotEmpty, IsNumberString } from "class-validator"
import { CommonDto } from "./common.dto"

export class WithdrawDto extends CommonDto {
  @IsNumberString()
  @IsNotEmpty()
  amount: string
}
