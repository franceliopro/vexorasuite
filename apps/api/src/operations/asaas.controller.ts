import { Body, Controller, ForbiddenException, Get, Post, Put, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { AsaasService } from "./asaas.service";

@Controller("integrations/asaas")
@UseGuards(AuthGuard)
export class AsaasController {
  constructor(private readonly asaas: AsaasService) {}

  @Post("test-connection")
  async testConnection(@Req() request: AuthenticatedRequest) {
    if (!["OWNER", "ADMIN"].includes(request.user.role)) throw new ForbiddenException("Somente o proprietário ou administrador pode testar a conexão Asaas.");
    return this.asaas.testConnection(request.user.tenantId);
  }

  @Post("customers/sync")
  async syncCustomers(@Req() request: AuthenticatedRequest) {
    if (!["OWNER", "ADMIN"].includes(request.user.role)) throw new ForbiddenException("Somente o proprietário ou administrador pode sincronizar clientes do Asaas.");
    return this.asaas.syncCustomers(request.user.tenantId);
  }

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
