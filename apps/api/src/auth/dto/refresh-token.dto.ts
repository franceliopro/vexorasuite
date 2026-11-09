import { IsString, MaxLength, MinLength } from "class-validator";

/** A 32-byte base64url secret; anything shorter was not issued by this API. */
export class RefreshTokenDto {
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  refreshToken!: string;
}
