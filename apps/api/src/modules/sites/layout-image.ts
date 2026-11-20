/**
 * Referência visual do wizard: uma captura de layout é aceita somente como
 * imagem raster comum, redimensionada e recompactada antes de ir ao modelo.
 * Nada aqui é gravado no SiteDocument — a imagem é um insumo temporário.
 */

import { BadRequestException } from "@nestjs/common";
import sharp from "sharp";

export type LayoutImageInput = {
  dataUrl: string;
  mimeType: "image/jpeg";
  fileName: string;
  width: number;
  height: number;
  bytes: number;
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
