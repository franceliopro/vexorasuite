import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";
import { PASSWORD_MIN_LENGTH } from "../password-policy";

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  tenantName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(128)
  password!: string;
}
