import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class SendMessageDto {
  @IsOptional() @IsString() @MaxLength(4000)
  content?: string;
  @IsOptional() @IsIn(["text","image","video","audio","file","location","contact"])
  kind?: "text"|"image"|"video"|"audio"|"file"|"location"|"contact";
  @IsOptional() @IsString() @MaxLength(255) filename?: string;
  @IsOptional() @IsString() @MaxLength(120) mimetype?: string;
  @IsOptional() @IsString() @MaxLength(24000000) data?: string;
  @IsOptional() @IsString() @MaxLength(4000) caption?: string;
  @IsOptional() latitude?: number;
  @IsOptional() longitude?: number;
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @IsString() @MaxLength(5000) vcard?: string;
  @IsOptional() @IsString() @MaxLength(200) contactName?: string;
}
