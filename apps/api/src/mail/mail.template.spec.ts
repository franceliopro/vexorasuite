import { escapeHtml, renderEmail } from "./mail.template";

describe("mail template", () => {
  it("escapes interpolated text instead of injecting markup", () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
    const { html } = renderEmail({
      title: "Olá <script>alert(1)</script>",
      intro: "Texto & cia",
      paragraphs: ["<b>negrito</b>"],
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Texto &amp; cia");
  });

  it("renders the action link in the html and the text fallback", () => {
    const { html, text } = renderEmail({
      title: "Redefinir senha",
      intro: "Recebemos um pedido.",
      action: { label: "Criar nova senha", url: "https://app.exemplo.com/redefinir?token=abc" },
      footnote: "Expira em 30 minutos.",
    });
    expect(html).toContain('href="https://app.exemplo.com/redefinir?token=abc"');
    expect(html).toContain("Criar nova senha");
    expect(text).toContain("Criar nova senha: https://app.exemplo.com/redefinir?token=abc");
    expect(text).toContain("Expira em 30 minutos.");
    // The plain-text part must exist for clients that block HTML.
    expect(text).toContain("Redefinir senha");
  });

  it("omits the button block when there is no action", () => {
    const { html, text } = renderEmail({ title: "Aviso", intro: "Sem link." });
    expect(html).not.toContain("<a href=");
    expect(text).not.toContain(": http");
  });
});
