import { renderSiteHtml } from "./site-html";
import { renderDocumentFiles } from "./sites-deploy.service";

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

  it("gera index.html e arquivos por página a partir do documento salvo", () => {
    const text = (id: string, content: string) => ({ id, type: "text", props: { tag: "p", content }, styles: {}, children: [] });
    const document = {
      version: 1,
      root: { id: "root", type: "section", props: {}, styles: {}, children: [text("home", "Conteúdo da home")] },
      pages: [
        {
          slug: "servicos",
          title: "Serviços",
          kind: "content",
          root: { id: "servicos_root", type: "section", props: {}, styles: {}, children: [text("servicos_text", "Página de serviços")] },
        },
        {
          slug: "privacidade",
          title: "Política de Privacidade — rascunho",
          kind: "legal",
          root: { id: "privacidade_root", type: "section", props: {}, styles: {}, children: [text("privacidade_text", "Rascunho legal")] },
        },
        { slug: "../invalido", title: "Inválida", root: { id: "x", type: "section", props: {}, styles: {}, children: [] } },
      ],
      meta: { title: "Site", type: "static", theme: {} },
    };

    const files = renderDocumentFiles(
      document,
      { name: "Site", slug: "site" },
      { siteId: "11111111-1111-4111-8111-111111111111", apiBase: "https://api.vexorasuite.com.br" },
    );

    expect(files.map((file) => file.path)).toEqual(["index.html", "servicos/index.html", "privacidade/index.html"]);
    const home = Buffer.from(files[0]!.contentBase64, "base64").toString("utf8");
    const services = Buffer.from(files[1]!.contentBase64, "base64").toString("utf8");
    expect(home).toContain("Conteúdo da home");
    expect(home).not.toContain("Página de serviços");
    expect(services).toContain("<title>Serviços</title>");
    expect(services).toContain("Página de serviços");
    expect(services).not.toContain("Conteúdo da home");
  });

  it("omits blocks marked hidden in the layer tree", () => {
    const html = renderSiteHtml(
      {
        root: {
          type: "section",
          children: [
            { type: "text", props: { content: "Visível" } },
            { type: "text", props: { content: "Oculto", visible: false } },
          ],
        },
        meta: { title: "Site", theme: {} },
      },
      { name: "Site", slug: "site" },
    );
    expect(html).toContain("Visível");
    expect(html).not.toContain("Oculto");
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

  it("preserva apenas PNGs base64 inertes em imagens", () => {
    const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
    const svg = "data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+";
    const html = renderSiteHtml(
      {
        root: {
          type: "section",
          children: [
            { type: "image", props: { src: png, alt: "Ilustração" } },
            { type: "image", props: { src: svg, alt: "Ataque" } },
          ],
        },
        meta: { title: "Imagens", theme: {} },
      },
      { name: "Imagens", slug: "imagens" },
    );
    expect(html).toContain(`src="${png}"`);
    expect(html).not.toContain(svg);
    expect(html).toContain('src="#"');
  });
});
