import { BUSINESS_AREAS } from "./blueprint";

/**
 * Templates premium determinísticos — HTML+CSS escrito por gente, não pelo modelo.
 * A IA fica fora do design: o resultado é idêntico sempre, bonito e seguro.
 * O site usa as fotos do próprio cliente (enviadas via Gerenciador de arquivos) ou,
 * na falta delas, fotos ilustrativas confiáveis por segmento.
 */

export type PremiumTemplateId = "imobiliaria" | "estetica" | "advocacia" | "universal" | "vexora";

type Theme = {
  surface: string; ink: string; muted: string; accent: string; accentInk: string;
  display: string; hero: "split" | "center"; dark: boolean;
};

const THEMES: Record<PremiumTemplateId, Theme> = {
  imobiliaria: { surface: "#F7F4EE", ink: "#201B16", muted: "#6B6257", accent: "#B98A45", accentInk: "#1D1607", display: "'Playfair Display',serif", hero: "split", dark: false },
  estetica:    { surface: "#FCF7F6", ink: "#26201E", muted: "#7A6A66", accent: "#B76E79", accentInk: "#FDF3F4", display: "'Fraunces',serif", hero: "split", dark: false },
  advocacia:   { surface: "#0E1A2E", ink: "#F3EFE4", muted: "#9FB0CA", accent: "#C9A962", accentInk: "#0E1A2E", display: "'DM Serif Display',serif", hero: "center", dark: true },
  universal:   { surface: "#FBFAF7", ink: "#17150F", muted: "#5B564C", accent: "#C8451F", accentInk: "#FFF7F2", display: "'Playfair Display',serif", hero: "split", dark: false },
  vexora:      { surface: "#F7FAFF", ink: "#060B1F", muted: "#3D4B6B", accent: "#2E7CF6", accentInk: "#FFFFFF", display: "'Manrope',sans-serif", hero: "split", dark: false },
};

export function templateForArea(area: string): PremiumTemplateId {
  if (area === "vexora") return "vexora";
  if (area === "imobiliaria") return "imobiliaria";
  if (["clinica_medica", "clinica_estetica", "estetica_geral", "escola_musica"].includes(area)) return "estetica";
  if (["advocacia", "construtora", "rastreamento", "protecao"].includes(area)) return "advocacia";
  return "universal";
}

const esc = (v: string) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const AREA_HEADLINE_OVERRIDES: Record<string, string> = {
  imobiliaria: "O próximo passo da sua vida começa aqui",
  clinica_medica: "Cuidar de você é o nosso trabalho",
  clinica_estetica: "Beleza com ciência, não com sorte",
  advocacia: "Direito com clareza e estratégia",
  construtora: "Construindo com qualidade há anos",
  vexora: "O sistema operacional da sua empresa",
};

/** Microcopy produzido pela IA (ou omitido — os textos do template entram no lugar). */
export type PremiumCopy = {
  headline?: string; sub?: string; ctaLabel?: string;
  services?: { title: string; text: string }[];
  testimonial?: { quote: string; author: string };
};

/** Constrói a composição premium completa a partir dos dados reais do site. */
export function buildPremiumTemplate(input: {
  name: string; area: string; primaryColor: string; accentColor: string;
  departments?: { platform: string; handle: string }[];
  imageUrls: string[];
  copy?: PremiumCopy;
}): { html: string; css: string } {
  const area = BUSINESS_AREAS[input.area] ? input.area : "site_simples";
  const pack = BUSINESS_AREAS[area]!;
  const id = templateForArea(input.area);
  const theme = THEMES[id];
  const company = esc(input.name);
  const wa = (input.departments || []).find(d => d.platform === "whatsapp" && d.handle)?.handle || "";
  const waLink = wa ? "https://wa.me/" + String(wa).replace(/\D/g, "") : "#contato";
  const heroImage = input.imageUrls[0] || "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1600&q=80";
  const gallery = input.imageUrls.slice(1, 7);
  const clamp = (v: unknown, max = 500): string => typeof v === "string" ? esc(v).replace(/\s+/g, " ").trim().slice(0, max) : "";
  const isVexora = id === "vexora";
  const headline = (() => {
    const base = clamp(input.copy?.headline, 140) || esc(AREA_HEADLINE_OVERRIDES[area] || pack.headline);
    return isVexora ? base.replace("sistema operacional", '<span class="vx-hl">sistema operacional</span>') : base;
  })();
  const sub = clamp(input.copy?.sub, 300) || esc(pack.sub);
  const tagline = esc(pack.label);
  const accent = /^#[0-9a-f]{6}$/i.test(input.accentColor || "") ? input.accentColor : theme.accent;
  const services = (Array.isArray(input.copy?.services) && input.copy!.services!.length ? input.copy!.services!.slice(0, 6) : pack.services.slice(0, 6)).map(s => ({ title: clamp(s?.title, 80), text: clamp(s?.text, 240) }));
  const ctaLabel = clamp(input.copy?.ctaLabel, 60) || (isVexora ? "Agendar demonstração" : "Quero conversar");
  const quote = clamp(input.copy?.testimonial?.quote, 240) || (isVexora
    ? "A Véxora colocou toda a operação em um lugar só — atendimento, CRM, site e cobrança no mesmo fluxo."
    : "Trabalhar com " + company + " mudou a nossa forma de ver " + esc(tagline.toLowerCase()) + ". Direção clara, entrega no prazo e uma equipe que aparece de verdade.");
  const author = clamp(input.copy?.testimonial?.author, 80) || (isVexora ? "Quem vive o dia a dia da operação — exemplo editável (edite no Studio)" : "Cliente — exemplo editável (edite no Studio)");
  const cards = (gallery.length ? gallery : [heroImage, "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80", "https://images.unsplash.com/photo-1600596542815-ff5c4fffda7b?auto=format&fit=crop&w=1200&q=80"]).slice(0, 4);

  const galleryHtml = cards.map((src, i) => `<figure class="vx-ph"><img src="${esc(src)}" alt="${company} — foto ${i + 1}" loading="lazy"/></figure>`).join("\n");

  const eyebrow = isVexora
    ? `<span class="vx-eyebrow vx-eyebrow--pill">${tagline} · SaaS de gestão</span>`
    : `<span class="vx-eyebrow">${tagline}</span>`;
  // Composição de produto em CSS puro — nenhuma imagem externa, identidade da marca.
  const vexoraArt = `<figure class="vx-art" aria-hidden="true">
          <div class="vx-window">
            <div class="vx-window-bar"><i></i><i></i><i></i><span>${company} · app.vexora.com.br</span></div>
            <div class="vx-window-body">
              <aside class="vx-mock-side"><b>Véxora</b><span class="is-active">Visão geral</span><span>Inbox</span><span>CRM</span><span>Sites</span><span>Financeiro</span></aside>
              <div class="vx-mock-chat">
                <div class="vx-bubble vx-bubble--in">Oi! Vi o site de vocês. Quero agendar uma demonstração.<small>LEAD · 14:32</small></div>
                <div class="vx-bubble vx-bubble--out">Claro! Hoje às 16h tenho um horário. Posso confirmar para você?<small>IA · 14:32 · RESPOSTA EM 2S</small></div>
                <div class="vx-bubble vx-bubble--in">Perfeito, pode confirmar.<small>LEAD · 14:33</small></div>
              </div>
            </div>
          </div>
          <div class="vx-chip vx-chip--a">Cobrança conciliada · R$ 1.280</div>
          <div class="vx-chip vx-chip--b">IA respondeu em 2s</div>
        </figure>`;
  const splitFigure = isVexora
    ? vexoraArt
    : `<figure class="vx-hero-photo"><img src="${esc(heroImage)}" alt="${company}" loading="eager"/></figure>`;

  const heroInner = theme.hero === "split"
    ? `<div class="vx-hero-txt">
         ${eyebrow}
         <h1>${headline}</h1>
         <p>${sub}</p>
         <div class="vx-actions">
           <a class="vx-btn" href="${esc(waLink)}">${ctaLabel}</a>
           <a class="vx-link" href="#servicos">${isVexora ? "Ver módulos ↓" : "Ver serviços ↓"}</a>
         </div>
       </div>
       ${splitFigure}`
    : `<div class="vx-hero-txt vx-hero-txt--center">
         <span class="vx-eyebrow">${tagline}</span>
         <h1>${headline}</h1>
         <p>${sub}</p>
         <div class="vx-actions"><a class="vx-btn" href="${esc(waLink)}">Falar com o escritório</a></div>
       </div>`;

  const servicesHtml = services.map((s, i) => `<li class="vx-svc"><span class="vx-num">0${i + 1}</span><div><strong>${s.title}</strong><p>${s.text}</p></div></li>`).join("\n");

  // Ícones em linha (SVG, sem dependência externa) para os módulos da Véxora.
  const moduleIcons = [
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 6 8.38 8.38 0 0 1-3.8-.9L3 21l1.6-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 6-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`,
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>`,
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  ];
  const modulesHtml = services.map((s, i) => `<li class="vx-mod"><span class="vx-mod-ic">${moduleIcons[i % moduleIcons.length]}</span><div><strong>${s.title}</strong><p>${s.text}</p></div></li>`).join("\n");
  const faqItems: [string, string][] = [
    ["O que é a Véxora Suite?", "A plataforma completa de gestão: atendimento multicanal, CRM, automação com IA, sites institucionais e financeiro — com a sua marca, em uma tela só."],
    ["Preciso instalar alguma coisa?", "Não. A Véxora roda na nuvem, no navegador e no celular. Começar leva minutos, sem servidor nem TI."],
    ["A IA atende os meus clientes sozinha?", "A IA responde com as regras que você define — horários, preços, perguntas frequentes. Quando a conversa foge do roteiro, ela transfere para um humano. Você nunca perde o controle."],
    ["Posso usar a minha marca?", "Sim. Logo, cores e nome da sua empresa acompanham toda a experiência — inclusive no seu site."],
    ["Quanto custa a Véxora?", "Depende do tamanho da sua operação e do plano escolhido. Fale com um especialista: você sai da conversa com uma proposta clara, sem compromisso."],
    ["Como funciona a implantação?", "Em uma demonstração de 30 minutos a gente mapeia a sua operação; em seguida, o site e os canais ficam prontos para teste com a sua marca."],
  ];
  const faqHtml = faqItems.map(([q, a]) => `<details class="vx-faq-item"><summary>${q}</summary><p>${a}</p></details>`).join("\n");

  const ctaH2 = isVexora ? "Pronto para ver a Véxora rodando na sua empresa?" : "Vamos conversar sobre o seu próximo passo?";
  const ctaSub = isVexora ? "Demonstração de 30 minutos. Sem compromisso." : "Resposta rápida. Sem compromisso e sem enrolação.";

  const gallerySection = input.imageUrls.length ? `<section class="vx-section" id="galeria">
    <div class="vx-head-row"><div><span class="vx-eyebrow">Por dentro da Véxora</span><h2>O produto na prática</h2></div></div>
    <div class="vx-gallery">${galleryHtml}</div>
  </section>` : "";
  const vexoraHtml = !isVexora ? "" : `<main id="top">
  <section class="vx-hero">${heroInner}</section>
  <section class="vx-section" id="servicos">
    <div class="vx-head-row"><div><span class="vx-eyebrow">A plataforma</span><h2>Seis módulos, uma operação só</h2></div></div>
    <ol class="vx-modules">${modulesHtml}</ol>
  </section>
  <section class="vx-section vx-personas">
    <div class="vx-head-row"><div><span class="vx-eyebrow">Para quem</span><h2>Feita para quem vive de atender</h2></div></div>
    <div class="vx-persona-grid">
      <article class="vx-persona"><span class="vx-persona-num">01</span><h3>Para a sua empresa</h3><p>Uma operação só: atendimento, CRM, site e cobrança — sem planilhas paralelas e sem retrabalho.</p></article>
      <article class="vx-persona"><span class="vx-persona-num">02</span><h3>Para o time comercial</h3><p>Pipeline visual, tarefas e cobrança no mesmo lugar onde a conversa com o cliente acontece.</p></article>
      <article class="vx-persona"><span class="vx-persona-num">03</span><h3>Para quem quer crescer</h3><p>Mais atendentes, mais unidades e mais canais sem trocar de sistema — a Véxora acompanha o ritmo.</p></article>
    </div>
  </section>
  ${gallerySection}
  <section class="vx-quote" id="sobre">
    <blockquote>“${quote}”</blockquote>
    <cite>${author}</cite>
  </section>
  <section class="vx-section vx-faq" id="faq">
    <div class="vx-head-row"><div><span class="vx-eyebrow">Dúvidas</span><h2>Perguntas frequentes</h2></div></div>
    <div class="vx-faq-list">${faqHtml}</div>
  </section>
  <section class="vx-cta" id="contato">
    <span class="vx-eyebrow">Contato</span>
    <h2>${ctaH2}</h2>
    <p>${ctaSub}</p>
    <a class="vx-btn vx-btn--big" href="${esc(waLink)}">${ctaLabel}</a>
  </section>
</main>`;

  const html = isVexora ? vexoraHtml : `<main id="top">
  <section class="vx-hero">${heroInner}</section>
  <section class="vx-section" id="galeria">
    <div class="vx-head-row"><div><span class="vx-eyebrow">${isVexora ? "Por dentro da Véxora" : "Momentos"}</span><h2>${isVexora ? "O produto na prática" : "Galeria"}</h2></div></div>
    <div class="vx-gallery">${galleryHtml}</div>
  </section>
  <section class="vx-section" id="servicos">
    <div class="vx-head-row"><div><span class="vx-eyebrow">O que fazemos</span><h2>Serviços</h2></div></div>
    <ol class="vx-services">${servicesHtml}</ol>
  </section>
  <section class="vx-quote" id="sobre">
    <blockquote>“${quote}”</blockquote>
    <cite>${author}</cite>
  </section>
  <section class="vx-cta" id="contato">
    <span class="vx-eyebrow">Contato</span>
    <h2>${ctaH2}</h2>
    <p>${ctaSub}</p>
    <a class="vx-btn vx-btn--big" href="${esc(waLink)}">${ctaLabel}</a>
  </section>
</main>`;

  const dark = theme.dark;
  const baseCss = `:root{}
html,body{margin:0;padding:0}
body{background:${theme.surface};color:${theme.ink};font-family:'Manrope',sans-serif;-webkit-font-smoothing:antialiased}
.vx-hero{display:grid;grid-template-columns:1fr 1.05fr;min-height:82vh;align-items:stretch}
.vx-hero-txt{display:grid;align-content:center;gap:18px;padding:clamp(28px,5vw,64px)}
.vx-hero-txt--center{justify-items:center;text-align:center;max-width:980px;margin:0 auto}
.vx-eyebrow{font:800 11px/1 'Manrope',sans-serif;letter-spacing:.16em;text-transform:uppercase;color:${accent}}
.vx-hero h1{margin:0;font:400 clamp(38px,4.6vw,64px)/1.04 ${theme.display};letter-spacing:-.025em}
.vx-hero p{margin:0;max-width:46ch;font-size:17px;line-height:1.6;color:${theme.muted}}
.vx-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:4px}
.vx-btn{display:inline-flex;align-items:center;gap:8px;min-height:50px;padding:0 26px;border-radius:99px;background:${accent};color:${theme.accentInk};text-decoration:none;font:800 14px/1 'Manrope',sans-serif;letter-spacing:.01em;transition:transform .2s}
.vx-btn:hover{transform:translateY(-2px)}
.vx-btn--big{min-height:58px;padding:0 34px;font-size:15px}
.vx-link{display:inline-flex;align-items:center;color:${theme.muted};text-decoration:none;font-size:14px;font-weight:700}
.vx-hero-photo{margin:0;min-height:48vh}
.vx-hero-photo img{width:100%;height:100%;object-fit:cover;display:block}
.vx-section{padding:clamp(44px,7vw,96px) clamp(18px,5vw,56px);max-width:1240px;margin:0 auto}
.vx-head-row{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:26px}
.vx-head-row h2{margin:6px 0 0;font:400 clamp(28px,3.4vw,44px)/1.1 ${theme.display};letter-spacing:-.02em}
.vx-gallery{display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:220px;gap:10px}
.vx-ph{margin:0;border-radius:14px;overflow:hidden}
.vx-ph:first-child{grid-column:span 2;grid-row:span 2}
.vx-ph img{width:100%;height:100%;object-fit:cover;display:block}
.vx-services{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:${dark ? "rgba(243,239,228,.14)" : "rgba(23,21,15,.12)"};border:1px solid ${dark ? "rgba(243,239,228,.14)" : "rgba(23,21,15,.12)"};border-radius:16px;overflow:hidden}
.vx-svc{display:flex;gap:18px;padding:22px;background:${theme.surface}}
.vx-num{font:800 12px/1 'Manrope',sans-serif;color:${accent}}
.vx-svc strong{display:block;font-size:15px;margin-bottom:6px}
.vx-svc p{margin:0;font-size:13px;line-height:1.55;color:${theme.muted}}
.vx-quote{padding:clamp(48px,7vw,96px) clamp(18px,5vw,56px);max-width:900px;margin:0 auto;text-align:center}
.vx-quote blockquote{margin:0;font:400 clamp(24px,3vw,36px)/1.3 ${theme.display};letter-spacing:-.01em}
.vx-quote cite{display:block;margin-top:18px;font-size:12px;font-style:normal;color:${theme.muted}}
.vx-cta{padding:clamp(48px,8vw,110px) clamp(18px,5vw,56px);text-align:center;display:grid;justify-items:center;gap:14px;background:${dark ? "#0A1424" : "#FFFFFF"};border-top:1px solid ${dark ? "rgba(243,239,228,.12)" : "rgba(23,21,15,.09)"}}
.vx-cta h2{margin:0;max-width:720px;font:400 clamp(30px,4vw,48px)/1.1 ${theme.display};letter-spacing:-.02em}
.vx-cta p{margin:0;color:${theme.muted};font-size:16px}
@media(max-width:900px){
  .vx-nav{display:none}
  .vx-hero{grid-template-columns:1fr;min-height:auto}
  .vx-hero-photo{min-height:44vh;order:-1}
  .vx-gallery{grid-template-columns:repeat(2,1fr);grid-auto-rows:160px}
  .vx-services{grid-template-columns:1fr}
}
@media(max-width:560px){
  .vx-head-cta{display:none}
  .vx-gallery{grid-template-columns:1fr;grid-auto-rows:200px}
  .vx-ph:first-child{grid-column:auto;grid-row:auto}
}
`;
  // Atmosfera SaaS Véxora: navy + azul da marca, grid sutil, glow, composição de produto.
  const vexoraCss = isVexora ? `
.vx-hero{position:relative;background:radial-gradient(900px 520px at 88% -10%,rgba(46,124,246,.18),transparent 60%),#F7FAFF}
.vx-hero::before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(6,11,31,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(6,11,31,.05) 1px,transparent 1px);background-size:30px 30px;-webkit-mask-image:radial-gradient(ellipse at 70% 40%,black 25%,transparent 72%);mask-image:radial-gradient(ellipse at 70% 40%,black 25%,transparent 72%);pointer-events:none}
.vx-hero-txt{position:relative}
.vx-eyebrow--pill{display:inline-flex;align-items:center;gap:9px;width:max-content;padding:8px 15px;border-radius:99px;background:#E7EFFC;border:1px solid #D3E2FF;color:#164E8A;letter-spacing:.1em}
.vx-eyebrow--pill::before{content:"";width:7px;height:7px;border-radius:99px;background:#2E7CF6;box-shadow:0 0 0 3px rgba(46,124,246,.22)}
.vx-hero h1{font:800 clamp(36px,4.6vw,60px)/1.02 'Manrope',sans-serif;letter-spacing:-.035em;color:#060B1F}
.vx-hl{color:#2E7CF6}
.vx-link{color:#3D4B6B}
.vx-hero-photo{display:none}
.vx-btn{border-radius:12px;box-shadow:0 10px 30px rgba(46,124,246,.35)}
.vx-btn:hover{box-shadow:0 14px 36px rgba(46,124,246,.42)}
.vx-head-row h2{font:800 clamp(26px,3.1vw,40px)/1.12 'Manrope',sans-serif;letter-spacing:-.03em;color:#060B1F}
.vx-ph{border-radius:18px}
.vx-services{border-color:#E2E8F8;background:#E2E8F8;border-radius:18px}
.vx-svc{background:#FFFFFF;transition:transform .2s}
.vx-svc:hover{transform:translateY(-2px)}
.vx-num{font:800 11px/1 'Manrope',sans-serif;color:#2E7CF6;letter-spacing:.1em}
.vx-svc strong{font-family:'Manrope',sans-serif;color:#060B1F}
.vx-quote blockquote{font:800 clamp(22px,2.6vw,32px)/1.35 'Manrope',sans-serif;letter-spacing:-.02em;color:#0A1440}
.vx-quote blockquote::before{content:"“";display:block;font-size:92px;line-height:.55;color:#2E7CF6;opacity:.35;margin-bottom:20px}
.vx-cta{background:radial-gradient(760px 400px at 50% -18%,rgba(46,124,246,.34),transparent 62%),#060B1F;border-top:1px solid rgba(125,211,252,.16)}
.vx-cta .vx-eyebrow{color:#7DD3FC}
.vx-cta h2{color:#F2F7FF;font:800 clamp(27px,3.5vw,42px)/1.1 'Manrope',sans-serif;letter-spacing:-.03em}
.vx-cta p{color:#9FB6E4}
.vx-art{position:relative;display:grid;place-items:center;padding:clamp(28px,4vw,60px);background:radial-gradient(640px 420px at 58% 26%,rgba(46,124,246,.22),transparent 62%)}
.vx-window{position:relative;width:min(500px,100%);border-radius:16px;background:#0B1230;border:1px solid rgba(125,211,252,.28);box-shadow:0 40px 80px -24px rgba(6,11,31,.55);overflow:hidden;transform:rotate(-.6deg)}
.vx-window-bar{display:flex;align-items:center;gap:6px;padding:11px 14px;background:#080E26;border-bottom:1px solid rgba(125,211,252,.18)}
.vx-window-bar i{width:9px;height:9px;border-radius:99px;background:#1E2A4A}
.vx-window-bar i:first-child{background:#F87171}
.vx-window-bar i:nth-child(2){background:#FBBF24}
.vx-window-bar i:nth-child(3){background:#34D399}
.vx-window-bar span{margin-left:8px;font:600 10.5px 'Manrope',sans-serif;color:#7DD3FC;letter-spacing:.03em}
.vx-window-body{display:grid;grid-template-columns:124px 1fr;min-height:236px}
.vx-mock-side{display:grid;align-content:start;gap:4px;padding:12px 10px;background:#0D1533;border-right:1px solid rgba(125,211,252,.12)}
.vx-mock-side b{font:800 9px/1 'Manrope',sans-serif;letter-spacing:.16em;color:#5C6C9C;text-transform:uppercase;padding:0 6px 7px}
.vx-mock-side span{display:flex;align-items:center;gap:7px;font:600 10.5px 'Manrope',sans-serif;color:#A8B6DE;padding:6px 7px;border-radius:8px}
.vx-mock-side span::before{content:"";width:6px;height:6px;border-radius:2px;background:#26355E}
.vx-mock-side span.is-active{color:#FFFFFF;background:rgba(46,124,246,.22)}
.vx-mock-side span.is-active::before{background:#2E7CF6;box-shadow:0 0 8px rgba(46,124,246,.8)}
.vx-mock-chat{display:grid;align-content:start;gap:9px;padding:14px}
.vx-bubble{max-width:82%;padding:8px 11px;border-radius:12px;font:500 11px/1.45 'Manrope',sans-serif;color:#E7EEFF;background:#141D42}
.vx-bubble--in{border-bottom-left-radius:4px}
.vx-bubble--out{justify-self:end;background:#2E7CF6;color:#FFFFFF;border-bottom-right-radius:4px}
.vx-bubble small{display:block;margin-top:5px;font-size:8px;letter-spacing:.09em;color:#8FA3D9}
.vx-bubble--out small{color:rgba(255,255,255,.75)}
.vx-chip{position:absolute;display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:12px;background:#FFFFFF;border:1px solid #E2E8F8;box-shadow:0 18px 40px -12px rgba(6,11,31,.38);font:700 10.5px 'Manrope',sans-serif;color:#0A1440;white-space:nowrap}
.vx-chip::before{content:"";width:8px;height:8px;border-radius:99px;background:#16A34A}
.vx-chip--a{left:5%;bottom:15%}
.vx-chip--b{right:4%;top:12%}
.vx-chip--b::before{background:#2E7CF6}
.vx-modules{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.vx-mod{display:flex;flex-direction:column;gap:12px;padding:20px;background:#FFFFFF;border:1px solid #E2E8F8;border-radius:16px;transition:transform .2s,box-shadow .2s}
.vx-mod:hover{transform:translateY(-3px);box-shadow:0 18px 40px -18px rgba(6,11,31,.28)}
.vx-mod-ic{display:grid;place-items:center;width:44px;height:44px;border-radius:12px;background:#E7EFFC;color:#2E7CF6}
.vx-mod-ic svg{width:22px;height:22px}
.vx-mod strong{display:block;font:800 15px/1.3 'Manrope',sans-serif;color:#060B1F;margin-bottom:6px;letter-spacing:-.01em}
.vx-mod p{margin:0;font-size:12.5px;line-height:1.55;color:#3D4B6B}
.vx-personas{background:#FFFFFF;border-top:1px solid #E7EDF8;border-bottom:1px solid #E7EDF8}
.vx-persona-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.vx-persona{display:grid;gap:10px;align-content:start;padding:24px;border-radius:16px;background:#F7FAFF;border:1px solid #E2E8F8}
.vx-persona-num{font:800 12px/1 'Manrope',sans-serif;letter-spacing:.14em;color:#2E7CF6}
.vx-persona h3{margin:0;font:800 17px/1.25 'Manrope',sans-serif;letter-spacing:-.02em;color:#060B1F}
.vx-persona p{margin:0;font-size:13px;line-height:1.6;color:#3D4B6B}
.vx-faq-list{display:grid;gap:10px;max-width:880px}
.vx-faq-item{border:1px solid #E2E8F8;border-radius:14px;background:#FFFFFF;overflow:hidden}
.vx-faq-item summary{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:17px 20px;cursor:pointer;font:800 14.5px/1.35 'Manrope',sans-serif;letter-spacing:-.01em;color:#060B1F;list-style:none}
.vx-faq-item summary::-webkit-details-marker{display:none}
.vx-faq-item summary::after{content:"+";flex:none;font-size:20px;font-weight:600;color:#2E7CF6;transition:transform .2s}
.vx-faq-item[open] summary::after{transform:rotate(45deg)}
.vx-faq-item p{margin:0;padding:0 20px 17px;font-size:13.5px;line-height:1.65;color:#3D4B6B;max-width:70ch}
@media(max-width:900px){.vx-art{order:0;padding:6px 18px 30px}.vx-window{transform:none}.vx-chip--a{left:2%;bottom:10%}.vx-chip--b{right:2%;top:6%}.vx-modules{grid-template-columns:repeat(2,1fr)}.vx-persona-grid{grid-template-columns:1fr}}
@media(max-width:560px){.vx-modules{grid-template-columns:1fr}}
` : "";
  const css = baseCss + vexoraCss;

  return { html, css };
}

/** Página interna no mesmo padrão do template (elementor-lite interno; sem IA). */
export function buildPremiumPage(input: {
  kind: string; title: string;
  name: string; area: string; primaryColor: string; accentColor: string;
  departments?: { platform: string; handle: string }[];
  imageUrls: string[];
  copy?: PremiumCopy;
}): { html: string; css: string } {
  const area = BUSINESS_AREAS[input.area] ? input.area : "site_simples";
  const pack = BUSINESS_AREAS[area]!;
  const id = templateForArea(input.area);
  const theme = THEMES[id];
  const company = esc(input.name);
  const wa = (input.departments || []).find(d => d.platform === "whatsapp" && d.handle)?.handle || "";
  const waLink = wa ? "https://wa.me/" + String(wa).replace(/\D/g, "") : "#contato";
  const accent = /^#[0-9a-f]{6}$/i.test(input.accentColor || "") ? input.accentColor : theme.accent;
  const clamp = (v: unknown, max = 500): string => typeof v === "string" ? esc(v).replace(/\s+/g, " ").trim().slice(0, max) : "";
  const clampList = (v: unknown, max = 100, size = 6): { title: string; text: string }[] => Array.isArray(v) ? v.slice(0, size).map(s => ({ title: clamp(s?.title, 80), text: clamp(s?.text, 240) })) : [];
  const services = (Array.isArray(input.copy?.services) && input.copy!.services!.length ? clampList(input.copy!.services!) : pack.services.slice(0, 6).map(s => ({ title: clamp(s?.title, 80), text: clamp(s?.text, 240) })));
  const tagline = esc(pack.label);
  const heroImage = input.imageUrls[0] || "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1600&q=80";

  let inner = "";
  let heroTitle = clamp(input.title, 80) || "Página";

  if (input.kind === "SERVICES") {
    heroTitle = clamp(input.title, 80) || "Serviços";
    inner = `<section class="vx-section" id="servicos">
      <div class="vx-head-row"><div><span class="vx-eyebrow">O que fazemos</span><h2>Serviços da ${company}</h2></div></div>
      <ol class="vx-services">${services.map((s, i) => `<li class="vx-svc"><span class="vx-num">0${i + 1}</span><div><strong>${s.title}</strong><p>${s.text}</p></div></li>`).join("")}</ol>
    </section>`;
  } else if (input.kind === "TEAM") {
    heroTitle = clamp(input.title, 80) || "Quem somos";
    inner = `<section class="vx-section" id="sobre">
      <div class="vx-head-row"><div><span class="vx-eyebrow">Quem somos</span><h2>Conheça a ${company}</h2></div></div>
      <p style="max-width:68ch;font-size:17px;line-height:1.7;color:${theme.muted}">${esc(pack.sub)} Cada detalhe do nosso trabalho é pensado para transformar o seu objetivo em resultado — com honestidade, prazo real e acabamento premium.</p>
      <div class="vx-gallery">${(input.imageUrls.slice(0, 4).map((u, i) => `<figure class="vx-ph"><img src="${esc(u)}" alt="${company} — foto ${i + 1}" loading="lazy"/></figure>`)).join("\n")}</div>
    </section>`;
  } else if (input.kind === "POSTS" || input.kind === "IMOVEIS") {
    heroTitle = clamp(input.title, 80) || (input.kind === "POSTS" ? "Notícias" : "Imóveis");
    inner = `<section class="vx-section" id="destaques">
      <div class="vx-head-row"><div><span class="vx-eyebrow">${input.kind === "POSTS" ? "Do blog" : "Nossos imóveis"}</span><h2>${heroTitle}</h2></div></div>
      <p style="max-width:68ch;font-size:17px;line-height:1.7;color:${theme.muted}">Veja os destaques atualizados diretamente aqui no site. Para ver oportunidades à venda, assine a nossa lista pelo WhatsApp.</p>
    </section>`;
  } else if (input.kind === "CONTACT") {
    heroTitle = clamp(input.title, 80) || "Contato";
    inner = `<section class="vx-section" id="contato">
      <div class="vx-head-row"><div><span class="vx-eyebrow">Contato</span><h2>Vamos conversar</h2></div></div>
      <p style="max-width:68ch;font-size:17px;line-height:1.7;color:${theme.muted}">Chame no WhatsApp que a equipe responde rápido. Sem enrolação — só um próximo passo claro.</p>
      <div class="vx-actions"><a class="vx-btn vx-btn--big" href="${esc(waLink)}">Falar no WhatsApp</a></div>
    </section>`;
  } else {
    heroTitle = clamp(input.title, 80) || "Sobre";
    inner = `<section class="vx-section" id="sobre"><div class="vx-head-row"><div><span class="vx-eyebrow">A ${company}</span><h2>${heroTitle}</h2></div></div>
      <p style="max-width:68ch;font-size:17px;line-height:1.7;color:${theme.muted}">${esc(pack.sub)}</p></section>`;
  }

  const html = `<main id="top">
  <section class="vx-hero vx-hero--compact"><div class="vx-hero-txt"><span class="vx-eyebrow">${tagline}</span><h1>${heroTitle}</h1><p>${esc(pack.sub)}</p><div class="vx-actions"><a class="vx-btn" href="${esc(waLink)}">Quero conversar</a></div></div></section>
  ${inner}
  <section class="vx-cta"><span class="vx-eyebrow">Contato</span><h2>Pronto para começar?</h2><p>Resposta rápida. Sem compromisso.</p><a class="vx-btn vx-btn--big" href="${esc(waLink)}">Falar no WhatsApp</a></section>
</main>`;

  const css = `:root{}
html,body{margin:0;padding:0;background:${theme.surface};color:${theme.ink};font-family:'Manrope',sans-serif}
body{-webkit-font-smoothing:antialiased}
.vx-hero--compact{min-height:auto;padding:clamp(48px,8vw,88px) clamp(18px,4vw,44px)}
.vx-hero--compact h1{margin:0;font:400 clamp(34px,4vw,56px)/1.06 ${theme.display};letter-spacing:-.025em}
.vx-hero--compact p{margin:0;max-width:46ch;font-size:17px;line-height:1.6;color:${theme.muted}}
.vx-hero--compact .vx-hero-txt{padding:0}
.vx-eyebrow{font:800 11px/1 'Manrope',sans-serif;letter-spacing:.16em;text-transform:uppercase;color:${accent}}
.vx-section{padding:clamp(40px,6vw,88px) clamp(18px,5vw,56px);max-width:1240px;margin:0 auto}
.vx-head-row{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:26px}
.vx-head-row h2{margin:6px 0 0;font:400 clamp(26px,3vw,40px)/1.1 ${theme.display};letter-spacing:-.02em}
.vx-gallery{display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:200px;gap:10px;margin-top:28px}
.vx-ph{margin:0;border-radius:14px;overflow:hidden}
.vx-ph img{width:100%;height:100%;object-fit:cover;display:block}
.vx-services{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:${theme.dark ? "rgba(243,239,228,.14)" : "rgba(23,21,15,.12)"};border:1px solid ${theme.dark ? "rgba(243,239,228,.14)" : "rgba(23,21,15,.12)"};border-radius:16px;overflow:hidden}
.vx-svc{display:flex;gap:18px;padding:22px;background:${theme.surface}}
.vx-num{font:800 12px/1 'Manrope',sans-serif;color:${accent}}
.vx-svc strong{display:block;font-size:15px;margin-bottom:6px}
.vx-svc p{margin:0;font-size:13px;line-height:1.55;color:${theme.muted}}
.vx-cta{padding:clamp(44px,8vw,96px) clamp(18px,5vw,56px);text-align:center;display:grid;justify-items:center;gap:14px;background:${theme.dark ? "#0A1424" : "#FFFFFF"};border-top:1px solid ${theme.dark ? "rgba(243,239,228,.12)" : "rgba(23,21,15,.09)"}}
.vx-cta h2{margin:0;max-width:720px;font:400 clamp(28px,3.6vw,44px)/1.12 ${theme.display};letter-spacing:-.02em}
.vx-cta p{margin:0;color:${theme.muted};font-size:16px}
.vx-actions{display:flex;gap:12px;flex-wrap:wrap}
.vx-btn{display:inline-flex;align-items:center;min-height:50px;padding:0 26px;border-radius:99px;background:${accent};color:${theme.accentInk};text-decoration:none;font:800 14px/1 'Manrope',sans-serif}
.vx-btn--big{min-height:58px;padding:0 34px;font-size:15px}
@media(max-width:900px){.vx-services{grid-template-columns:1fr}.vx-gallery{grid-template-columns:repeat(2,1fr);grid-auto-rows:150px}}
@media(max-width:560px){.vx-gallery{grid-template-columns:1fr}}`;

  return { html, css };
}
