import { deflateSync } from "node:zlib";

const ICON_SIZES = new Set([180, 192, 512]);
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuffer, data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body), 0);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  return Buffer.concat([length, body, checksum]);
}

function iconPng(size: number): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const rgba = Buffer.from([96, 87, 223, 255]);
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let row = 0; row < size; row += 1) {
    const offset = row * (size * 4 + 1) + 1;
    for (let column = 0; column < size; column += 1) rgba.copy(raw, offset + column * 4);
  }
  return Buffer.concat([PNG_SIGNATURE, chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size);
  if (!ICON_SIZES.has(size)) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(iconPng(size)), { status: 200, headers: { "content-type": "image/png", "cache-control": "public, max-age=86400, immutable" } });
}
