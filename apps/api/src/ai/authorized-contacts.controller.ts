import { Controller, Get, Param, Req, UseGuards, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";

@Controller("assistant/authorized-contacts")
@UseGuards(AuthGuard)
export class AuthorizedContactsController {
  constructor(private readonly prisma: PrismaService) {}
  @Get(":contactId")
  async list(@Req() req: AuthenticatedRequest, @Param("contactId") contactId: string) {
    if (!["OWNER", "ADMIN", "MANAGER"].includes(req.user.role)) throw new ForbiddenException("Permissão insuficiente");
    const contact = await this.prisma.contact.findFirst({ where: { id: contactId, tenantId: req.user.tenantId }, select: { id: true } });
    if (!contact) throw new ForbiddenException("Contato indisponível");
    return this.prisma.authorizedContact.findMany({ where: { tenantId: req.user.tenantId, contactId }, orderBy: { createdAt: "desc" } });
  }
}
