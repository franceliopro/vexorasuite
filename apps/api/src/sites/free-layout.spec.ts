import { parseSitePage, sanitizeFreeLayout } from "./relayout";

describe("HTML e CSS do layout livre", () => {
  it("preserva composição própria e remove elementos e URLs executáveis", () => {
    const design = sanitizeFreeLayout({ html: '<section class="hero"><h1 onclick="alert(1)">Título</h1><script>alert(1)</script><a href="javascript:alert(1)">Link</a></section>', css: '.hero{display:grid}' });
    expect(design?.html).toContain('<section class="hero"><h1>Título</h1>');
    expect(design?.html).not.toMatch(/javascript|onclick|<script/);
    expect(design?.css).toBe('.hero{display:grid}');
    expect(sanitizeFreeLayout({ html: '<p>Teste</p>', css: '</style><script>alert(1)</script>' })).toBeNull();
  });
  it("exige HTML livre e preserva os blocos operacionais", () => {
    const existing = [{ type: "properties", content: { title: "Imóveis" } }];
    const page = (blocks: unknown[]) => parseSitePage(JSON.stringify({ blocks }), existing, true);
    expect(page([{ type: "hero", content: { headline: "Modelo pronto" } }])).toBeNull();
    expect(page([{ type: "freeLayout", content: { html: "<h1>Imóveis</h1>", css: "h1{color:#123}" } }])?.[1]).toEqual(existing[0]);
  });
});
