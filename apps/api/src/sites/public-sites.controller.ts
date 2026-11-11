import { BadRequestException, Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post, Req } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Public } from "../auth/auth.guard";
/** Renderizador público do site (sem autenticação) — é o que o visitante abre no domínio/slug. */
@Controller("public/sites")
export class PublicSitesController {
  constructor(private readonly prisma: PrismaService) {}
  @Get(":slug")
  async render(@Param("slug") slug: string) {
    const site = await this.prisma.site.findFirst({
      where: { slug: String(slug || "").toLowerCase().slice(0, 80), published: true },
      include: { pages: { where: { hidden: false }, include: { blocks: { where: { hidden: false }, orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } }, forms: { where: { isActive: true } }, items: { where: { published: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] } },
    });
    if (!site) throw new NotFoundException("Este site não existe ou não está publicado.");
    const tenant = await this.prisma.tenant.findUnique({ where: { id: site.tenantId }, select: { name: true } });
    return { site: { ...site, tenantName: tenant?.name || "Empresa" }, tenantName: tenant?.name || "Empresa" };
  }
  @Get(":slug/host")
  async byHost(@Param("slug") host: string, @Req() req: any) {
    const value = String((req?.headers?.["x-forwarded-host"] || req?.headers?.host || host || "")).toLowerCase().slice(0, 120);
    const site = await this.prisma.site.findFirst({
      where: { domain: { startsWith: value.replace(/:\d+$/, "") }, published: true },
      include: { pages: { where: { hidden: false }, include: { blocks: { where: { hidden: false }, orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } }, forms: { where: { isActive: true } }, items: { where: { published: true } } },
    });
    if (!site) throw new NotFoundException("Nenhuma rota ativa para este domínio.");
    return site;
  }
  @Post(":slug/forms/:formId")
  async submit(@Param("slug") slug: string, @Param("formId", ParseUUIDPipe) formId: string, @Body() body: any) {
    const site = await this.prisma.site.findFirst({ where: { slug: String(slug || "").toLowerCase().slice(0, 80), published: true }, select: { id: true } });
    if (!site) throw new NotFoundException("Site não publicado.");
    const form = await this.prisma.siteForm.findFirst({ where: { id: formId, siteId: site.id, isActive: true } });
    if (!form) throw new NotFoundException("Formulário indisponível.");
    const values: Record<string, unknown> = {};
    for (const field of (form.fields as Array<{ id: string }>)) {
      const raw = body?.[field.id];
      values[field.id] = typeof raw === "string" ? raw.trim().slice(0, 1000) : raw;
    }
    await this.prisma.siteFormSubmission.create({ data: { formId: form.id, siteId: site.id, pageSlug: typeof body?.page === "string" ? body.page.slice(0, 80) : "", values: values as any } });
    return { received: true };
  }
}
