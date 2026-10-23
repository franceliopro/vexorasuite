import { Body, Controller, ForbiddenException, Get, Put, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { AsaasService } from "./asaas.service";

@Controller("integrations/asaas")
@UseGuards(AuthGuard)
export class AsaasController {
  constructor(private readonly asaas: AsaasService) {}

  @Get()
  getSettings(@Req() request: AuthenticatedRequest) {
    return this.asaas.publicSettings(request.user.tenantId);
  }

  @Put()
  saveSettings(@Req() request: AuthenticatedRequest, @Body() input: { enabled?: unknown; sandbox?: unknown; apiKey?: unknown; webhookToken?: unknown }) {
    if (!["OWNER", "ADMIN"].includes(request.user.role)) throw new ForbiddenException("Somente o proprietário ou administrador pode configurar a integração financeira.");
    return this.asaas.saveSettings(request.user.tenantId, input);
  }
}
