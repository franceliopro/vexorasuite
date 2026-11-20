import { elementorConversion, htmlToDocument } from "./html-to-document";

describe("HTML para SiteDocument", () => {
  it("converte conteúdo comum e remove URLs executáveis", () => {
    const result = htmlToDocument(
      `<html><head><title>Minha Loja</title></head><body>
        <h1>Bem-vindo</h1><p>Texto de apresentação</p>
        <img src="/foto.jpg" alt="Foto">
        <a href="javascript:alert(1)">Clique</a>
        <script>alert(1)</script>
      </body></html>`,
      { baseUrl: "https://exemplo.com.br/" },
    );

    const textos = result.document.root.children.flatMap((node) =>
      node.type === "text" ? [String(node.props.content)] : [],
    );
    expect(result.document.meta.title).toBe("Minha Loja");
    expect(textos).toEqual(expect.arrayContaining(["Bem-vindo", "Texto de apresentação"]));
    expect(result.document.root.children.some((node) => node.type === "image")).toBe(true);
    const link = result.document.root.children.find((node) => node.type === "button");
    expect(link?.props.href).toBe("#");
    expect(JSON.stringify(result.document)).not.toContain("<script");
    expect(result.warnings.join(" ")).toMatch(/esquema não seguro/);
  });

  it(" reconhece widgets do Elementor", () => {
    const result = elementorConversion(
      {
        content: [
          { elType: "widget", widgetType: "heading", settings: { title: "Título do Elementor", header_size: "h2" } },
          { elType: "widget", widgetType: "button", settings: { text: "Comprar", link: { url: "https://loja.com.br" } } },
        ],
      },
      "Loja importada",
      "ecommerce",
    );
    const text = result.document.root.children.find((node) => node.type === "text");
    const button = result.document.root.children.find((node) => node.type === "button");
    expect(text?.props).toMatchObject({ content: "Título do Elementor", tag: "h2" });
    expect(button?.props.label).toBe("Comprar");
    expect(result.document.meta.type).toBe("ecommerce");
  });

  it("lê shortcodes do Divi e widgets Crocoblock/Beaver", () => {
    const divi = htmlToDocument(
      `[et_pb_text]Conteúdo do Divi[/et_pb_text][et_pb_button button_url="https://exemplo.com"]Saiba mais[/et_pb_button]`,
    );
    expect(divi.document.root.children.some((node) => node.type === "text")).toBe(true);
    expect(divi.document.root.children.some((node) => node.type === "button")).toBe(true);

    const builders = htmlToDocument(
      `<div class="elementor-element" data-widget_type="jet-listing.default"><div>Lista</div></div>
       <div class="fl-module fl-module-form"><form><input name="email"></form></div>`,
    );
    expect(builders.document.root.children.some((node) => node.type === "post-list")).toBe(true);
    expect(builders.document.root.children.some((node) => node.type === "form")).toBe(true);
  });

  it("transforma links do YouTube em embed", () => {
    const result = htmlToDocument(`<iframe src="https://www.youtube.com/watch?v=abc123"></iframe>`);
    const video = result.document.root.children.find((node) => node.type === "video");
    expect(video?.props.src).toBe("https://www.youtube.com/embed/abc123");
  });
});
