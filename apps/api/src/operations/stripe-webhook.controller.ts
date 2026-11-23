import { Controller, Headers, Logger, Param, ParseUUIDPipe, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { StripeService } from "./stripe.service";
import { EventsService } from "./events.service";
import { PrismaService } from "../prisma/prisma.service";
import { WahaService } from "./waha.service";
import { publishSettlement } from "./payment-notifications";

type RawRequest = Request & { rawBody?: Buffer };

@Controller("webhooks/stripe")
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly events: EventsService,
    private readonly waha: WahaService,
  ) {}

  @Post(":tenantId")
  async receive(
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Headers("stripe-signature") signature: string | undefined,
    @Req() request: RawRequest,
  ) {
    const raw = request.rawBody;
    if (!raw || raw.length === 0) {
      this.logger.warn("Webhook Stripe recusado: corpo cru indisponível.");
      return { ok: false, ignored: true };
    }
    const event = await this.stripe.verifyWebhook(tenantId, raw, signature);
    const result = await this.stripe.settleWebhook(tenantId, event);
    if (!result) return { ok: true, ignored: true };
    await publishSettlement(this.prisma, this.events, this.waha, tenantId, result, "Stripe", this.logger);
    return { ok: true };
  }
}
