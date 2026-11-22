import { BadRequestException, Body, Controller, ForbiddenException, HttpException, NotFoundException, Param, ParseUUIDPipe, Post, Req, ServiceUnavailableException, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { providerApiKey } from "../ai/provider-credentials";
import { dailyAiLimit, reserveAiExecution } from "./ai-budget";
import { Prisma } from "../generated/prisma/client";
import sharp from "sharp";
import { randomBytes } from "node:crypto";

const MAX_PROMPT = 600;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB decoded — OpenRouter answers are well under this.

type GenerateInput = { colIndex?: unknown; elIndex?: unknown; prompt?: unknown };

/**
 * Gera uma imagem a partir de um prompt, usando a chave OpenRouter da PRÓPRIA empresa
 * (criptografada por tenant em Agentes de IA, ou a chave compartilhada do servidor).
 * A imagem nasce em site_assets e é aplicada ao elemento `image` do bloco layout.
 */
@Controller("sites")
export class ImageGenerationController {
  constructor(private readonly prisma: PrismaService) {}

  @Post(":siteId/blocks/:blockId/ai-image")
  @UseGuards(AuthGuard)
  async generateImage(@Param("siteId", ParseUUIDPipe) siteId: string, @Param("blockId", ParseUUIDPipe) blockId: string, @Body() input: GenerateInput, @Req() request: AuthenticatedRequest) {
    const tenantId = request.user.tenantId;
    if (!["OWNER", "ADMIN", "MANAGER"].includes(request.user.role)) throw new ForbiddenException("Somente gestão pode gerar imagens.");
    const colIndex = Number.isInteger(input.colIndex) && Number(input.colIndex) >= 0 ? Number(input.colIndex) : -1;
    const elIndex = Number.isInteger(input.elIndex) && Number(input.elIndex) >= 0 ? Number(input.elIndex) : -1;
    const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
    if (colIndex < 0 || elIndex < 0) throw new BadRequestException("Elemento de destino inválido (coluna/elemento).");
    if (prompt.length < 3) throw new BadRequestException("Descreva o que a imagem deve mostrar (mínimo 3 caracteres).");
    if (prompt.length > MAX_PROMPT) throw new BadRequestException(`O pedido tem mais de ${MAX_PROMPT} caracteres.`);

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { integrations: true } });
    const integrations = tenant?.integrations && typeof tenant.integrations === "object" && !Array.isArray(tenant.integrations) ? tenant.integrations as Record<string, unknown> : {};
    const assistant = integrations.assistant && typeof integrations.assistant === "object" ? integrations.assistant as Record<string, unknown> : {};
    const dailyLimit = dailyAiLimit(assistant.dailyAiLimit);

    const result = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM sites WHERE id = ${siteId}::uuid AND tenant_id = ${tenantId}::uuid FOR UPDATE`;
      const site = await tx.site.findFirst({ where: { id: siteId, tenantId }, include: { pages: { include: { blocks: { orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } } } });
      if (!site) throw new NotFoundException("Site não encontrado nesta empresa.");
      let targetBlock: (typeof site.pages)[number]["blocks"][number] | null = null;
      for (const page of site.pages) for (const block of page.blocks) if (block.id === blockId) { targetBlock = block; break; }
      if (!targetBlock) throw new NotFoundException("Bloco não encontrado neste site.");
      if (targetBlock.type !== "layout") throw new BadRequestException("A geração de imagem funciona em blocos de layout (colunas e elementos).");
      const content = targetBlock.content as Record<string, unknown>;
      const columns = Array.isArray(content.columns) ? content.columns : [];
      const column = columns[colIndex] as Record<string, unknown> | undefined;
      const elements = column && Array.isArray(column.elements) ? column.elements : [];
      const element = elements[elIndex] as Record<string, unknown> | undefined;
      if (!column || !element) throw new BadRequestException("Coluna ou elemento inexistente.");
      if (element.type !== "image") throw new BadRequestException("Esse elemento não é uma imagem.");

      await reserveAiExecution(tx, tenantId, dailyLimit, "site.image.generate", request.user.sub);

      const model = process.env.OPENROUTER_IMAGE_MODEL?.trim() || "google/gemini-2.5-flash-image";
      let key: string | undefined;
      try { key = providerApiKey("openrouter", integrations, tenantId); } catch { key = undefined; }
      if (!key) throw new BadRequestException("Cadastre a chave OpenRouter desta empresa em Agentes de IA (chave da empresa). Opcionalmente o servidor pode ter uma chave compartilhada.");

      const response = await fetch("https://openrouter.ai/api/v1/images", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
        body: JSON.stringify({ model, prompt }),
        signal: AbortSignal.timeout(180_000),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        if (response.status === 401 || response.status === 403) throw new HttpException("A chave OpenRouter desta empresa foi recusada — confira-a em Agentes de IA.", 502);
        if (response.status === 402) throw new HttpException("Sem crédito no OpenRouter desta empresa.", 502);
        if (response.status === 404) throw new HttpException("O modelo de imagem configurado não está disponível (" + model + "). Configure OPENROUTER_IMAGE_MODEL no servidor.", 502);
        if (response.status === 429) throw new HttpException("Limite atingido no OpenRouter. Tente daqui a pouco ou ajuste o plano da conta.", 502);
        throw new HttpException("O estúdio de imagens não respondeu (" + response.status + "). Tente novamente." + (detail ? " " + detail.slice(0, 140) : ""), 502);
      }
      const raw = await response.json().catch(() => ({})) as { data?: Array<{ b64_json?: string }>; error?: { message?: string } };
      const b64 = raw?.data?.[0]?.b64_json;
      if (typeof b64 !== "string" || !b64) {
        const message = typeof raw?.error?.message === "string" ? raw.error.message : "o OpenRouter não devolveu uma imagem.";
        throw new HttpException("Não foi possível gerar a imagem: " + message.slice(0, 200), 502);
      }
      const bytes = Buffer.from(b64, "base64");
      if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new ServiceUnavailableException("Imagem inválida ou acima do limite de 8 MB.");
      const normalized = await sharp(bytes, { failOn: "none" }).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });

      const name = "ia-" + (prompt.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "imagem") + "-" + randomBytes(4).toString("hex") + ".webp";
      const folder = "/ia/geradas";
      await tx.siteFolder.upsert({ where: { tenantId_path: { tenantId, path: folder } }, create: { tenantId, path: folder }, update: {} });
      const asset = await tx.siteAsset.create({ data: { tenantId, name, kind: "image", folder, mimeType: "image/webp", width: normalized.info.width, height: normalized.info.height, bytes: new Uint8Array(normalized.data) }, select: { id: true } });
      const url = "/api/backend/public/site-assets/" + asset.id;

      elements[elIndex] = { ...element, url, alt: typeof element.alt === "string" && element.alt.trim() ? element.alt : prompt.slice(0, 120) };
      const nextContent = { ...content, columns: columns.map((c, i) => i === colIndex ? { ...(c as Record<string, unknown>), elements } : c) } as unknown as Prisma.InputJsonValue;
      await tx.siteBlock.update({ where: { id: targetBlock.id }, data: { content: nextContent } });
      await tx.auditLog.create({ data: { tenantId, userId: request.user.sub, action: "site.image.generated", entityType: "siteBlock", entityId: targetBlock.id, details: { blockId, colIndex, elIndex, model, assetId: asset.id, promptChars: prompt.length } } });
      return { url, assetId: asset.id };
    }, { timeout: 200_000 });

    return result;
  }
}
