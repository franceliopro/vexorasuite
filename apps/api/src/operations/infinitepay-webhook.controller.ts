import { Body, Controller, Logger, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { InfinitePayService } from "./infinitepay.service";
import { EventsService } from "./events.service";
import { PrismaService } from "../prisma/prisma.service";
import { WahaService } from "./waha.service";
import { publishSettlement } from "./payment-notifications";

/**
 * Webhook da InfinitePay não tem assinatura: nenhum evento é aceito sem
 * confirmação posterior em /payment_check com valor original conferido.
 */
@Controller("webhooks/infinitepay")
export class InfinitePayWebhookController {
  private readonly logger = new Logger(InfinitePayWebhookController.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly infinitepay: InfinitePayService,
    private readonly events: EventsService,
    private readonly waha: WahaService,
  ) {}

  @Post(":tenantId")
  async receive(@Param("tenantId", ParseUUIDPipe) tenantId: string, @Body() body: unknown) {
    const result = await this.infinitepay.settleWebhook(tenantId, body);
    if (!result) return { ok: true, ignored: true, reason: "Aviso não confirmado pelo payment_check." };
    await publishSettlement(this.prisma, this.events, this.waha, tenantId, result, "InfinitePay", this.logger);
    return { ok: true };
  }
}
