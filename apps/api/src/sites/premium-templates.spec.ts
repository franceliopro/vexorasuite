import { buildPremiumTemplate, templateForArea } from "./premium-templates";
import { sanitizeFreeLayout } from "./relayout";

const base = { name: "Clínica Lume", area: "clinica_estetica", primaryColor: "#123456", accentColor: "#654321", departments: [{ platform: "whatsapp", handle: "+55 62 99999-0000" }] };

describe("templates premium", () => {
  it("resolve o template pelo segmento", () => {
    expect(templateForArea("imobiliaria")).toBe("imobiliaria");
    expect(templateForArea("clinica_estetica")).toBe("estetica");
    expect(templateForArea("advocacia")).toBe("advocacia");
    expect(templateForArea("blog")).toBe("universal");
    expect(templateForArea("área-desconhecida")).toBe("universal");
  });

  it("monta um HTML/CSS completo e passa na sanitização", () => {
    const { html, css } = buildPremiumTemplate({ ...base, imageUrls: ["/api/backend/public/site-assets/11111111-2222-3333-4444-555555555555"] });
    expect(html).toContain("Clínica Lume");
    expect(html).toContain("wa.me/5562999990000");
    expect(html).toContain("<h1>");
    expect(html).toContain("edite no Studio"); // depoimento marcado como exemplo editável
    expect(css).toContain(".vx-hero");
    expect(css).toContain("@media(max-width:900px)");
    expect(sanitizeFreeLayout({ html, css })).not.toBeNull();
  });

  it("resolve a área vexora para o template institucional", () => {
    expect(templateForArea("vexora")).toBe("vexora");
  });

  it("monta o site institucional da Véxora com composição de produto e FAQ", () => {
    const { html, css } = buildPremiumTemplate({ name: "Véxora Suite", area: "vexora", primaryColor: "#2E7CF6", accentColor: "#2E7CF6", departments: [{ platform: "whatsapp", handle: "+55 62 99999-0000" }], imageUrls: [] });
    expect(html).toContain('<span class="vx-hl">sistema operacional</span>');
    expect(html).toContain("vx-art");           // composição de produto em CSS, sem imagem externa
    expect(html).toContain("Seis módulos");
    expect(html).toContain("Perguntas frequentes");
    expect(html).toContain("vx-faq-item");
    expect(html).toContain('id="planos"');
    expect(html).toContain("Véxora Completa");
    expect(html).toContain("R$ 799,00");
    expect(html).toContain("vx-marquee");
    expect(html).not.toContain("<script");
    expect(css).toContain("#060B1F");           // navy institucional
    expect(css).toContain("#2E7CF6");           // azul da marca
    expect(sanitizeFreeLayout({ html, css })).not.toBeNull();
  });

  it("escapa dados do cliente no HTML", () => {
    const evil = buildPremiumTemplate({ ...base, name: '<script>alert(1)</script>', imageUrls: [] });
    expect(evil.html).not.toContain("<script>alert(1)</script>");
    expect(evil.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("não inventa números de WhatsApp sem configurar", () => {
    const { html } = buildPremiumTemplate({ ...base, departments: [], imageUrls: [] });
    expect(html).toContain('href="#contato"');
  });
});
