import { IsString, IsNotEmpty, IsNumberString } from "class-validator"
import { CommonDto } from "./common.dto"

export class TransferDto extends CommonDto {
  @IsString()
  @IsNotEmpty()
  to: string // Recipient Address

  @IsNumberString()
  @IsNotEmpty()
  amount: string
}
