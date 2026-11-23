import { Body, Controller, ForbiddenException, Get, Post, Put, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { StripeService } from "./stripe.service";

@Controller("integrations/stripe")
@UseGuards(AuthGuard)
export class StripeController {
  constructor(private readonly stripe: StripeService) {}

  private assertAdmin(request: AuthenticatedRequest, action: string) {
    if (!["OWNER", "ADMIN"].includes(request.user.role)) {
      throw new ForbiddenException(`Somente o proprietário ou administrador pode ${action} no Stripe.`);
    }
  }

  @Get()
  getSettings(@Req() request: AuthenticatedRequest) {
    return this.stripe.publicSettings(request.user.tenantId);
  }

  @Put()
  saveSettings(@Req() request: AuthenticatedRequest, @Body() input: {
    enabled?: unknown; environment?: unknown; publishableKey?: unknown;
    secretKey?: unknown; webhookSecret?: unknown;
  }) {
    this.assertAdmin(request, "configurar");
    return this.stripe.saveSettings(request.user.tenantId, input);
  }

  @Post("test-connection")
  testConnection(@Req() request: AuthenticatedRequest) {
    this.assertAdmin(request, "testar a conexão");
    return this.stripe.testConnection(request.user.tenantId);
  }

  @Post("hosted-checkout")
  createHostedCheckout(@Req() request: AuthenticatedRequest, @Body() input: { paymentId?: unknown }) {
    this.assertAdmin(request, "criar cobrança");
    return this.stripe.createHostedCheckout(request.user.tenantId, input);
  }

  @Post("checkout")
  createPayment(@Req() request: AuthenticatedRequest, @Body() input: { paymentId?: unknown; description?: unknown }) {
    this.assertAdmin(request, "criar cobrança");
    return this.stripe.createPayment(request.user.tenantId, input);
  }
}
