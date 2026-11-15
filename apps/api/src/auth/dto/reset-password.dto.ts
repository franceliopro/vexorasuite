import { IsString, MaxLength, MinLength } from "class-validator";
import { PASSWORD_MIN_LENGTH } from "../password-policy";

export class ResetPasswordDto {
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(128)
  password!: string;
}
