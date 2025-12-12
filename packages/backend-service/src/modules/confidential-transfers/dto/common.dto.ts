import {
  IsString,
  IsNotEmpty,
  IsNumberString,
  IsArray,
  IsOptional,
} from "class-validator"

export class UserIdDto {
  @IsString()
  @IsNotEmpty()
  userId: string
}

export class CommonDto extends UserIdDto {
  @IsString()
  @IsNotEmpty()
  signature: string

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  auditors?: string[]
}
