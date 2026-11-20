/** Importação de sites: converte HTML/URL/ZIP em SiteDocument e cria o site na empresa. */
import { BadRequestException, Injectable } from "@nestjs/common";
import AdmZip from "adm-zip";
import { SitesService } from "../sites/sites.service";
import {
  elementorConversion,
  htmlToDocument,
  type ConversionResult,
  type ImportedKind,
} from "./html-to-document";
import { fetchPublicHtml } from "./safe-fetch";

const MAX_ZIP_BASE64 = 20_000_000;
const MAX_ENTRIES = 300;
const MAX_ENTRY_BYTES = 3_000_000;
const TEXT_FILE = /\.(html?|css|js|json|txt|svg)$/i;

type ImportInput = {
  name?: unknown;
  kind?: unknown;
};

function normalizeKind(value: unknown): ImportedKind {
  const raw = String(value ?? "static").trim().toLowerCase().replace(/-/g, "_");
  if (["blog", "real_estate", "ecommerce"].includes(raw)) return raw.replace("_", "-") as ImportedKind;
  return "static";
}

function siteKindOf(kind: ImportedKind): string {
  return kind.replace(/-/g, "_").toUpperCase();
}

function documentName(result: ConversionResult, input: ImportInput): string {
  const requested = typeof input.name === "string" ? input.name.trim() : "";
  const title = result.document.meta.title;
  return (requested || title || "Site importado").slice(0, 100);
}

@Injectable()
export class SitesImportService {
  constructor(private readonly sites: SitesService) {}

  async fromUrl(
    input: ImportInput & { url?: unknown },
    tenantId: string,
    role: string,
  ) {
    const { html, url } = await fetchPublicHtml(input.url);
    const kind = normalizeKind(input.kind);
    const result = htmlToDocument(html, {
      baseUrl: url.toString(),
      title: typeof input.name === "string" ? input.name : undefined,
      kind,
    });
    return this.createFrom(result, input, kind, tenantId, role, `URL: ${url.hostname}`);
  }

  async fromHtml(input: ImportInput & { html?: unknown }, tenantId: string, role: string) {
    if (typeof input.html !== "string" || input.html.trim().length < 10) {
      throw new BadRequestException("Cole o HTML do site que deseja importar.");
    }
    const kind = normalizeKind(input.kind);
    const result = htmlToDocument(input.html, {
      title: typeof input.name === "string" ? input.name : undefined,
      kind,
    });
    return this.createFrom(result, input, kind, tenantId, role, "HTML colado");
  }

  async fromZip(
    input: ImportInput & { fileName?: unknown; contentBase64?: unknown },
    tenantId: string,
    role: string,
  ) {
    if (typeof input.contentBase64 !== "string" || input.contentBase64.length > MAX_ZIP_BASE64) {
      throw new BadRequestException("Arquivo ZIP inválido ou maior que 15 MB.");
    }
    let archive: AdmZip;
    try {
      archive = new AdmZip(Buffer.from(input.contentBase64, "base64"));
    } catch {
      throw new BadRequestException("Não foi possível ler o ZIP. Verifique se o arquivo não está corrompido.");
    }

    if (archive.getEntries().length > MAX_ENTRIES) {
      throw new BadRequestException("O ZIP tem arquivos demais. Exporte apenas o HTML e seus recursos.");
    }
    const entries = archive.getEntries().filter((entry) => {
      const name = entry.entryName;
      if (entry.isDirectory || name.includes("..") || name.startsWith("/") || /^[a-zA-Z]:/.test(name)) return false;
      return TEXT_FILE.test(name) && entry.header.size <= MAX_ENTRY_BYTES;
    });
    if (!entries.length) throw new BadRequestException("O ZIP não continha arquivos HTML, CSS, JS ou JSON.");

    const kind = normalizeKind(input.kind);
    const warnings: string[] = [];
    const elementor = entries
      .filter((entry) => /\.json$/i.test(entry.entryName))
      .map((entry) => {
        try {
          return { name: entry.entryName, value: JSON.parse(entry.getData().toString("utf8")) };
        } catch {
          return null;
        }
      })
      .find((entry) => entry && (entry.value?.content || entry.value?.elements));

    let result: ConversionResult;
    if (elementor) {
      result = elementorConversion(
        elementor.value,
        typeof input.name === "string" ? input.name : String(input.fileName ?? "").replace(/\.zip$/i, ""),
        kind,
      );
      warnings.push(`Blocos lidos de ${elementor.name}. Revise o resultado no editor.`);
    } else {
      const htmlEntry =
        entries.find((entry) => /(^|\/)index\.html?$/i.test(entry.entryName)) ??
        entries.find((entry) => /\.html?$/i.test(entry.entryName));
      if (!htmlEntry) throw new BadRequestException("O ZIP não continha um arquivo HTML para importar.");
      result = htmlToDocument(htmlEntry.getData().toString("utf8"), {
        title: typeof input.name === "string" ? input.name : String(input.fileName ?? "").replace(/\.zip$/i, ""),
        kind,
      });
    }
    warnings.push("CSS e JavaScript do ZIP não são executados. Aparência e interações precisam ser ajustadas no editor.");
    warnings.push("Imagens locais do ZIP não foram hospedadas: aponte-as para URLs públicas antes de publicar.");
    result.warnings = [...warnings, ...result.warnings];
    return this.createFrom(result, input, kind, tenantId, role, `ZIP: ${String(input.fileName ?? "import.zip").slice(0, 60)}`);
  }

  private async createFrom(
    result: ConversionResult,
    input: ImportInput,
    kind: ImportedKind,
    tenantId: string,
    role: string,
    source: string,
  ) {
    const document = result.document;
    if (
      !document?.root ||
      typeof document.root.type !== "string" ||
      !Array.isArray(document.root.children)
    ) {
      throw new BadRequestException("A conversão não produziu um documento válido.");
    }
    const site = await this.sites.createWithDocument(
      tenantId,
      role,
      { name: documentName(result, input), kind: siteKindOf(kind) },
      document,
    );
    return { site, warnings: result.warnings, source, blocks: document.root.children.length };
  }
}
