import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

// Gera icones PNG simples para o app nativo.
// Layout: fundo #2E7CF6 saturado, glyph "V" branco em negrito desenhado por poligonos.

const WIDTH = 1024, HEIGHT = 1024;

// RGB -> RGBA do funco simples de cor
function hex(v) {
  const n = parseInt(v.replace("#", ""), 16);
  return [ (n >> 16) & 255, (n >> 8) & 255, n & 255, 255 ];
}
const BG = hex("#2E7CF6");
const FG = [255, 255, 255, 255];

// AA simples via poligonos: renderiza V em anti-aliasing
function renderPixels() {
  const buf = Buffer.alloc(WIDTH * HEIGHT * 4);
  // Preenche com BG
  for (let i = 0; i < WIDTH * HEIGHT; i++) {
    buf[i * 4] = BG[0]; buf[i * 4 + 1] = BG[1]; buf[i * 4 + 2] = BG[2]; buf[i * 4 + 3] = BG[3];
  }
  // V generico: area central com margem segura de 18%
  const safeL = Math.round(WIDTH * 0.18), safeR = Math.round(WIDTH * 0.82);
  const topY = Math.round(HEIGHT * 0.18), botY = Math.round(HEIGHT * 0.82);
  const cx = Math.round(WIDTH / 2);
  const thick = Math.round(WIDTH * 0.11);

  // Poligono V (dois bracos)
  const polyA = [
    [safeL, topY],                  // pica esquerda superior
    [Math.round(cx - thick * 0.35), botY],   // fundo centro-esquerdo
    [Math.round(cx - thick * 0.62), botY],   // fundo centro-esquerdo mais fora
  ];
  const polyB = [
    [safeR, topY],                  // pica direita superior
    [Math.round(cx + thick * 0.35), botY],   // fundo centro-direito
    [Math.round(cx + thick * 0.62), botY],   // fundo centro-direito mais fora
  ];

  // Point-in-polygon simples para anti-aliasing supersampling 4x
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      let coverage = 0;
      const samples = [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];
      for (const [sx, sy] of samples) {
        const px = x + sx, py = y + sy;
        if (pointInPoly(px, py, polyA) || pointInPoly(px, py, polyB)) coverage++;
      }
      if (coverage === 0) continue;
      const alpha = [0, 64, 180, 230, 255][coverage];
      const i = (y * WIDTH + x) * 4;
      buf[i] = blend(buf[i], FG[0], alpha);
      buf[i + 1] = blend(buf[i + 1], FG[1], alpha);
      buf[i + 2] = blend(buf[i + 2], FG[2], alpha);
      buf[i + 3] = 255;
    }
  }
  return buf;
}
function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
function blend(bg, fg, alpha) {
  return Math.round((fg * alpha + bg * (255 - alpha)) / 255);
}

const pixels = renderPixels();

// PNG
function crc32(buf) {
  let table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const typ = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typ, data])));
  return Buffer.concat([len, typ, data, crc]);
}
function png(truecolor, width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // 8 bits por canal
  ihdr[9] = 6;   // truecolor + alpha
  ihdr[10] = 0;  // compressão default
  ihdr[11] = 0;  // filtro
  ihdr[12] = 0;  // sem entrelaçamento
  const rawOut = [];
  for (let y = 0; y < height; y++) {
    rawOut.push(0); // filtro none para cada scanline
    const rowStart = y * width * 4;
    rawOut.push(...rgba.slice(rowStart, rowStart + width * 4));
  }
  const idat = deflateSync(Buffer.from(rawOut), { level: 9 });
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

const BASE = "C:/Users/Francelio/vexora-main/apps/native/src-tauri/icons";

const sizes = [32, 48, 64, 128, 256, 512, 1024];
for (const size of sizes) {
  const pEls = Buffer.alloc(size * size * 4);
  // Reamostrar: nearest neighbor e subsample do buffer original
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = Math.floor((x + 0.5) * (WIDTH / size));
      const sy = Math.floor((y + 0.5) * (HEIGHT / size));
      const src = (sy * WIDTH + sx) * 4;
      const dst = (y * size + x) * 4;
      pEls[dst] = pixels[src]; pEls[dst + 1] = pixels[src + 1]; pEls[dst + 2] = pixels[src + 2]; pEls[dst + 3] = pixels[src + 3];
    }
  }
  const out = `${BASE}/${size}x${size}.png`;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, png(truecolorBrand(true), size, size, pEls));
  console.log("wrote", out, size + "x" + size);
}
// icone principal 512 (usado por Tauri em várias plataformas)
writeFileSync(`${BASE}/icon.png`, png(truecolorBrand(true), 512, 512, resample(pixels, WIDTH, HEIGHT, 512, 512)));
console.log("wrote", `${BASE}/icon.png`);
// icon.ico — Tauri v2 desktop build quer icon.ico/icns; vou enviar apenas icon.png + gerar icon.icns/cargo in CI via sips/sips fallback

function resample(src, w, h, toW, toH) {
  const out = Buffer.alloc(toW * toH * 4);
  for (let y = 0; y < toH; y++) {
    for (let x = 0; x < toW; x++) {
      const sx = Math.floor((x + 0.5) * (w / toW));
      const sy = Math.floor((y + 0.5) * (h / toH));
      const s = (sy * w + sx) * 4;
      const d = (y * toW + x) * 4;
      out[d] = src[s]; out[d + 1] = src[s + 1]; out[d + 2] = src[s + 2]; out[d + 3] = src[s + 3];
    }
  }
  return out;
}
function truecolorBrand(_) { return true; }
