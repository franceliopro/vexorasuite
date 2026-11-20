import sharp from "sharp";
import { SitesService } from "./sites.service";
import { LANDING_CONTACT_ANCHOR, LANDING_FORM_BLOCK_ID } from "./landing-template";
import { promptDocument } from "./prompt-template";
import { parseLayoutBrief } from "./layout-brief";

async function imageDataUrl(): Promise<string> {
  const width = 256;
  const height = 512;
  const band = Buffer.alloc(width * 128 * 3);
  for (let index = 0; index < band.length; index += 3) {
    band[index] = 194;
    band[index + 1] = 65;
    band[index + 2] = 12;
  }
  const bytes = await sharp({ create: { width, height, channels: 3, background: "#ffffff" } })
    .composite([{ input: band, raw: { width, height: 128, channels: 3 }, top: 160, left: 0 }])
    .png()
    .toBuffer();
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

const TENANT = "22222222-2222-4222-8222-222222222222";
const SITE = "11111111-1111-4111-8111-111111111111";
const PRIMARY = "#0e7a5c";
const ACCENT = "#6258df";

type Node = { id: string; type: string; props: Record<string, any>; children: Node[] };

function nodes(document: any): Node[] {
  const all: Node[] = [];
  const visit = (node: Node) => {
    all.push(node);
    for (const child of node.children ?? []) visit(child);
  };
  visit(document.root);
  for (const page of document.pages ?? []) visit(page.root);
  return all;
}

function content(document: any, id: string): string {
  return String(nodes(document).find((node) => node.id === id)?.props.content ?? "");
}

function label(document: any, id: string): string {
  return String(nodes(document).find((node) => node.id === id)?.props.label ?? "");
}

function prismaMock() {
  const created: Record<string, any> = {};
  const prisma: any = {
    tenant: { findUnique: jest.fn().mockResolvedValue({ kind: "COMPANY", entitlements: null }) },
    site: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        created.site = data;
        return {
          id: SITE,
          name: data.name,
          slug: data.slug,
          kind: data.kind,
          domain: null,
          domainStatus: "NONE",
          published: false,
          createdAt: new Date(),
        };
      }),
    },
    siteDocument: {
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        created.document = data.document;
        return { id: "doc-1" };
      }),
    },
    $transaction: jest.fn().mockImplementation(async (fn: any) => fn(prisma)),
  };
  return { prisma, created };
}

describe("rascunho premium a partir da descrição do wizard", () => {
  it("usa a descrição como texto de apoio e remove marcação", () => {
    const document = promptDocument({
      prompt: "Clínica veterinária em Curitiba com <script>horários</script> e serviços",
      name: "Pet Care",
      kind: "LANDING",
      primary: PRIMARY,
      accent: ACCENT,
    });

    expect(content(document, "landing_hero_subtitle")).toContain("Clínica veterinária em Curitiba");
    expect(content(document, "landing_hero_title")).toBe("Cuidado veterinário com atenção em cada detalhe");
    expect(document.root.children).toHaveLength(12);
    expect(JSON.stringify(document)).not.toContain("<script>");
    expect(document.meta.generatedFrom).toBe("prompt");
    expect(document.meta.type).toBe("landing");
  });

  it("escolhe segmento, chamada e benefícios por palavra-chave, sem chamar modelo externo", () => {
    const document = promptDocument({
      prompt: "Clínica veterinária com agendamento de consultas",
      name: "Pet Care",
      kind: "LANDING",
      primary: PRIMARY,
      accent: ACCENT,
    });

    expect(label(document, "landing_hero_cta")).toBe("Agendar horário");
    expect(label(document, "landing_nav_cta")).toBe("Agendar horário");
    expect(content(document, "landing_hero_eyebrow")).toContain("VETERINÁRIA");
    expect(content(document, "landing_benefits_title")).toBe("Um cuidado que tranquiliza");
    expect(content(document, "landing_benefit_1_text")).toContain("Espaço para ouvir");
    expect(content(document, "landing_panel_step_1_title")).toBe("Conversa inicial");
    expect(content(document, "landing_contact_title")).toBe("Agende seu horário");
  });

  it("entrega páginas navegáveis, formulário estável e páginas legais em rascunho", () => {
    const document = promptDocument({
      prompt: "Loja de produtos com orçamento",
      name: "Minha loja",
      kind: "LANDING",
      primary: PRIMARY,
      accent: ACCENT,
    });
    const all = nodes(document);
    const text = JSON.stringify(document);
    const slugs = document.pages.map((page: any) => page.slug);

    expect(all.some((node) => node.type === "section" && node.props.anchor === LANDING_CONTACT_ANCHOR)).toBe(true);
    expect(all.find((node) => node.id === LANDING_FORM_BLOCK_ID)?.props.fields).toEqual(["nome", "email", "mensagem"]);
    expect(all.find((node) => node.id === "contato_form")?.type).toBe("form");
    expect(label(document, "landing_hero_cta")).toBe("Pedir orçamento");
    expect(content(document, "landing_benefits_title")).toBe("Por que comprar com a gente");
    expect(slugs).toEqual([
      "sobre",
      "servicos",
      "cases",
      "faq",
      "contato",
      "privacidade",
      "termos",
      "cookies",
      "exclusao-de-dados",
    ]);
    expect(text).toMatch(/Política de Privacidade — rascunho/);
    expect(text).toMatch(/Termos de Uso — rascunho/);
    expect(text).toMatch(/RASCUNHO: conteúdo e dados fictícios/);
    expect(text).toContain("00.000.000/0001-00");
    expect(text).not.toMatch(/Substitua este texto|Apresente sua oferta/);
  });

  it("usa o logotipo informado ou cria um provisório claramente marcado", () => {
    const withLogo = promptDocument({
      prompt: "Clínica veterinária",
      name: "Pet Care",
      kind: "LANDING",
      primary: PRIMARY,
      accent: ACCENT,
      logoUrl: "https://exemplo.com/logo.png",
    });
    const withoutLogo = promptDocument({
      prompt: "Clínica veterinária",
      name: "Pet Care",
      kind: "LANDING",
      primary: PRIMARY,
      accent: ACCENT,
    });

    expect(nodes(withLogo).find((node) => node.id === "landing_logo_image")?.props.src).toBe(
      "https://exemplo.com/logo.png",
    );
    expect(nodes(withLogo).find((node) => node.id === "page_servicos_logo")?.props.src).toBe(
      "https://exemplo.com/logo.png",
    );
    expect(content(withoutLogo, "landing_logo_fake_mark")).toBe("PC");
    expect(content(withoutLogo, "page_servicos_logo_fake_label")).toBe("LOGO PROVISÓRIO");
    expect(JSON.stringify(withoutLogo)).toContain("LOGO PROVISÓRIO");
  });

  it("gera uma estrutura premium mesmo para descrição sem segmento reconhecido", () => {
    const document = promptDocument({
      prompt: "Quero uma página para meu novo projeto",
      name: "Meu projeto",
      kind: "LANDING",
      primary: PRIMARY,
      accent: ACCENT,
    });

    expect(content(document, "landing_hero_title")).toContain("presença clara");
    expect(content(document, "landing_benefit_1_title")).toBe("Atendimento próximo");
    expect(content(document, "landing_form_title")).toBe("Conte o que você precisa");
    expect(document.root.children).toHaveLength(12);
    expect(document.pages).toHaveLength(9);
  });

  it("persiste o documento gerado quando o prompt é enviado na criação", async () => {
    const { prisma, created } = prismaMock();
    const service = new SitesService(prisma);

    const site = await service.create(TENANT, "OWNER", {
      name: "Pet Care",
      kind: "LANDING",
      prompt: "Clínica veterinária com formulário de contato",
      logoUrl: "https://exemplo.com/logo.png",
    });

    expect(site.id).toBe(SITE);
    expect(created.site.prompt).toBeUndefined();
    expect(created.site.logoUrl).toBe("https://exemplo.com/logo.png");
    expect(created.document.meta.generatedFrom).toBe("prompt");
    expect(created.document.pages).toHaveLength(9);
    expect(content(created.document, "landing_hero_subtitle")).toContain("Clínica veterinária");
    expect(prisma.siteDocument.create).toHaveBeenCalledTimes(1);
  });

  it("sem prompt mantém o documento padrão e rejeita descrições inválidas", async () => {
    const { prisma, created } = prismaMock();
    const service = new SitesService(prisma);

    await service.create(TENANT, "OWNER", { name: "Site simples", kind: "STATIC" });
    expect(created.document.root.children).toEqual([]);

    await expect(service.create(TENANT, "OWNER", { name: "Site simples", prompt: "ab" })).rejects.toThrow();
    await expect(
      service.create(TENANT, "OWNER", { name: "Site simples", prompt: "Site novo", logoUrl: "javascript:alert(1)" }),
    ).rejects.toThrow();
    await expect(
      service.create(TENANT, "OWNER", {
        name: "Site simples",
        layoutImage: { dataUrl: "javascript:alert(1)" },
      }),
    ).rejects.toThrow();
  });

  it("recria o rascunho somente com a imagem, usando regras determinísticas quando não há visão", async () => {
    const { prisma, created } = prismaMock();
    const service = new SitesService(prisma);
    const result: any = await service.create(TENANT, "OWNER", {
      name: "Site da imagem",
      kind: "LANDING",
      layoutImage: { dataUrl: await imageDataUrl(), fileName: "layout.png" },
    });

    expect(result.warnings).toEqual([expect.stringContaining("regras determinísticas")]);
    expect(created.site.primaryColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(created.site.primaryColor).not.toBe("#0e7a5c");
    expect(created.document.meta.generatedFrom).toBe("layout");
    expect(created.document.meta.layoutReference).toMatchObject({ analyzed: true, source: "deterministic" });
    expect(created.document.meta.theme.primary).toBe(created.site.primaryColor);
    expect(created.document.root.children[0].id).toBe("landing_nav");
    expect(created.document.root.children[created.document.root.children.length - 1].id).toBe("landing_footer");
  });

  it("não sobrescreve cores explícitas com a paleta da imagem", async () => {
    const { prisma, created } = prismaMock();
    const service = new SitesService(prisma);
    await service.create(TENANT, "OWNER", {
      name: "Site com cores",
      kind: "LANDING",
      primaryColor: "#123456",
      accentColor: "#abcdef",
      layoutImage: { dataUrl: await imageDataUrl(), fileName: "layout.png" },
    });

    expect(created.site.primaryColor).toBe("#123456");
    expect(created.site.accentColor).toBe("#abcdef");
    expect(created.document.meta.theme.primary).toBe("#123456");
    expect(created.document.meta.theme.secondary).toBe("#abcdef");
  });

  it("entrega imagens ilustrativas editáveis no rascunho a partir do prompt", () => {
    const img = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
    const document = promptDocument({
      prompt: "Clínica veterinária",
      name: "Pet Care",
      kind: "LANDING",
      primary: PRIMARY,
      accent: ACCENT,
      images: { about: img + "A", team: img + "B", service: img + "C" },
    });
    const all = nodes(document);
    const heroImage = all.find((node) => node.id === "landing_about_visual_image");

    expect(heroImage?.type).toBe("image");
    expect(String(heroImage?.props.src)).toMatch(/^data:image\/png;base64,/);
    expect(content(document, "landing_about_visual_label")).toMatch(/TROQUE POR FOTO REAL/);
    expect(all.find((node) => node.id === "page_sobre_team_image")?.type).toBe("image");
    expect(all.find((node) => node.id === "page_servicos_image")?.type).toBe("image");
    expect(JSON.stringify(document)).not.toContain("FOTO REAL DA EQUIPE OU DO ESPAÇO");
  });

  it("aplica a estrutura sugerida pela imagem sem copiar conteúdo da referência", () => {
    const brief = parseLayoutBrief(
      JSON.stringify({
        sections: ["depoimentos", "servicos", "sobre", "faq", "beneficios", "processo", "comparativo", "prova"],
        emphasis: "depoimentos",
        density: "compacta",
        confidence: 0.82,
        notes: "Referência com depoimentos em destaque",
      }),
      "gpt-5",
    );
    expect(brief).not.toBeNull();
    const document = promptDocument({
      prompt: "Clínica veterinária",
      name: "Pet Care",
      kind: "LANDING",
      primary: PRIMARY,
      accent: ACCENT,
      layoutBrief: brief,
    });
    const ids = document.root.children.map((node: any) => node.id);

    expect(ids[0]).toBe("landing_nav");
    expect(ids[1]).toBe("landing_hero");
    expect(ids.indexOf("landing_testimonials")).toBeLessThan(ids.indexOf("landing_services"));
    expect(ids[ids.length - 2]).toBe("landing_contact");
    expect(ids[ids.length - 1]).toBe("landing_footer");
    expect(document.root.children.find((node: any) => node.id === "landing_hero")?.props.padding).toContain("2.5rem");
    expect(document.meta.generatedFrom).toBe("prompt+layout");
    expect(document.meta.layoutReference).toMatchObject({ analyzed: true, model: "gpt-5", emphasis: "depoimentos" });
    expect(content(document, "landing_hero_title")).toBe("Cuidado veterinário com atenção em cada detalhe");
  });
});
