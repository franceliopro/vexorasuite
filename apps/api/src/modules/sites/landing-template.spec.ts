import { SITE_KINDS, SitesService } from "./sites.service";
import { LANDING_CONTACT_ANCHOR, LANDING_FORM_BLOCK_ID, landingDocument } from "./landing-template";
import { renderSiteHtml } from "../sites-deploy/site-html";

const TENANT = "22222222-2222-4222-8222-222222222222";
const SITE = "11111111-1111-4111-8111-111111111111";

function walk(node: any, collected: any[] = []): any[] {
  collected.push(node);
  for (const child of node.children ?? []) walk(child, collected);
  return collected;
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

describe("landing page no criador de sites", () => {
  it("aceita LANDING como tipo de site", () => {
    expect(SITE_KINDS).toContain("LANDING");
  });

  it("o template tem uma única página com CTA, âncora e formulário", () => {
    const document = landingDocument("Minha oferta", "#0e7a5c", "#6258df");
    const nodes = walk(document.root);
    const ids = nodes.map((node) => node.id);

    expect(document.meta.type).toBe("landing");
    expect(new Set(ids).size).toBe(ids.length);
    expect(nodes.find((node) => node.id === "landing_hero_cta")?.props.href).toBe(`#${LANDING_CONTACT_ANCHOR}`);
    expect(nodes.some((node) => node.type === "section" && node.props.anchor === LANDING_CONTACT_ANCHOR)).toBe(true);
    expect(nodes.find((node) => node.id === LANDING_FORM_BLOCK_ID)?.props).toMatchObject({
      fields: ["nome", "email", "mensagem"],
      submitLabel: "Enviar mensagem",
    });
    // Nenhum texto legal é publicado sem revisão do proprietário.
    expect(JSON.stringify(document)).not.toMatch(/privacidade|termos de uso|lgpd/i);
  });

  it("cria o documento do template quando o tipo é LANDING", async () => {
    const { prisma, created } = prismaMock();
    const service = new SitesService(prisma);

    const site = await service.create(TENANT, "OWNER", { name: "Página da campanha", kind: "landing" });

    expect(site.kind).toBe("LANDING");
    expect(created.document.meta.type).toBe("landing");
    expect(created.document.root.children).toHaveLength(3);
    expect(prisma.siteDocument.create).toHaveBeenCalledTimes(1);
  });

  it("não sobrescreve documento importado de uma landing page", async () => {
    const { prisma, created } = prismaMock();
    const service = new SitesService(prisma);
    const imported = { version: 1, root: { id: "importado", type: "section", children: [] }, meta: { title: "Importado" } };

    await service.createWithDocument(TENANT, "OWNER", { name: "Campanha importada", kind: "LANDING" }, imported);

    expect(created.document).toBe(imported);
  });

  it("gera HTML publicável com a âncora do CTA e o formulário funcional", () => {
    const html = renderSiteHtml(
      landingDocument("Minha oferta", "#0e7a5c", "#6258df"),
      { name: "Minha oferta", slug: "minha-oferta" },
      { siteId: SITE, apiBase: "https://api.vexorasuite.com.br" },
    );

    expect(html).toContain(`id="${LANDING_CONTACT_ANCHOR}"`);
    expect(html).toContain(`href="#${LANDING_CONTACT_ANCHOR}"`);
    expect(html).toContain(`data-vx-block="${LANDING_FORM_BLOCK_ID}"`);
    expect(html).toContain('name="email" type="email"');
    expect(html).toContain("Enviar mensagem");
    expect(html).toContain("data-vx-endpoint=\"https://api.vexorasuite.com.br/api/public/sites/");
  });
});
