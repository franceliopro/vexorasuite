/**
 * Template inicial de landing page para o criador de Sites.
 *
 * Uma landing page é um site de uma página com uma única chamada para ação: o
 * formulário de contato. O template usa somente blocos já suportados pelo editor
 * e pelo renderizador HTML, e o bloco do formulário tem ID estável para que a
 * identidade determinística (siteId + blockId) seja previsível desde a criação.
 *
 * Nenhum texto legal é inserido aqui: cláusulas, prazos e operadores precisam de
 * revisão jurídica do proprietário antes de aparecerem em uma página pública.
 */

type TemplateNode = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  styles: Record<string, string>;
  children: TemplateNode[];
};

export const LANDING_FORM_BLOCK_ID = "landing_form";
export const LANDING_CONTACT_ANCHOR = "landing-contato";

function node(
  id: string,
  type: string,
  props: Record<string, unknown> = {},
  styles: Record<string, string> = {},
  children: TemplateNode[] = [],
): TemplateNode {
  return { id, type, props, styles, children };
}

export function landingDocument(name: string, primary: string, accent: string) {
  return {
    version: 1,
    root: node("landing_root", "section", { padding: "0 1rem" }, {}, [
      node("landing_hero", "section", { padding: "4.5rem 1rem" }, { textAlign: "center" }, [
        node(
          "landing_hero_title",
          "text",
          { content: name, tag: "h1" },
          { fontSize: "2.5rem", fontWeight: "700", color: "var(--text, #101d33)" },
        ),
        node(
          "landing_hero_subtitle",
          "text",
          { content: "Apresente sua oferta em poucas palavras e mostre o resultado que você entrega.", tag: "p" },
          { fontSize: "1.125rem", maxWidth: "42rem", margin: "1rem auto" },
        ),
        node(
          "landing_hero_cta",
          "button",
          { label: "Falar com a gente", href: `#${LANDING_CONTACT_ANCHOR}` },
          {
            display: "inline-block",
            padding: "0.85rem 1.5rem",
            background: primary,
            color: "#ffffff",
            borderRadius: "0.5rem",
            textDecoration: "none",
            fontWeight: "600",
          },
        ),
      ]),
      node("landing_benefits", "section", { padding: "3rem 1rem" }, { maxWidth: "64rem", margin: "0 auto" }, [
        node("landing_benefits_title", "text", { content: "Por que escolher a gente?", tag: "h2" }, { fontSize: "1.75rem", fontWeight: "700" }),
        node(
          "landing_benefits_text",
          "text",
          { content: "Substitua este texto pelos principais benefícios do seu produto ou serviço.", tag: "p" },
          { fontSize: "1rem" },
        ),
      ]),
      node(
        "landing_contact",
        "section",
        { anchor: LANDING_CONTACT_ANCHOR, padding: "3.5rem 1rem", background: "#f6f7f4" },
        { maxWidth: "42rem", margin: "0 auto" },
        [
          node("landing_contact_title", "text", { content: "Vamos conversar?", tag: "h2" }, { fontSize: "1.75rem", fontWeight: "700" }),
          node("landing_contact_text", "text", { content: "Preencha os campos abaixo. Sua mensagem chega direto para a equipe.", tag: "p" }),
          node(
            LANDING_FORM_BLOCK_ID,
            "form",
            { fields: ["nome", "email", "mensagem"], submitLabel: "Enviar mensagem" },
            { display: "flex", flexDirection: "column", gap: "0.75rem" },
          ),
        ],
      ),
    ]),
    meta: {
      title: name,
      type: "landing",
      theme: {
        primary,
        secondary: accent,
        background: "#ffffff",
        text: "#101d33",
        fontHeading: "Inter",
        fontBody: "Inter",
      },
    },
  };
}
