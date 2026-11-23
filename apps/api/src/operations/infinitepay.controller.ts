import { Body, Controller, ForbiddenException, Get, Post, Put, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { InfinitePayService } from "./infinitepay.service";

@Controller("integrations/infinitepay")
@UseGuards(AuthGuard)
export class InfinitePayController {
  constructor(private readonly infinitepay: InfinitePayService) {}

  private assertAdmin(request: AuthenticatedRequest, action: string) {
    if (!["OWNER", "ADMIN"].includes(request.user.role)) {
      throw new ForbiddenException(`Somente o proprietário ou administrador pode ${action} na InfinitePay.`);
    }
  }

  @Get()
  getSettings(@Req() request: AuthenticatedRequest) {
    return this.infinitepay.publicSettings(request.user.tenantId);
  }

  @Put()
  saveSettings(@Req() request: AuthenticatedRequest, @Body() input: { enabled?: unknown; handle?: unknown; apiKey?: unknown }) {
    this.assertAdmin(request, "configurar");
    return this.infinitepay.saveSettings(request.user.tenantId, input);
  }

  @Post("test-connection")
  testConnection(@Req() request: AuthenticatedRequest) {
    this.assertAdmin(request, "verificar a configuração");
    return this.infinitepay.testConnection(request.user.tenantId);
  }

  @Post("checkout")
  createLink(@Req() request: AuthenticatedRequest, @Body() input: {
    paymentId?: unknown; description?: unknown; customerName?: unknown;
    customerEmail?: unknown; redirectUrl?: unknown;
  }) {
    this.assertAdmin(request, "criar link de pagamento");
    return this.infinitepay.createLink(request.user.tenantId, input);
  }
}
