import { Body, Controller, ForbiddenException, Post, Req, UseGuards } from "@nestjs/common";
import { AuditCovered } from "../common/audit/audit.decorator";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { CaptureInboundDto } from "./dto/capture-inbound.dto";
import { InboundCaptureService } from "./inbound-capture.service";

/** Entrada unificada de leads/mensagens: sem tenant no corpo, sem chamada direta à IA. */
@AuditCovered()
@Controller("inbound")
@UseGuards(AuthGuard)
export class InboundCaptureController {
  constructor(private readonly service: InboundCaptureService) {}

  @Post("capture")
  async capture(@Req() req: AuthenticatedRequest, @Body() body: CaptureInboundDto) {
    if (!["OWNER", "ADMIN"].includes(req.user.role)) {
      throw new ForbiddenException("Captura de inbound restrita à administração.");
    }
    return this.service.capture(req.user.tenantId, req.user.sub, body);
  }
}
