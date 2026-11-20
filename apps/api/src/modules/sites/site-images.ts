/**
 * Ilustrações locais e determinísticas para o rascunho gerado pelo wizard de Sites.
 *
 * Não há chamada de modelo, download ou acesso a arquivos de outro tenant: a arte é
 * desenhada em SVG a partir do nome e das cores informadas no próprio pedido e
 * convertida para PNG pelo sharp. O resultado é embutido no SiteDocument como
 * `data:image/png;base64,` — um formato inerte (PNG não executa script) que funciona
 * tanto na prévia do editor quanto no HTML publicado, sem endpoints adicionais.
 *
 * As imagens são ilustrativas e estão marcadas como rascunho. Elas não retratam a
 * equipe, o espaço ou resultados reais da empresa.
 */

import sharp from "sharp";

export type SiteIllustrations = {
  about: string;
  team: string;
  service: string;
};

const PNG_PREFIX = "data:image/png;base64,";
const MAX_DATA_URI = 120_000;

function clean(value: unknown, limit = 36): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit)
    .trim();
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[char]!);
}

function color(value: unknown, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(String(value ?? "")) ? String(value) : fallback;
}

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function artwork(input: { name: string; primary: string; accent: string; label: string; variant: string }): string {
  const seed = hash(`${input.name}|${input.variant}`);
  const primary = color(input.primary, "#0E7A5C");
  const accent = color(input.accent, "#6258DF");
  const name = escapeXml(clean(input.name));
  const label = escapeXml(clean(input.label, 40));
  const orbX = 620 + (seed % 90);
  const orbY = 90 + ((seed >>> 8) % 70);
  const cardX = 110 + ((seed >>> 16) % 40);
  const angle = (seed >>> 24) % 40;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560" viewBox="0 0 900 560">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${primary}"/>
        <stop offset="1" stop-color="${accent}"/>
      </linearGradient>
      <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.94"/>
        <stop offset="1" stop-color="#ffffff" stop-opacity="0.78"/>
      </linearGradient>
    </defs>
    <rect width="900" height="560" fill="url(#bg)"/>
    <circle cx="${orbX}" cy="${orbY}" r="190" fill="#ffffff" opacity="0.12"/>
    <circle cx="150" cy="500" r="150" fill="#ffffff" opacity="0.08"/>
    <g transform="rotate(${angle} 450 280)">
      <rect x="${cardX}" y="120" width="620" height="320" rx="34" fill="url(#card)"/>
      <rect x="${cardX + 36}" y="162" width="150" height="14" rx="7" fill="${primary}" opacity="0.65"/>
      <rect x="${cardX + 36}" y="198" width="420" height="22" rx="11" fill="#101d33" opacity="0.82"/>
      <rect x="${cardX + 36}" y="236" width="330" height="16" rx="8" fill="#5c6677" opacity="0.5"/>
      <rect x="${cardX + 36}" y="268" width="380" height="16" rx="8" fill="#5c6677" opacity="0.4"/>
      <rect x="${cardX + 36}" y="324" width="170" height="52" rx="26" fill="${accent}"/>
    </g>
    <text x="52" y="524" font-family="DejaVu Sans, sans-serif" font-size="30" font-weight="700" fill="#ffffff">${name}</text>
    <text x="52" y="60" font-family="DejaVu Sans, sans-serif" font-size="19" font-weight="700" letter-spacing="2" fill="#ffffff" opacity="0.9">${label}</text>
    <text x="848" y="524" text-anchor="end" font-family="DejaVu Sans, sans-serif" font-size="17" fill="#ffffff" opacity="0.82">ILUSTRATIVO · RASCUNHO</text>
  </svg>`;
}

async function toPng(svg: string): Promise<string> {
  const buffer = await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9, palette: true, colours: 96 })
    .toBuffer();
  const uri = `${PNG_PREFIX}${buffer.toString("base64")}`;
  if (uri.length > MAX_DATA_URI) throw new Error("Ilustração gerada excedeu o limite do rascunho.");
  return uri;
}

/** Gera as três ilustrações usadas pelo rascunho, sempre com o mesmo resultado para os mesmos dados. */
export async function buildSiteIllustrations(input: {
  name: string;
  primary: string;
  accent: string;
}): Promise<SiteIllustrations> {
  const name = clean(input.name);
  const primary = color(input.primary, "#0E7A5C");
  const accent = color(input.accent, "#6258DF");
  const [about, team, service] = await Promise.all([
    toPng(artwork({ name, primary, accent, variant: "about", label: "IMAGEM ILUSTRATIVA" })),
    toPng(artwork({ name, primary, accent, variant: "team", label: "EQUIPE / ESPAÇO · ILUSTRAÇÃO" })),
    toPng(artwork({ name, primary, accent, variant: "service", label: "SERVIÇOS · ILUSTRAÇÃO" })),
  ]);
  return { about, team, service };
}
