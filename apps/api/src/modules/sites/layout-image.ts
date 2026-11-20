/**
 * Referência visual do wizard: uma captura de layout é aceita somente como
 * imagem raster comum, redimensionada e recompactada antes de ir ao modelo.
 * Nada aqui é gravado no SiteDocument — a imagem é um insumo temporário.
 */

import { BadRequestException } from "@nestjs/common";
import sharp from "sharp";
import type { LayoutBrief, LayoutSectionKey } from "./layout-brief";

export type LayoutImageInput = {
  dataUrl: string;
  mimeType: "image/jpeg";
  fileName: string;
  width: number;
  height: number;
  bytes: number;
};

export type LayoutAnalysis = {
  primary: string;
  accent: string;
  brief: LayoutBrief;
};

const DATA_URL = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const MAX_DATA_URL_CHARS = 8_000_000;
const MAX_SOURCE_BYTES = 6_000_000;
const MAX_OUTPUT_BYTES = 1_500_000;
const MAX_SIDE = 1600;

function invalid(message: string): never {
  throw new BadRequestException(message);
}

function fileName(value: unknown): string {
  if (typeof value !== "string") return "layout.jpg";
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "layout.jpg";
}

export async function parseLayoutImage(value: unknown): Promise<LayoutImageInput> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    invalid("Imagem de layout inválida.");
  }
  const input = value as Record<string, unknown>;
  if (typeof input.dataUrl !== "string" || input.dataUrl.length > MAX_DATA_URL_CHARS) {
    invalid("Imagem de layout inválida ou grande demais.");
  }
  const match = DATA_URL.exec(input.dataUrl.trim());
  if (!match) invalid("Use uma imagem PNG, JPG ou WebP como referência de layout.");

  const source = Buffer.from(match![2]!, "base64");
  if (!source.length || source.length > MAX_SOURCE_BYTES) invalid("A imagem de layout excede o tamanho permitido.");

  let format: string | undefined;
  let width: number | undefined;
  let height: number | undefined;
  try {
    const metadata = await sharp(source, { failOn: "error" }).metadata();
    format = metadata.format;
    width = metadata.width;
    height = metadata.height;
  } catch {
    invalid("Não foi possível ler a imagem de layout.");
  }
  if (!format || !["png", "jpeg", "webp"].includes(format) || !width || !height || width < 64 || height < 64) {
    invalid("A imagem de layout deve ter pelo menos 64x64 pixels e ser PNG, JPG ou WebP.");
  }

  const normalized = () =>
    sharp(source)
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" });

  let output = await normalized().jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  for (const quality of [70, 58]) {
    if (output.length <= MAX_OUTPUT_BYTES) break;
    output = await normalized().jpeg({ quality, mozjpeg: true }).toBuffer();
  }
  if (output.length > MAX_OUTPUT_BYTES) invalid("A imagem de layout é complexa demais. Tente uma captura menor.");

  const result = await sharp(output).metadata();
  return {
    dataUrl: `data:image/jpeg;base64,${output.toString("base64")}`,
    mimeType: "image/jpeg",
    fileName: fileName(input.fileName),
    width: result.width ?? width,
    height: result.height ?? height,
    bytes: output.length,
  };
}

/**
 * Fallback sem modelo de visão: lê apenas sinais visuais grosseiros (faixas
 * horizontais e cores dominantes) para estimar densidade, ordem de seções e
 * paleta. Nunca lê textos, marcas ou dados da captura e não inventa conteúdo.
 */
const SECTION_ORDER: LayoutSectionKey[] = [
  "topo", "hero", "prova", "servicos", "beneficios", "processo",
  "depoimentos", "sobre", "faq", "contato", "rodape",
];

function hueFromRgb(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (!delta) return 0;
  let hue = 0;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  return (hue * 60 + 360) % 360;
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const h = ((hue % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lightness - c / 2;
  let rgb: [number, number, number];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return `#${rgb
    .map((value) => Math.round((value + m) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

type ColorBucket = { index: number; hue: number; score: number; count: number };

function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, 360 - diff);
}

export async function analyzeLayoutImage(image: LayoutImageInput): Promise<LayoutAnalysis> {
  const [, encoded = ""] = image.dataUrl.split(",");
  const source = Buffer.from(encoded, "base64");
  const { data, info } = await sharp(source)
    .removeAlpha()
    .flatten({ background: "#ffffff" })
    .resize(64, 128, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const buckets = Array.from({ length: 12 }, (_, index) => ({ index, hue: 0, score: 0, count: 0 }));
  const luminance: number[] = [];
  for (let y = 0; y < info.height; y += 1) {
    let rowLight = 0;
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      const r = data[offset] ?? 0;
      const g = data[offset + 1] ?? 0;
      const b = data[offset + 2] ?? 0;
      rowLight += 0.299 * r + 0.587 * g + 0.114 * b;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max > 246 || min < 12 || max - min < 22) continue;
      const hue = hueFromRgb(r, g, b);
      const index = Math.min(11, Math.floor(hue / 30));
      const bucket = buckets[index]!;
      bucket.hue += hue;
      bucket.score += max - min;
      bucket.count += 1;
    }
    luminance.push(rowLight / info.width);
  }

  const ranked: ColorBucket[] = buckets
    .filter((bucket) => bucket.count > 0)
    .map((bucket) => ({
      index: bucket.index,
      hue: bucket.hue / bucket.count,
      score: bucket.score,
      count: bucket.count,
    }))
    .sort((a, b) => b.score - a.score || b.count - a.count || a.index - b.index);

  const primaryBucket = ranked[0];
  const accentBucket = ranked.find((bucket) => hueDistance(bucket.hue, primaryBucket?.hue ?? 0) >= 100);
  const primary = primaryBucket ? hslToHex(primaryBucket.hue, 0.58, 0.38) : "#0e7a5c";
  const accent = accentBucket
    ? hslToHex(accentBucket.hue, 0.66, 0.52)
    : primaryBucket
      ? hslToHex(primaryBucket.hue + 150, 0.66, 0.52)
      : "#6258df";

  const smoothed = luminance.map((_, index) => {
    const from = Math.max(0, index - 1);
    const to = Math.min(luminance.length - 1, index + 1);
    let sum = 0;
    for (let position = from; position <= to; position += 1) sum += luminance[position] ?? 0;
    return sum / (to - from + 1);
  });
  let bands = 1;
  let lastChange = 0;
  for (let index = 1; index < smoothed.length; index += 1) {
    if (Math.abs((smoothed[index] ?? 0) - (smoothed[index - 1] ?? 0)) >= 9 && index - lastChange >= 4) {
      bands += 1;
      lastChange = index;
    }
  }

  const density: LayoutBrief["density"] = bands >= 14 ? "compacta" : bands <= 5 ? "generosa" : "equilibrada";
  const middleCount = density === "compacta" ? 6 : density === "generosa" ? 3 : 4;
  const brief: LayoutBrief = {
    sections: [
      ...SECTION_ORDER.slice(0, 2),
      ...SECTION_ORDER.slice(2, 2 + middleCount),
      ...SECTION_ORDER.slice(-2),
    ],
    emphasis: density === "compacta" ? "servicos" : "hero",
    density,
    confidence: 0.35,
    notes: `Estimativa determinística: ${bands} faixas horizontais e cores dominantes da captura.`,
  };

  return { primary, accent, brief };
}
