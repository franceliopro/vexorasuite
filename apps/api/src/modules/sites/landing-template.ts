/**
 * Template premium de landing page para o criador de Sites.
 *
 * A estrutura cobre os blocos de uma landing de alta conversão: header enxuto,
 * hero com chamada primária e secundária, faixa de autoridade, serviços,
 * benefícios, metodologia, comparação sutil, depoimentos, sobre, FAQ acordeão,
 * contato e rodapé. Tudo é montado apenas com blocos suportados pelo editor e
 * pelo renderizador HTML, com estilos inline responsivos (auto-fit + clamp).
 *
 * Fotos, logos, números de impacto, depoimentos, endereço, CNPJ e textos legais
 * não são inventados. O template reserva esses espaços com textos honestos para
 * que o proprietário preencha e revise antes de publicar.
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

const INK = "#101d33";
const MUTED = "#5c6677";
const LINE = "#e5e8ef";
const SURFACE = "#ffffff";
const SOFT = "#f5f7fb";

function node(
  id: string,
  type: string,
  props: Record<string, unknown> = {},
  styles: Record<string, string> = {},
  children: TemplateNode[] = [],
): TemplateNode {
  return { id, type, props, styles, children };
}

function eyebrowStyles(onDark = false): Record<string, string> {
  return {
    color: onDark ? "rgba(255,255,255,0.75)" : "var(--primary, #0e7a5c)",
    fontSize: "0.75rem",
    fontWeight: "700",
    letterSpacing: "0.16em",
    textTransform: "uppercase",
  };
}

function headingStyles(size = "clamp(2rem, 4vw, 3rem)", onDark = false): Record<string, string> {
  return {
    color: onDark ? "#ffffff" : INK,
    fontSize: size,
    fontWeight: "700",
    letterSpacing: "-0.035em",
    lineHeight: "1.1",
    margin: "0.75rem 0 1rem",
  };
}

function cardStyles(): Record<string, string> {
  return {
    background: SURFACE,
    border: `1px solid ${LINE}`,
    borderRadius: "1.25rem",
    boxShadow: "0 18px 50px rgba(16,29,51,0.06)",
    display: "flex",
    flexDirection: "column",
    gap: "0.6rem",
    padding: "1.6rem",
  };
}

function linkStyles(): Record<string, string> {
  return {
    color: "var(--primary, #0e7a5c)",
    display: "inline-block",
    fontSize: "0.9rem",
    fontWeight: "700",
    marginTop: "0.35rem",
    textDecoration: "none",
  };
}

function featureCard(
  id: string,
  index: string,
  title: string,
  text: string,
  primary: string,
  withLink = false,
): TemplateNode {
  const children: TemplateNode[] = [
    node(`${id}_index`, "text", { content: index, tag: "span" }, {
      color: primary,
      fontSize: "0.75rem",
      fontWeight: "700",
      letterSpacing: "0.14em",
    }),
    node(`${id}_title`, "text", { content: title, tag: "h3" }, {
      color: INK,
      fontSize: "1.125rem",
      fontWeight: "700",
      margin: "0",
    }),
    node(`${id}_text`, "text", { content: text, tag: "p" }, {
      color: MUTED,
      fontSize: "0.95rem",
      lineHeight: "1.6",
      margin: "0",
    }),
  ];
  if (withLink) {
    children.push(node(`${id}_link`, "button", {
      label: "Saiba mais",
      href: `#${LANDING_CONTACT_ANCHOR}`,
    }, linkStyles()));
  }
  return node(id, "container", {}, cardStyles(), children);
}

function proofSlot(id: string, title: string, text: string): TemplateNode {
  return node(id, "container", {}, {
    background: SURFACE,
    border: `1px solid ${LINE}`,
    borderRadius: "1rem",
    display: "grid",
    gap: "0.3rem",
    padding: "1.15rem",
  }, [
    node(`${id}_title`, "text", { content: title, tag: "span" }, {
      color: INK,
      fontSize: "0.95rem",
      fontWeight: "700",
    }),
    node(`${id}_text`, "text", { content: text, tag: "span" }, {
      color: MUTED,
      fontSize: "0.85rem",
      lineHeight: "1.5",
    }),
  ]);
}

function compareRow(id: string, ours: string, common: string): TemplateNode {
  return node(id, "container", {}, {
    borderBottom: `1px solid ${LINE}`,
    display: "grid",
    gap: "1rem",
    gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))",
    padding: "1.1rem 0",
  }, [
    node(`${id}_ours`, "text", { content: ours, tag: "span" }, {
      color: INK,
      fontSize: "0.95rem",
      fontWeight: "700",
    }),
    node(`${id}_common`, "text", { content: common, tag: "span" }, {
      color: MUTED,
      fontSize: "0.95rem",
    }),
  ]);
}

function faqItem(id: string, question: string, answer: string): TemplateNode {
  return node(id, "faq", { question, answer }, {
    background: SURFACE,
    borderBottom: `1px solid ${LINE}`,
    padding: "1.1rem 0",
  });
}

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "VX"
  );
}

export function landingDocument(name: string, primary: string, accent: string, logoUrl?: string | null) {
  const logoChildren: TemplateNode[] = logoUrl
    ? [
        node("landing_logo_image", "image", {
          src: logoUrl,
          alt: `Logo de ${name}`,
        }, {
          height: "2.5rem",
          maxWidth: "10rem",
          objectFit: "contain",
          width: "auto",
        }),
      ]
    : [
        node("landing_logo_fake_mark", "text", { content: initials(name), tag: "span" }, {
          alignItems: "center",
          background: `linear-gradient(135deg, ${primary}, ${accent})`,
          borderRadius: "0.65rem",
          color: "#ffffff",
          display: "inline-flex",
          fontSize: "0.85rem",
          fontWeight: "700",
          height: "2.5rem",
          justifyContent: "center",
          letterSpacing: "0.04em",
          width: "2.5rem",
        }),
        node("landing_logo_fake_label", "text", { content: "LOGO PROVISÓRIO", tag: "span" }, {
          color: MUTED,
          fontSize: "0.625rem",
          fontWeight: "700",
          letterSpacing: "0.12em",
        }),
      ];
  const brandNode = node("landing_brand_wrap", "container", {}, {
    alignItems: "center",
    display: "flex",
    gap: "0.6rem",
  }, [
    ...logoChildren,
    node("landing_brand", "text", { content: name, tag: "span" }, {
      color: INK,
      fontSize: "1.1rem",
      fontWeight: "700",
      letterSpacing: "-0.02em",
    }),
  ]);
  const heroButton: Record<string, string> = {
    background: primary,
    borderRadius: "0.85rem",
    color: "#ffffff",
    display: "inline-block",
    fontSize: "1rem",
    fontWeight: "700",
    padding: "1rem 1.75rem",
    textDecoration: "none",
  };
  const heroSecondary: Record<string, string> = {
    border: `1px solid ${LINE}`,
    borderRadius: "0.85rem",
    color: INK,
    display: "inline-block",
    fontSize: "1rem",
    fontWeight: "700",
    padding: "1rem 1.5rem",
    textDecoration: "none",
  };

  return {
    version: 1,
    root: node("landing_root", "section", { padding: "0" }, {
      background: SOFT,
      color: INK,
      fontFamily: "Inter, system-ui, sans-serif",
    }, [
      node("landing_nav", "section", { padding: "1.1rem clamp(1rem, 5vw, 4rem)" }, {
        alignItems: "center",
        background: SURFACE,
        borderBottom: `1px solid ${LINE}`,
        display: "flex",
        flexWrap: "wrap",
        gap: "1rem",
        justifyContent: "space-between",
      }, [
        brandNode,
        node("landing_nav_links", "container", {}, {
          alignItems: "center",
          display: "flex",
          flexWrap: "wrap",
          gap: "1.25rem",
        }, [
          node("landing_nav_services", "button", { label: "Serviços", href: "/servicos/" }, linkStyles()),
          node("landing_nav_process", "button", { label: "Como funciona", href: "/#como-funciona" }, linkStyles()),
          node("landing_nav_faq", "button", { label: "FAQ", href: "/faq/" }, linkStyles()),
          node("landing_nav_cta", "button", {
            label: "Falar com a gente",
            href: `#${LANDING_CONTACT_ANCHOR}`,
          }, {
            background: primary,
            borderRadius: "999px",
            color: "#ffffff",
            display: "inline-block",
            fontSize: "0.875rem",
            fontWeight: "700",
            padding: "0.65rem 1.2rem",
            textDecoration: "none",
          }),
        ]),
      ]),
      node("landing_hero", "section", {
        padding: "clamp(3.5rem, 8vw, 7rem) clamp(1rem, 6vw, 5rem)",
      }, {
        alignItems: "center",
        display: "grid",
        gap: "clamp(2rem, 5vw, 5rem)",
        gridTemplateColumns: "repeat(auto-fit, minmax(20rem, 1fr))",
        margin: "0 auto",
        maxWidth: "78rem",
      }, [
        node("landing_hero_copy", "container", {}, {}, [
          node("landing_hero_eyebrow", "text", {
            content: "UMA EXPERIÊNCIA FEITA PARA GERAR CONFIANÇA",
            tag: "span",
          }, eyebrowStyles()),
          node("landing_hero_title", "text", { content: name, tag: "h1" }, {
            color: INK,
            fontSize: "clamp(2.5rem, 5vw, 4.25rem)",
            fontWeight: "700",
            letterSpacing: "-0.045em",
            lineHeight: "1.05",
            margin: "1rem 0",
          }),
          node("landing_hero_subtitle", "text", {
            content: "Do primeiro contato ao resultado, uma experiência simples, clara e feita para gerar confiança.",
            tag: "p",
          }, {
            color: MUTED,
            fontSize: "clamp(1.05rem, 2vw, 1.25rem)",
            lineHeight: "1.7",
            margin: "0 0 2rem",
            maxWidth: "38rem",
          }),
          node("landing_hero_actions", "container", {}, {
            alignItems: "center",
            display: "flex",
            flexWrap: "wrap",
            gap: "0.85rem",
          }, [
            node("landing_hero_cta", "button", {
              label: "Falar com a gente",
              href: `#${LANDING_CONTACT_ANCHOR}`,
            }, heroButton),
            node("landing_hero_secondary", "button", {
              label: "Ver serviços",
              href: "/servicos/",
            }, heroSecondary),
          ]),
          node("landing_hero_note", "text", {
            content: "Um primeiro contato simples, sem compromisso.",
            tag: "span",
          }, { color: MUTED, display: "block", fontSize: "0.9rem", marginTop: "1.25rem" }),
        ]),
        node("landing_hero_panel", "section", {
          padding: "clamp(1.75rem, 4vw, 3rem)",
        }, {
          background: `linear-gradient(135deg, ${primary}, ${accent})`,
          borderRadius: "1.75rem",
          boxShadow: "0 30px 70px rgba(16,29,51,0.18)",
          color: "#ffffff",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          minHeight: "22rem",
        }, [
          node("landing_panel_kicker", "text", {
            content: "COMO TRABALHAMOS",
            tag: "span",
          }, eyebrowStyles(true)),
          node("landing_panel_title", "text", {
            content: "Clareza em cada etapa. Atenção em cada detalhe.",
            tag: "h2",
          }, {
            color: "#ffffff",
            fontSize: "clamp(1.6rem, 3vw, 2.25rem)",
            fontWeight: "700",
            letterSpacing: "-0.03em",
            lineHeight: "1.15",
            margin: "1.5rem 0 2rem",
          }),
          node("landing_panel_steps", "container", {}, { display: "grid", gap: "0.9rem" }, [
            node("landing_panel_step_1", "container", {}, {
              alignItems: "center",
              borderBottom: "1px solid rgba(255,255,255,0.2)",
              display: "flex",
              gap: "0.9rem",
              paddingBottom: "0.9rem",
            }, [
              node("landing_panel_step_1_number", "text", { content: "01", tag: "span" }, {
                color: "rgba(255,255,255,0.7)",
                fontSize: "0.75rem",
                fontWeight: "700",
              }),
              node("landing_panel_step_1_title", "text", { content: "Diagnóstico", tag: "span" }, {
                color: "#ffffff",
                fontSize: "0.95rem",
                fontWeight: "700",
              }),
            ]),
            node("landing_panel_step_2", "container", {}, {
              alignItems: "center",
              borderBottom: "1px solid rgba(255,255,255,0.2)",
              display: "flex",
              gap: "0.9rem",
              paddingBottom: "0.9rem",
            }, [
              node("landing_panel_step_2_number", "text", { content: "02", tag: "span" }, {
                color: "rgba(255,255,255,0.7)",
                fontSize: "0.75rem",
                fontWeight: "700",
              }),
              node("landing_panel_step_2_title", "text", { content: "Proposta", tag: "span" }, {
                color: "#ffffff",
                fontSize: "0.95rem",
                fontWeight: "700",
              }),
            ]),
            node("landing_panel_step_3", "container", {}, {
              alignItems: "center",
              display: "flex",
              gap: "0.9rem",
            }, [
              node("landing_panel_step_3_number", "text", { content: "03", tag: "span" }, {
                color: "rgba(255,255,255,0.7)",
                fontSize: "0.75rem",
                fontWeight: "700",
              }),
              node("landing_panel_step_3_title", "text", { content: "Acompanhamento", tag: "span" }, {
                color: "#ffffff",
                fontSize: "0.95rem",
                fontWeight: "700",
              }),
            ]),
          ]),
        ]),
      ]),
      node("landing_proof", "section", {
        padding: "2rem clamp(1rem, 6vw, 5rem)",
      }, {
        background: SURFACE,
        borderBottom: `1px solid ${LINE}`,
        borderTop: `1px solid ${LINE}`,
      }, [
        node("landing_proof_inner", "container", {}, { margin: "0 auto", maxWidth: "78rem" }, [
          node("landing_proof_eyebrow", "text", { content: "AUTORIDADE E CONFIANÇA", tag: "span" }, eyebrowStyles()),
          node("landing_proof_note", "text", {
            content: "Espaço reservado para selos, números e avaliações reais.",
            tag: "p",
          }, { color: MUTED, fontSize: "0.95rem", margin: "0.5rem 0 1.5rem" }),
          node("landing_proof_grid", "container", {}, {
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))",
          }, [
            proofSlot("landing_proof_1", "Selos e parcerias", "Inserir logos ou certificações verídicas."),
            proofSlot("landing_proof_2", "Números de impacto", "Inserir métricas verificáveis e sua origem."),
            proofSlot("landing_proof_3", "Avaliações", "Inserir nota real e plataforma de origem."),
          ]),
        ]),
      ]),
      node("landing_services", "section", {
        anchor: "servicos",
        padding: "clamp(3.5rem, 8vw, 6rem) clamp(1rem, 6vw, 5rem)",
      }, { background: SURFACE, borderBottom: `1px solid ${LINE}` }, [
        node("landing_services_inner", "container", {}, { margin: "0 auto", maxWidth: "78rem" }, [
          node("landing_services_eyebrow", "text", { content: "O QUE FAZEMOS", tag: "span" }, eyebrowStyles()),
          node("landing_services_title", "text", { content: "Soluções para o que você precisa", tag: "h2" }, headingStyles()),
          node("landing_services_text", "text", {
            content: "Três frentes claras, cada uma com um próximo passo simples.",
            tag: "p",
          }, { color: MUTED, fontSize: "1.05rem", lineHeight: "1.7", margin: "0", maxWidth: "42rem" }),
          node("landing_services_grid", "container", {}, {
            display: "grid",
            gap: "1.25rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(15rem, 1fr))",
            marginTop: "2.5rem",
          }, [
            featureCard("landing_service_1", "01", "Consultoria inicial", "Entendemos o contexto e o resultado esperado.", primary, true),
            featureCard("landing_service_2", "02", "Soluções sob medida", "Uma proposta alinhada ao que realmente importa.", primary, true),
            featureCard("landing_service_3", "03", "Acompanhamento", "Ajustes e dúvidas tratados ao longo do caminho.", primary, true),
          ]),
        ]),
      ]),
      node("landing_benefits", "section", {
        padding: "clamp(3.5rem, 8vw, 6rem) clamp(1rem, 6vw, 5rem)",
      }, { margin: "0 auto", maxWidth: "78rem" }, [
        node("landing_benefits_eyebrow", "text", { content: "POR QUE ESCOLHER", tag: "span" }, eyebrowStyles()),
        node("landing_benefits_title", "text", {
          content: "Por que escolher a gente?",
          tag: "h2",
        }, headingStyles()),
        node("landing_benefits_text", "text", {
          content: "Cada seção foi pensada para comunicar valor com clareza e conduzir o visitante ao próximo passo.",
          tag: "p",
        }, { color: MUTED, fontSize: "1.05rem", lineHeight: "1.7", margin: "0", maxWidth: "42rem" }),
        node("landing_benefits_grid", "container", {}, {
          display: "grid",
          gap: "1.25rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(15rem, 1fr))",
          marginTop: "2.5rem",
        }, [
          featureCard("landing_benefit_1", "01", "Atendimento próximo", "Ouvimos o que você precisa antes de sugerir qualquer caminho.", primary),
          featureCard("landing_benefit_2", "02", "Comunicação clara", "Informação objetiva, sem termos difíceis e sem surpresas.", primary),
          featureCard("landing_benefit_3", "03", "Atenção aos detalhes", "Do primeiro contato ao acompanhamento, cada etapa é cuidada.", primary),
        ]),
      ]),
      node("landing_process", "section", {
        anchor: "como-funciona",
        padding: "clamp(3.5rem, 8vw, 6rem) clamp(1rem, 6vw, 5rem)",
      }, {
        background: SURFACE,
        borderBottom: `1px solid ${LINE}`,
        borderTop: `1px solid ${LINE}`,
      }, [
        node("landing_process_inner", "container", {}, { margin: "0 auto", maxWidth: "78rem" }, [
          node("landing_process_eyebrow", "text", { content: "COMO FUNCIONA", tag: "span" }, eyebrowStyles()),
          node("landing_process_title", "text", { content: "Um caminho simples, do início ao fim", tag: "h2" }, headingStyles()),
          node("landing_process_text", "text", {
            content: "Você sabe o que esperar em cada momento — e pode seguir no seu ritmo.",
            tag: "p",
          }, { color: MUTED, fontSize: "1.05rem", lineHeight: "1.7", margin: "0", maxWidth: "42rem" }),
          node("landing_process_grid", "container", {}, {
            display: "grid",
            gap: "1.25rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(15rem, 1fr))",
            marginTop: "2.5rem",
          }, [
            featureCard("landing_step_1", "01", "Conversa inicial", "Conte o contexto e o resultado que você espera alcançar.", primary),
            featureCard("landing_step_2", "02", "Alinhamento", "Receba uma proposta clara, com escopo e próximos passos.", primary),
            featureCard("landing_step_3", "03", "Acompanhamento", "Siga com orientação e espaço para ajustar o que for preciso.", primary),
          ]),
        ]),
      ]),
      node("landing_compare", "section", {
        padding: "clamp(3.5rem, 8vw, 6rem) clamp(1rem, 6vw, 5rem)",
      }, { margin: "0 auto", maxWidth: "78rem" }, [
        node("landing_compare_eyebrow", "text", { content: "NOSSA ENTREGA", tag: "span" }, eyebrowStyles()),
        node("landing_compare_title", "text", { content: "Organização que você percebe", tag: "h2" }, headingStyles()),
        node("landing_compare_header", "container", {}, {
          borderBottom: `1px solid ${LINE}`,
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))",
          paddingBottom: "0.75rem",
        }, [
          node("landing_compare_ours_label", "text", { content: "Com a gente", tag: "span" }, {
            color: INK,
            fontSize: "0.85rem",
            fontWeight: "700",
          }),
          node("landing_compare_common_label", "text", { content: "Processo comum", tag: "span" }, {
            color: MUTED,
            fontSize: "0.85rem",
          }),
        ]),
        node("landing_compare_rows", "container", {}, {}, [
          compareRow("landing_compare_1", "Alinhamento antes de executar", "Mudanças sem alinhamento prévio"),
          compareRow("landing_compare_2", "Escopo e prazos combinados", "Prazos implícitos"),
          compareRow("landing_compare_3", "Acompanhamento após a entrega", "Contato encerrado na entrega"),
        ]),
      ]),
      node("landing_testimonials", "section", {
        padding: "clamp(3.5rem, 8vw, 6rem) clamp(1rem, 6vw, 5rem)",
      }, {
        background: SURFACE,
        borderBottom: `1px solid ${LINE}`,
        borderTop: `1px solid ${LINE}`,
      }, [
        node("landing_testimonials_inner", "container", {}, { margin: "0 auto", maxWidth: "78rem" }, [
          node("landing_testimonials_eyebrow", "text", { content: "DEPOIMENTOS", tag: "span" }, eyebrowStyles()),
          node("landing_testimonials_title", "text", { content: "Quem confia, conta a experiência", tag: "h2" }, headingStyles()),
          node("landing_testimonials_grid", "container", {}, {
            display: "grid",
            gap: "1.25rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(18rem, 1fr))",
            marginTop: "2.5rem",
          }, [
            node("landing_testimonial_1", "container", {}, cardStyles(), [
              node("landing_testimonial_1_title", "text", { content: "Depoimento real", tag: "span" }, {
                color: INK,
                fontSize: "1rem",
                fontWeight: "700",
              }),
              node("landing_testimonial_1_text", "text", {
                content: "Inclua foto, nome completo e cargo ou empresa da pessoa citada.",
                tag: "p",
              }, { color: MUTED, fontSize: "0.95rem", lineHeight: "1.6", margin: "0" }),
            ]),
            node("landing_testimonial_2", "container", {}, cardStyles(), [
              node("landing_testimonial_2_title", "text", { content: "Resultado verificável", tag: "span" }, {
                color: INK,
                fontSize: "1rem",
                fontWeight: "700",
              }),
              node("landing_testimonial_2_text", "text", {
                content: "Inclua um print ou número real, com a origem identificada.",
                tag: "p",
              }, { color: MUTED, fontSize: "0.95rem", lineHeight: "1.6", margin: "0" }),
            ]),
          ]),
        ]),
      ]),
      node("landing_about", "section", {
        padding: "clamp(3.5rem, 8vw, 6rem) clamp(1rem, 6vw, 5rem)",
      }, { margin: "0 auto", maxWidth: "78rem" }, [
        node("landing_about_grid", "container", {}, {
          alignItems: "center",
          display: "grid",
          gap: "clamp(2rem, 5vw, 4rem)",
          gridTemplateColumns: "repeat(auto-fit, minmax(20rem, 1fr))",
        }, [
          node("landing_about_copy", "container", {}, {}, [
            node("landing_about_eyebrow", "text", { content: "SOBRE", tag: "span" }, eyebrowStyles()),
            node("landing_about_title", "text", { content: "Pessoas antes de processos", tag: "h2" }, headingStyles()),
            node("landing_about_text", "text", {
              content: "Acreditamos que um bom atendimento começa com escuta, clareza e respeito pelo tempo de cada pessoa. É assim que construímos relações que continuam depois da primeira entrega.",
              tag: "p",
            }, { color: MUTED, fontSize: "1.05rem", lineHeight: "1.8", margin: "0 0 1rem" }),
            node("landing_about_values", "text", {
              content: "Escuta atenta · Transparência · Acompanhamento",
              tag: "span",
            }, { color: INK, fontSize: "0.95rem", fontWeight: "700" }),
          ]),
          node("landing_about_visual", "section", {
            padding: "clamp(2rem, 5vw, 3.5rem)",
          }, {
            background: `linear-gradient(135deg, ${accent}, ${primary})`,
            borderRadius: "1.5rem",
            color: "#ffffff",
            minHeight: "18rem",
          }, [
            node("landing_about_visual_label", "text", {
              content: "FOTO REAL DA EQUIPE OU DO ESPAÇO",
              tag: "span",
            }, eyebrowStyles(true)),
            node("landing_about_visual_text", "text", {
              content: "Adicione aqui uma imagem exclusiva da sua operação.",
              tag: "p",
            }, { color: "#ffffff", fontSize: "1.25rem", fontWeight: "700", lineHeight: "1.4", margin: "1rem 0 0" }),
          ]),
        ]),
      ]),
      node("landing_faq", "section", {
        anchor: "faq",
        padding: "clamp(3.5rem, 8vw, 6rem) clamp(1rem, 6vw, 5rem)",
      }, {
        background: SURFACE,
        borderBottom: `1px solid ${LINE}`,
        borderTop: `1px solid ${LINE}`,
      }, [
        node("landing_faq_inner", "container", {}, { margin: "0 auto", maxWidth: "48rem" }, [
          node("landing_faq_eyebrow", "text", { content: "PERGUNTAS FREQUENTES", tag: "span" }, eyebrowStyles()),
          node("landing_faq_title", "text", { content: "Dúvidas comuns, respondidas", tag: "h2" }, headingStyles()),
          faqItem(
            "landing_faq_1",
            "Como faço para falar com a equipe?",
            "Preencha o formulário de contato com o que você precisa. A equipe responde com as informações e os próximos passos.",
          ),
          faqItem(
            "landing_faq_2",
            "Posso ajustar algo durante o processo?",
            "Sim. Combine os ajustes no contato e acompanhe cada etapa antes da conclusão.",
          ),
          faqItem(
            "landing_faq_3",
            "Onde encontro mais informações?",
            "As seções Serviços e Como funciona reúnem o essencial. Se ficar alguma dúvida, use o formulário no final da página.",
          ),
        ]),
      ]),
      node("landing_contact", "section", {
        anchor: LANDING_CONTACT_ANCHOR,
        padding: "clamp(3.5rem, 8vw, 6rem) clamp(1rem, 6vw, 5rem)",
      }, { background: INK, color: "#ffffff" }, [
        node("landing_contact_grid", "container", {}, {
          alignItems: "start",
          display: "grid",
          gap: "clamp(2rem, 5vw, 5rem)",
          gridTemplateColumns: "repeat(auto-fit, minmax(20rem, 1fr))",
          margin: "0 auto",
          maxWidth: "72rem",
        }, [
          node("landing_contact_copy", "container", {}, {}, [
            node("landing_contact_eyebrow", "text", { content: "ÚLTIMO PASSO", tag: "span" }, eyebrowStyles(true)),
            node("landing_contact_title", "text", { content: "Vamos conversar?", tag: "h2" }, headingStyles("clamp(2rem, 4vw, 3rem)", true)),
            node("landing_contact_text", "text", {
              content: "Preencha os campos e conte um pouco sobre o que você precisa.",
              tag: "p",
            }, { color: "rgba(255,255,255,0.75)", fontSize: "1.05rem", lineHeight: "1.7", margin: "0" }),
            node("landing_contact_points", "container", {}, { display: "grid", gap: "0.7rem", marginTop: "2rem" }, [
              node("landing_contact_point_1", "text", { content: "Um formulário curto, só com o essencial.", tag: "span" }, {
                color: "rgba(255,255,255,0.85)",
                fontSize: "0.95rem",
              }),
              node("landing_contact_point_2", "text", { content: "Atenção ao seu caso desde a primeira mensagem.", tag: "span" }, {
                color: "rgba(255,255,255,0.85)",
                fontSize: "0.95rem",
              }),
            ]),
          ]),
          node("landing_form_card", "section", {
            padding: "clamp(1.5rem, 4vw, 2.5rem)",
          }, {
            background: SURFACE,
            borderRadius: "1.5rem",
            boxShadow: "0 30px 70px rgba(0,0,0,0.25)",
            color: INK,
          }, [
            node("landing_form_title", "text", { content: "Conte o que você precisa", tag: "h3" }, {
              color: INK,
              fontSize: "1.25rem",
              fontWeight: "700",
              margin: "0 0 1.25rem",
            }),
            node(LANDING_FORM_BLOCK_ID, "form", {
              fields: ["nome", "email", "mensagem"],
              submitLabel: "Enviar mensagem",
            }, { display: "flex", flexDirection: "column", gap: "0.9rem" }),
          ]),
        ]),
      ]),
      node("landing_footer", "section", {
        padding: "1.75rem clamp(1rem, 6vw, 5rem)",
      }, { background: SURFACE, borderTop: `1px solid ${LINE}` }, [
        node("landing_footer_inner", "container", {}, {
          alignItems: "center",
          color: MUTED,
          display: "flex",
          flexWrap: "wrap",
          fontSize: "0.875rem",
          gap: "0.75rem",
          justifyContent: "space-between",
          margin: "0 auto",
          maxWidth: "78rem",
        }, [
          node("landing_footer_brand", "text", { content: name, tag: "span" }, {
            color: INK,
            fontWeight: "700",
          }),
          node("landing_footer_links", "container", {}, {
            display: "flex",
            flexWrap: "wrap",
            gap: "1rem",
          }, [
            node("landing_footer_services", "button", { label: "Serviços", href: "/servicos/" }, linkStyles()),
            node("landing_footer_process", "button", { label: "Como funciona", href: "/#como-funciona" }, linkStyles()),
            node("landing_footer_faq", "button", { label: "FAQ", href: "/faq/" }, linkStyles()),
          ]),
          node("landing_footer_note", "text", {
            content: "RASCUNHO: dados fictícios e links devem ser revisados antes da publicação.",
            tag: "span",
          }, {}),
        ]),
      ]),
    ]),
    meta: {
      title: name,
      type: "landing",
      theme: {
        primary,
        secondary: accent,
        background: SOFT,
        text: INK,
        fontHeading: "Inter",
        fontBody: "Inter",
      },
    },
  };
}
