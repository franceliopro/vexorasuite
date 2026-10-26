import { Controller, Get, Param, Req, UseGuards, ForbiddenException, Post, Patch, Delete, Body, BadRequestException } from "@nestjs/common";
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
  @Post(":contactId")
  async add(@Req() req: AuthenticatedRequest, @Param("contactId") contactId: string, @Body() body: { name?: string; phone?: string; relationship?: string; permissions?: string[] }) {
    if (!["OWNER", "ADMIN", "MANAGER"].includes(req.user.role)) throw new ForbiddenException("Permissão insuficiente");
    const name = body?.name?.trim();
    const phone = body?.phone?.trim();
    const relationship = body?.relationship?.trim();
    const permissions = body?.permissions;
    if (!name || name.length > 120 || !phone || !/^\+?[0-9]{10,15}$/.test(phone) || !relationship || relationship.length > 80 || !Array.isArray(permissions) || !permissions.length || permissions.some(p => !["finance.read", "finance.payment_link", "support.request"].includes(p))) throw new BadRequestException("Dados inválidos");
    const contact = await this.prisma.contact.findFirst({ where: { id: contactId, tenantId: req.user.tenantId }, select: { id: true } });
    if (!contact) throw new ForbiddenException("Contato indisponível");
    return this.prisma.$transaction(async tx => {
      const record = await tx.authorizedContact.create({ data: { tenantId: req.user.tenantId, contactId, name, phone, relationship, permissions, status: "PENDING" } });
      await tx.auditLog.create({ data: { tenantId: req.user.tenantId, userId: req.user.sub, action: "AUTHORIZED_CONTACT_CREATED", entityType: "AuthorizedContact", entityId: record.id, details: { contactId } } });
      return record;
    });
  }
  @Patch(":contactId/:id/revoke")
  async revoke(@Req() req: AuthenticatedRequest, @Param("contactId") contactId: string, @Param("id") id: string) {
    if (!["OWNER", "ADMIN", "MANAGER"].includes(req.user.role)) throw new ForbiddenException("Permissão insuficiente");
    return this.prisma.$transaction(async tx => {
      const result = await tx.authorizedContact.updateMany({ where: { id, contactId, tenantId: req.user.tenantId, status: { not: "REVOKED" } }, data: { status: "REVOKED", revokedAt: new Date() } });
      if (!result.count) throw new BadRequestException("Autorização não encontrada");
      await tx.auditLog.create({ data: { tenantId: req.user.tenantId, userId: req.user.sub, action: "AUTHORIZED_CONTACT_REVOKED", entityType: "AuthorizedContact", entityId: id, details: { contactId } } });
      return { revoked: true };
    });
  }

  @Patch(":contactId/:id")
  async edit(@Req() req: AuthenticatedRequest, @Param("contactId") contactId: string, @Param("id") id: string, @Body() body: { name?: string; phone?: string; relationship?: string; permissions?: string[] }) {
    if (!["OWNER", "ADMIN", "MANAGER"].includes(req.user.role)) throw new ForbiddenException("Permissão insuficiente");
    const name = body?.name?.trim(), phone = body?.phone?.trim(), relationship = body?.relationship?.trim(), permissions = body?.permissions;
    if (!name || name.length > 120 || !phone || !/^\+?[0-9]{10,15}$/.test(phone) || !relationship || relationship.length > 80 || !Array.isArray(permissions) || !permissions.length || permissions.some(p => !["finance.read", "finance.payment_link", "support.request"].includes(p))) throw new BadRequestException("Dados inválidos");
    return this.prisma.$transaction(async tx => {
      const updated = await tx.authorizedContact.updateMany({ where: { id, contactId, tenantId: req.user.tenantId, status: { not: "REVOKED" } }, data: { name, phone, relationship, permissions, status: "PENDING", verifiedAt: null, verifiedById: null } });
      if (!updated.count) throw new BadRequestException("Autorização não encontrada ou revogada");
      await tx.auditLog.create({ data: { tenantId: req.user.tenantId, userId: req.user.sub, action: "AUTHORIZED_CONTACT_EDITED", entityType: "AuthorizedContact", entityId: id, details: { contactId, status: "PENDING" } } });
      return { updated: true, requiresVerification: true };
    });
  }
  @Delete(":contactId/:id")
  async remove(@Req() req: AuthenticatedRequest, @Param("contactId") contactId: string, @Param("id") id: string) {
    if (!["OWNER", "ADMIN", "MANAGER"].includes(req.user.role)) throw new ForbiddenException("Permissão insuficiente");
    return this.prisma.$transaction(async tx => {
      const deleted = await tx.authorizedContact.deleteMany({ where: { id, contactId, tenantId: req.user.tenantId, status: "PENDING" } });
      if (!deleted.count) throw new BadRequestException("Somente cadastros pendentes podem ser excluídos; revogue autorizações ativas");
      await tx.auditLog.create({ data: { tenantId: req.user.tenantId, userId: req.user.sub, action: "AUTHORIZED_CONTACT_DELETED", entityType: "AuthorizedContact", entityId: id, details: { contactId } } });
      return { deleted: true };
    });
  }

}
