import { IsEmail, IsISO8601, IsOptional, IsString, IsUUID, Matches, MaxLength } from "class-validator";

/** Captura unificada de inbound. Nenhum campo define tenant: ele vem sempre da sessão. */
export class CaptureInboundDto {
  @IsString()
  @Matches(/^[A-Za-z][A-Za-z0-9_-]{1,39}$/)
  provider!: string;

  /** Chave de idempotência fornecida pelo produtor do evento. */
  @IsString()
  @Matches(/^[A-Za-z0-9_.:-]{1,180}$/)
  externalEventId!: string;

  /** Identificador estável do contato no provedor de origem. */
  @IsString()
  @Matches(/^[A-Za-z0-9_.:@+-]{1,180}$/)
  externalContactId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  content?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z][A-Za-z0-9_-]{1,39}$/)
  channel?: string;

  @IsOptional()
  @IsUUID()
  channelConnectionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  campaignId?: string;

  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}
