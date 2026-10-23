import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateConversationDto {
  @IsUUID()
  contactId!: string;

  @IsOptional()
  @IsUUID()
  channelConnectionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  channel?: string;
}
