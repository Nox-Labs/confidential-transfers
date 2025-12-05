import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsNumberString,
  IsString,
} from "class-validator"
import { CommonDto } from "./common.dto"

export class ApplyAndTransferDto extends CommonDto {
  @IsArray()
  @IsNotEmpty()
  @IsNumber({}, { each: true })
  pendingTransfersIndexes: number[]

  @IsString()
  @IsNotEmpty()
  to: string // Recipient Address

  @IsNumberString()
  @IsNotEmpty()
  amount: string
}
