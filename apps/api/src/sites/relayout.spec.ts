import { blueprintFor } from "./blueprint";
import { editableSitePages, parseSiteDesign, parseSitePage } from "./relayout";

const blueprint = blueprintFor("imobiliaria", "Exemplo", {
  primaryColor: "#112233", accentColor: "#ffffff", whatsapps: [], socials: [], dynamic: true,
});
const layout = {
  type: "layout",
  content: { background: "#112233", columns: [{ span: 12, elements: [{ type: "text", tag: "h1", text: "Direção editorial" }] }] },
};
const intro = { type: "richText", content: { title: "Introdução", body: "Conteúdo do briefing" } };

describe("layout gerado para Sites", () => {
  it("aplica composições e sequências diferentes no lugar dos blocos iniciais", () => {
    const pages = editableSitePages(blueprint);
    const design = (homeBlocks: unknown[]) => parseSiteDesign(JSON.stringify({
      pages: pages.map(page => ({ slug: page.slug, blocks: page.kind === "HOME" ? homeBlocks : [intro] })),
    }), blueprint);
    const editorial = design([layout, intro]);
    const compact = design([intro]);
    expect(editorial?.pages[0]?.blocks.map(block => block.type)).toEqual(["layout", "richText"]);
    expect(compact?.pages[0]?.blocks.map(block => block.type)).toEqual(["richText"]);
    expect(editorial?.pages.find(page => page.kind === "CONTACT")?.blocks).toEqual(blueprint.pages.find(page => page.kind === "CONTACT")?.blocks);
  });

  it("rejeita uma criação incompleta e layouts vazios", () => {
    expect(parseSiteDesign(JSON.stringify({ pages: [{ slug: "inicio", blocks: [layout] }] }), blueprint)).toBeNull();
    expect(parseSitePage(JSON.stringify({ blocks: [{ type: "layout", content: { columns: [] } }] }), [])).toBeNull();
  });

  it("preserva blocos funcionais e valida URLs e formas dos blocos", () => {
    const properties = { type: "properties", content: { title: "Imóveis disponíveis" } };
    const input = JSON.stringify({ blocks: [{ type: "hero", content: { headline: "Casa", ctaUrl: "javascript:alert(1)" } }] });
    const result = parseSitePage(input, [properties]);
    expect(result?.[0]?.content.ctaUrl).toBeUndefined();
    expect(result?.[1]).toEqual(properties);
    expect(parseSitePage(JSON.stringify({ blocks: [{ type: "services", content: { items: "texto" } }] }), [])).toBeNull();
  });
});
