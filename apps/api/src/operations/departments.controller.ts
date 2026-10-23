import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Patch, Post, Put, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

const DEFAULT_DEPARTMENTS = [
  { key: "FINANCEIRO", name: "Financeiro", keywords: ["boleto", "pagamento", "fatura", "nota fiscal", "reembolso", "cobrança"] },
  { key: "COMERCIAL", name: "Comercial (Vendas)", keywords: ["preço", "preco", "orçamento", "orcamento", "comprar", "venda", "plano"] },
  { key: "SUPORTE", name: "Suporte", keywords: ["problema", "erro", "ajuda", "suporte", "não funciona", "nao funciona"] },
  { key: "ADMINISTRATIVO", name: "Administrativo", keywords: ["documento", "contrato", "cadastro", "administrativo"] },
];

@Controller("departments")
@UseGuards(AuthGuard)
export class DepartmentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    const tenantId = request.user.tenantId;
    for (const department of DEFAULT_DEPARTMENTS) {
      await this.prisma.department.upsert({
        where: { tenantId_key: { tenantId, key: department.key } },
        create: { tenantId, ...department },
        update: {},
      });
    }
    return this.prisma.department.findMany({
      where: { tenantId },
      select: { id: true, key: true, name: true, keywords: true, isActive: true },
      orderBy: { name: "asc" },
    });
  }

  @Patch(":id")
  async update(
    @Req() request: AuthenticatedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: { isActive?: unknown; name?: unknown; keywords?: unknown },
  ) {
    const department = await this.prisma.department.findFirst({ where: { id, tenantId: request.user.tenantId }, select: { id: true } });
    if (!department) throw new BadRequestException("Departamento não encontrado nesta empresa.");
    const data: { isActive?: boolean; name?: string; keywords?: string[] } = {};
    if (typeof input.isActive === "boolean") data.isActive = input.isActive;
    if (typeof input.name === "string" && input.name.trim()) data.name = input.name.trim().slice(0, 80);
    if (Array.isArray(input.keywords)) data.keywords = input.keywords.filter((value): value is string => typeof value === "string").map((value) => value.trim().slice(0, 60)).filter(Boolean).slice(0, 50);
    return this.prisma.department.update({ where: { id }, data });
  }

  @Get(":id/members")
  async members(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string) {
    const department = await this.prisma.department.findFirst({ where: { id, tenantId: request.user.tenantId }, select: { id: true } });
    if (!department) throw new BadRequestException("Departamento não encontrado nesta empresa.");
    const rows = await this.prisma.departmentMember.findMany({ where: { tenantId: request.user.tenantId, departmentId: id }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { user: { name: "asc" } } });
    return rows.map((row) => row.user);
  }

  @Put(":id/members")
  async setMembers(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Body("userIds") userIds: unknown) {
    if (!["OWNER", "ADMIN", "MANAGER"].includes(request.user.role)) throw new ForbiddenException("Somente gestores podem alterar os membros de uma equipe.");
    const department = await this.prisma.department.findFirst({ where: { id, tenantId: request.user.tenantId }, select: { id: true } });
    if (!department) throw new BadRequestException("Departamento não encontrado nesta empresa.");
    if (!Array.isArray(userIds) || userIds.some((value) => typeof value !== "string")) throw new BadRequestException("Informe a lista de atendentes da equipe.");
    const ids = [...new Set(userIds as string[])];
    if (ids.length > 200) throw new BadRequestException("A equipe ultrapassa o limite de atendentes.");
    const members = ids.length ? await this.prisma.membership.findMany({ where: { tenantId: request.user.tenantId, userId: { in: ids }, user: { isActive: true } }, select: { userId: true } }) : [];
    if (members.length !== ids.length) throw new BadRequestException("Um ou mais atendentes não pertencem a esta empresa.");
    await this.prisma.$transaction([
      this.prisma.departmentMember.deleteMany({ where: { tenantId: request.user.tenantId, departmentId: id } }),
      ...(ids.length ? [this.prisma.departmentMember.createMany({ data: ids.map((userId) => ({ tenantId: request.user.tenantId, departmentId: id, userId })) })] : []),
    ]);
    return this.members(request, id);
  }

  @Post()
  async create(@Req() request: AuthenticatedRequest, @Body() input: { name?: unknown; key?: unknown; keywords?: unknown }) {
    const name = typeof input.name === "string" ? input.name.trim().slice(0, 80) : "";
    const key = typeof input.key === "string" ? input.key.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "_").slice(0, 40) : "";
    const keywords = Array.isArray(input.keywords) ? input.keywords.filter((value): value is string => typeof value === "string").map((value) => value.trim().slice(0, 60)).filter(Boolean).slice(0, 50) : [];
    if (!name || !key) throw new BadRequestException("Informe o nome e a chave do departamento.");
    return this.prisma.department.create({ data: { tenantId: request.user.tenantId, name, key, keywords } });
  }
}
