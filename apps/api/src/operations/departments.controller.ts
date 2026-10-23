import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from "@nestjs/common";
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
      where: { tenantId, isActive: true },
      select: { id: true, key: true, name: true, keywords: true, isActive: true },
      orderBy: { name: "asc" },
    });
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
