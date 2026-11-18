import { BadRequestException } from "@nestjs/common";
import PDFDocument from "pdfkit";

/**
 * Núcleo de geração de documentos reutilizado pelo REST (/api/backend/documents)
 * e pelo MCP (create_document). Nada aqui fala com o mundo — só monta e persiste.
 */

export const KINDS = new Set(["QUOTE", "CONTRACT", "WORK_ORDER", "RECEIPT"]);
export const VARIABLE_TYPES = new Set(["text", "longtext", "date", "money"]);
export const KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;
export const MAX_BODY = 40_000;

export const trim = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export const object = (value: unknown): Record<string, any> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};

/** Cabeçalho que aparece no PDF quando a empresa tem os dados configurados. */
export interface CompanyPdfHeader {
  title: string;
  subtitle?: string;
  line?: string;
}

export function companyHeader(integrations: unknown, tenantName: string): CompanyPdfHeader | null {
  const root = object(integrations);
  const org = object(root.organization);
  const title = trim(org.legalName, 120) || trim(tenantName, 120);
  if (!title) return null;
  const cnpj = trim(org.cnpj, 18);
  const addressLine = [[org.address, org.city, org.state].filter((v) => typeof v === "string" && v.trim()).join(" · "), trim(org.zipCode, 10)].filter(Boolean).join(" · ");
  const subtitle = [cnpj ? `CNPJ: ${cnpj}` : ""].filter(Boolean).join(" · ") || undefined;
  return { title, line: addressLine || undefined, subtitle };
}

/** Variáveis exclusivas da empresa (nome, CNPJ, endereço…) para auto-preenchimento. */
export function companyAutofill(integrations: unknown, tenantName: string): Record<string, string> {
  const root = object(integrations);
  const org = object(root.organization);
  const out: Record<string, string> = {};
  const legal = trim(org.legalName, 160) || trim(tenantName, 160);
  if (legal) out.empresa_nome = legal;
  const cnpj = trim(org.cnpj, 18);
  if (cnpj) out.empresa_cnpj = cnpj;
  const address = [org.address, org.city, org.state].filter((v: unknown) => typeof v === "string" && (v as string).trim()).join(" · ").slice(0, 200);
  if (address) out.empresa_endereco = address;
  const uf = trim(org.state, 2);
  if (uf) out.empresa_uf = uf;
  const cityState = [org.city, org.state].filter((v: unknown) => typeof v === "string" && (v as string).trim()).join("/").slice(0, 80);
  if (cityState) out.empresa_cidade_uf = cityState;
  if (org.mapsUrl) out.empresa_mapa = String(org.mapsUrl).slice(0, 300);
  return out;
}

export function parseVariables(input: unknown) {
  if (!Array.isArray(input)) throw new BadRequestException("As variáveis devem ser uma lista.");
  if (input.length > 40) throw new BadRequestException("No máximo 40 variáveis por modelo.");
  return input.map((raw: any) => {
    const key = typeof raw?.key === "string" ? raw.key.trim().toLowerCase() : "";
    const label = trim(raw?.label, 80);
    const type = typeof raw?.type === "string" && VARIABLE_TYPES.has(raw.type) ? raw.type : "text";
    const required = raw?.required === true;
    if (!KEY_RE.test(key)) {
      throw new BadRequestException(
        `Variável inválida: "${String(raw?.key ?? "")}". Use minúsculas, números e underscore (ex.: nome_cliente).`,
      );
    }
    if (!label) throw new BadRequestException(`A variável "${key}" precisa de um rótulo.`);
    return { key, label, type, required };
  });
}

export function renderTemplate(body: string, values: Record<string, string>) {
  return body.replace(/\{\{([a-z0-9_]{1,40})\}\}/gi, (_, key: string) => {
    const value = values[String(key).toLowerCase()];
    return value === undefined ? `{{${key}}}` : value;
  });
}

export function missingKeys(body: string, values: Record<string, string>) {
  const missing = new Set<string>();
  const matches = body.matchAll(/\{\{([a-z0-9_]{1,40})\}\}/gi);
  for (const match of matches) {
    const key = String(match[1]).toLowerCase();
    if (!values[key]?.trim()) missing.add(key);
  }
  return [...missing];
}

export function contactAutofill(contact: any): Record<string, string> {
  const meta = object(contact?.metadata);
  const digits = (value: unknown) => (typeof value === "string" ? value.replace(/\D/g, "") : "");
  const out: Record<string, string> = {};
  if (contact?.name) out.nome_cliente = String(contact.name);
  if (contact?.phone) out.telefone = String(contact.phone);
  if (contact?.email) out.email = String(contact.email);
  const asaas = object(meta.asaas);
  const document = digits(meta.document) || digits(asaas.cpfCnpj) || digits(asaas.document);
  if (document) out.cpf_cnpj = document;
  const company =
    trim(asaas.companyName, 160) || trim(asaas.company, 160) || trim(meta.company, 160) || trim(meta.razaoSocial, 160);
  if (company) out.empresa = company;
  const address =
    trim(asaas.address, 240) || trim(meta.endereco, 240) || trim(meta.address, 240) || trim(asaas.addressLine1, 240);
  if (address) out.endereco = address;
  return out;
}

export async function buildPdf(name: string, content: string, header?: CompanyPdfHeader | null): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 56, bottom: 56, left: 52, right: 52 }, info: { Title: name } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    // Cabeçalho da empresa (quando configurado) — substitui a marca Véxora
    if (header?.title) {
      doc.fillColor("#204f9c").fontSize(13).text(header.title, { align: "left" });
      if (header.subtitle) {
        doc.fontSize(8).fillColor("#5a6b86").text(header.subtitle);
      }
      if (header.line) {
        doc.fontSize(8).fillColor("#5a6b86").text(header.line);
      }
      doc.moveDown(0.3);
      doc.strokeColor("#204f9c").lineWidth(1.1).moveTo(52, doc.y).lineTo(543, doc.y).stroke();
      doc.moveDown(0.6);
    } else {
      doc.fillColor("#2456a7").fontSize(10).text("VÉXORA SUITE", { align: "left" });
      doc.moveDown(0.4);
    }
    doc.fillColor("#16243a").fontSize(20).text(name, { lineGap: 4 });
    doc.moveDown(0.4);
    if (!header?.title) {
      doc.strokeColor("#204f9c").lineWidth(1.2).moveTo(52, doc.y).lineTo(543, doc.y).stroke();
      doc.moveDown(0.6);
    }
    doc.fillColor("#1f2a44").fontSize(11);
    for (const paragraph of content.split(/\n{2,}/)) {
      doc.text(paragraph.replace(/\n/g, " "), { lineGap: 3.5, paragraphGap: 4 });
    }
    doc.moveDown(1);
    doc.fontSize(9).fillColor("#5a6b86").text("Gerado pela Véxora Suite em " + new Date().toLocaleDateString("pt-BR"), { align: "left" });
    doc.end();
  });
}
