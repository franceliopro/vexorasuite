import { IsEmail, IsString, MaxLength } from "class-validator";

export class ForgotPasswordDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  /** Optional: the company identifier narrows the lookup when the e-mail exists in more than one. */
  @IsString()
  @MaxLength(80)
  tenantSlug?: string;
}
