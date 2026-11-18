import { renderSite, safeUrl } from "./site-renderer";

const site = {
  name: "Clínica Vida",
  slug: "clinica-vida",
  primaryColor: "#0E7A5C",
  accentColor: "#6258DF",
  businessArea: "Saúde",
  pages: [
    {
      id: "p1",
      kind: "HOME",
      slug: "inicio",
      title: "Início",
      sortOrder: 0,
      blocks: [
        { type: "hero", content: { title: "Cuidado <perto> de você", subtitle: "Atendimento humano", primaryLabel: "Agendar", primaryUrl: "https://wa.me/5511999999999" }, sortOrder: 0 },
        { type: "services", content: { title: "Serviços", items: [{ title: "Clínica geral", description: "Consultas" }] }, sortOrder: 1 },
        { type: "gallery", content: { images: [{ url: "/api/backend/public/site-assets/11111111-1111-1111-1111-111111111111", caption: "Recepção" }] }, sortOrder: 2 },
      ],
    },
    {
      id: "p2",
      kind: "CONTACT",
      slug: "contato",
      title: "Contato",
      sortOrder: 1,
      blocks: [{ type: "contact", content: { items: [{ department: "Recepção", whatsapp: "(11) 99999-9999", email: "contato@clinica.com" }] } }],
    },
    { id: "p3", kind: "CUSTOM", slug: "oculta", title: "Oculta", hidden: true, blocks: [] },
  ],
  items: [
    { kind: "post", slug: "novo-exame", title: "Novo exame", excerpt: "Chegou", coverUrl: null, data: {}, sortOrder: 0 },
    { kind: "property", slug: "sala-1", title: "Sala 1", excerpt: null, coverUrl: null, data: { price: "R$ 1.000", code: "IMO-1" }, sortOrder: 0 },
  ],
  assets: new Map([["11111111-1111-1111-1111-111111111111", { mimeType: "image/png", bytes: Buffer.from("png-bytes") }]]),
};

describe("site-renderer", () => {
  it("gera páginas, listagens e 404", () => {
    const result = renderSite(site as any);
    expect([...result.files.keys()]).toEqual(expect.arrayContaining([
      "index.html", "contato/index.html", "noticias/index.html", "noticias/novo-exame/index.html",
      "imoveis/index.html", "imoveis/sala-1/index.html", "404.html", "assets/site.css",
    ]));
    expect(result.files.has("oculta/index.html")).toBe(false);
    expect(result.pageCount).toBeGreaterThanOrEqual(6);
  });

  it("escapa texto e preserva o título", () => {
    const html = renderSite(site as any).files.get("index.html")!.content.toString("utf8");
    expect(html).toContain("Cuidado &lt;perto&gt; de você");
    expect(html).not.toContain("<perto>");
    expect(html).toContain('href="https://wa.me/5511999999999"');
  });

  it("copia assets referenciados e reescreve a URL", () => {
    const result = renderSite(site as any);
    expect(result.files.has("assets/11111111-1111-1111-1111-111111111111.png")).toBe(true);
    expect(result.files.get("assets/11111111-1111-1111-1111-111111111111.png")!.content.toString()).toBe("png-bytes");
    expect(result.files.get("index.html")!.content.toString()).toContain('src="/assets/11111111-1111-1111-1111-111111111111.png"');
    expect(result.assetCount).toBe(1);
  });

  it("aceita documento completo em externalHtml", () => {
    const result = renderSite({
      name: "Importado", slug: "importado",
      pages: [{ kind: "HOME", slug: "inicio", title: "Home", blocks: [{ type: "externalHtml", content: { html: "<!doctype html><html><body><h1>Pronto</h1></body></html>" } }] }],
    });
    const html = result.files.get("index.html")!.content.toString();
    expect(html).toContain("<h1>Pronto</h1>");
    expect(html).not.toContain("assets/site.css");
  });

  it("recusa site sem páginas e URLs perigosas", () => {
    expect(() => renderSite({ name: "X", slug: "x", pages: [] })).toThrow(/páginas/);
    expect(safeUrl("javascript:alert(1)")).toBe("");
    expect(safeUrl("/contato")).toBe("/contato");
  });
});
