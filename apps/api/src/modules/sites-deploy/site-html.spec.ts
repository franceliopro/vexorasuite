import { renderSiteHtml } from "./site-html";

describe("static site HTML renderer", () => {
  it("escapes user content and rejects executable URLs", () => {
    const document = {
      version: 1,
      root: {
        id: "root",
        type: "section",
        props: {},
        styles: {},
        children: [
          {
            id: "x",
            type: "text",
            props: { tag: "h1", content: '<img src=x onerror="alert(1)">' },
            styles: {},
            children: [],
          },
          {
            id: "y",
            type: "button",
            props: { label: "Clique", href: "javascript:alert(1)" },
            styles: {},
            children: [],
          },
        ],
      },
      meta: { title: "Loja & Serviços", type: "static", theme: {} },
    };

    const html = renderSiteHtml(document, { name: "Loja", slug: "loja" });

    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).not.toContain("<img src=x onerror");
    expect(html).toContain('href="#"');
    expect(html).not.toContain("javascript:");
    expect(html).toContain("Loja &amp; Serviços");
  });

  it("converts YouTube links into privacy-friendly embeds", () => {
    const document = {
      root: {
        type: "section",
        children: [{ type: "video", props: { src: "https://www.youtube.com/watch?v=abc123" } }],
      },
      meta: { title: "Vídeos", theme: {} },
    };
    const html = renderSiteHtml(document, { name: "Vídeos", slug: "videos" });
    expect(html).toContain("https://www.youtube.com/embed/abc123");
  });

  it("renders the document rather than trusting client-supplied files", () => {
    const html = renderSiteHtml(
      {
        root: { type: "section", children: [{ type: "text", props: { content: "Conteúdo salvo" } }] },
        meta: { title: "Rascunho", theme: {} },
      },
      { name: "Rascunho", slug: "rascunho", primaryColor: "#123456" },
    );
    expect(html).toContain("Conteúdo salvo");
    expect(html).toContain("--primary:#123456");
  });

  it("wire published forms to the public API with normalized field names", () => {
    const html = renderSiteHtml(
      {
        root: {
          id: "root",
          type: "section",
          children: [
            {
              id: "bloco_contato",
              type: "form",
              props: { fields: ["Nome completo", "E-mail", "Mensagem"], submitLabel: "Enviar agora" },
              styles: {},
              children: [],
            },
          ],
        },
        meta: { title: "Contato", theme: {} },
      },
      { name: "Contato", slug: "contato" },
      { siteId: "11111111-1111-4111-8111-111111111111", apiBase: "https://api.vexorasuite.com.br/" },
    );

    expect(html).toContain('name="nome_completo"');
    expect(html).toContain('name="e_mail" type="email"');
    expect(html).toContain('name="mensagem"');
    expect(html).toContain('name="website"');
    expect(html).toContain("Enviar agora");
    expect(html).toContain("/api/public/sites/11111111-1111-4111-8111-111111111111/forms");
    expect(html).toContain('data-vx-block="bloco_contato"');
    expect(html).toContain("URLSearchParams");
    expect(html).toContain("application/x-www-form-urlencoded");
    expect(html).not.toContain("será ativado em uma próxima etapa");
  });

  it("does not promise submissions when the API base is missing", () => {
    const html = renderSiteHtml(
      { root: { type: "form", id: "f1", props: { fields: ["nome"] }, styles: {}, children: [] }, meta: {} },
      { name: "Site", slug: "site" },
    );
    expect(html).toContain("disabled");
    expect(html).toContain("não foi configurada nesta instalação");
    expect(html).not.toContain("URLSearchParams");
  });
});
