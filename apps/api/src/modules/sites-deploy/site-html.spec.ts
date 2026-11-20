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
});
