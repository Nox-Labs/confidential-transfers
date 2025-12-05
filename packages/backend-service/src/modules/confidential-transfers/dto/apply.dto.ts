import { IsNotEmpty, IsArray, IsNumber } from "class-validator"
import { CommonDto } from "./common.dto"

export class ApplyDto extends CommonDto {
  @IsArray()
  @IsNotEmpty()
  @IsNumber({}, { each: true })
  pendingTransfersIndexes: number[]
}
