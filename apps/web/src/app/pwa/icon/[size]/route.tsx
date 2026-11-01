const ICON_SIZES = new Set([180, 192, 512]);

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size);
  if (!ICON_SIZES.has(size)) return new Response(null, { status: 404 });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Véxora"><rect width="100%" height="100%" rx="${Math.round(size * 0.18)}" fill="#6057df"/><text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="${Math.round(size * 0.58)}" font-weight="800">V</text></svg>`;
  return new Response(svg, { status: 200, headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=86400, immutable" } });
}
