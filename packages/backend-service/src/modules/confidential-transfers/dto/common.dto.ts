import { IsString, IsNotEmpty, IsNumberString } from "class-validator"

export class UserIdDto {
  @IsString()
  @IsNotEmpty()
  userId: string
}

export class CommonDto extends UserIdDto {
  @IsString()
  @IsNotEmpty()
  signature: string
}
