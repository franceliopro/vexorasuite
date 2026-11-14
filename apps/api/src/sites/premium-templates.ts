import { BUSINESS_AREAS } from "./blueprint";

/**
 * Templates premium determinísticos — HTML+CSS escrito por gente, não pelo modelo.
 * A IA fica fora do design: o resultado é idêntico sempre, bonito e seguro.
 * O site usa as fotos do próprio cliente (enviadas via Gerenciador de arquivos) ou,
 * na falta delas, fotos ilustrativas confiáveis por segmento.
 */

export type PremiumTemplateId = "imobiliaria" | "estetica" | "advocacia" | "universal";

type Theme = {
  surface: string; ink: string; muted: string; accent: string; accentInk: string;
  display: string; hero: "split" | "center"; dark: boolean;
};

const THEMES: Record<PremiumTemplateId, Theme> = {
  imobiliaria: { surface: "#F7F4EE", ink: "#201B16", muted: "#6B6257", accent: "#B98A45", accentInk: "#1D1607", display: "'Playfair Display',serif", hero: "split", dark: false },
  estetica:    { surface: "#FCF7F6", ink: "#26201E", muted: "#7A6A66", accent: "#B76E79", accentInk: "#FDF3F4", display: "'Fraunces',serif", hero: "split", dark: false },
  advocacia:   { surface: "#0E1A2E", ink: "#F3EFE4", muted: "#9FB0CA", accent: "#C9A962", accentInk: "#0E1A2E", display: "'DM Serif Display',serif", hero: "center", dark: true },
  universal:   { surface: "#FBFAF7", ink: "#17150F", muted: "#5B564C", accent: "#C8451F", accentInk: "#FFF7F2", display: "'Playfair Display',serif", hero: "split", dark: false },
};

export function templateForArea(area: string): PremiumTemplateId {
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

/** Constrói a composição premium completa a partir dos dados reais do site. */
export function buildPremiumTemplate(input: {
  name: string; area: string; primaryColor: string; accentColor: string;
  departments?: { platform: string; handle: string }[];
  imageUrls: string[];
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
  const headline = esc(AREA_HEADLINE_OVERRIDES[area] || pack.headline);
  const sub = esc(pack.sub);
  const tagline = esc(pack.label);
  const accent = /^#[0-9a-f]{6}$/i.test(input.accentColor || "") ? input.accentColor : theme.accent;
  const services = pack.services.slice(0, 6).map(s => ({ title: esc(s.title), text: esc(s.text) }));
  const cards = (gallery.length ? gallery : [heroImage, "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80", "https://images.unsplash.com/photo-1600596542815-ff5c4fffda7b?auto=format&fit=crop&w=1200&q=80"]).slice(0, 4);

  const galleryHtml = cards.map((src, i) => `<figure class="vx-ph"><img src="${esc(src)}" alt="${company} — foto ${i + 1}" loading="lazy"/></figure>`).join("\n");

  const heroInner = theme.hero === "split"
    ? `<div class="vx-hero-txt">
         <span class="vx-eyebrow">${tagline}</span>
         <h1>${headline}</h1>
         <p>${sub}</p>
         <div class="vx-actions">
           <a class="vx-btn" href="${esc(waLink)}">Quero conversar</a>
           <a class="vx-link" href="#servicos">Ver serviços ↓</a>
         </div>
       </div>
       <figure class="vx-hero-photo"><img src="${esc(heroImage)}" alt="${company}" loading="eager"/></figure>`
    : `<div class="vx-hero-txt vx-hero-txt--center">
         <span class="vx-eyebrow">${tagline}</span>
         <h1>${headline}</h1>
         <p>${sub}</p>
         <div class="vx-actions"><a class="vx-btn" href="${esc(waLink)}">Falar com o escritório</a></div>
       </div>`;

  const servicesHtml = services.map((s, i) => `<li class="vx-svc"><span class="vx-num">0${i + 1}</span><div><strong>${s.title}</strong><p>${s.text}</p></div></li>`).join("\n");

  const mono = company.trim().split(/\s+/)[0]?.slice(0, 1).toUpperCase() || "V";

  const html = `<header class="vx-head">
  <a class="vx-brand" href="#top"><span class="vx-mono">${esc(mono)}</span><span class="vx-brand-name">${company}</span></a>
  <nav class="vx-nav"><a href="#servicos">Serviços</a><a href="#sobre">Sobre</a><a href="#galeria">Imagens</a><a href="#contato">Contato</a></nav>
  <a class="vx-head-cta" href="${esc(waLink)}">WhatsApp</a>
</header>
<main id="top">
  <section class="vx-hero">${heroInner}</section>
  <section class="vx-section" id="galeria">
    <div class="vx-head-row"><div><span class="vx-eyebrow">Momentos</span><h2>Galeria</h2></div></div>
    <div class="vx-gallery">${galleryHtml}</div>
  </section>
  <section class="vx-section" id="servicos">
    <div class="vx-head-row"><div><span class="vx-eyebrow">O que fazemos</span><h2>Serviços</h2></div></div>
    <ol class="vx-services">${servicesHtml}</ol>
  </section>
  <section class="vx-quote" id="sobre">
    <blockquote>“Trabalhar com ${company} mudou a nossa forma de ver ${esc(tagline.toLowerCase())}. Direção clara, entrega no prazo e uma equipe que aparece de verdade.”</blockquote>
    <cite>Depoimento de exemplo — edite no Studio → Blocos</cite>
  </section>
  <section class="vx-cta" id="contato">
    <span class="vx-eyebrow">Contato</span>
    <h2>Vamos conversar sobre o seu próximo passo?</h2>
    <p>Resposta rápida. Sem compromisso e sem enrolação.</p>
    <a class="vx-btn vx-btn--big" href="${esc(waLink)}">Falar agora no WhatsApp</a>
  </section>
</main>
<footer class="vx-foot"><strong>${company}</strong><span>© ${new Date().getFullYear()} · ${tagline}</span><a href="${esc(waLink)}">WhatsApp</a></footer>`;

  const dark = theme.dark;
  const css = `:root{}
html,body{margin:0;padding:0}
body{background:${theme.surface};color:${theme.ink};font-family:'Manrope',sans-serif;-webkit-font-smoothing:antialiased}
.vx-head{position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px clamp(18px,4vw,44px);backdrop-filter:blur(10px);background:${dark ? "rgba(14,26,46,.72)" : "rgba(255,255,255,.72)"};border-bottom:1px solid ${dark ? "rgba(243,239,228,.14)" : "rgba(23,21,15,.09)"}}
.vx-brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:inherit}
.vx-mono{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:${accent};color:${theme.accentInk};font:800 15px/1 'Manrope',sans-serif}
.vx-brand-name{font:800 15px/1 'Manrope',sans-serif;letter-spacing:.01em}
.vx-nav{display:flex;gap:18px}
.vx-nav a{text-decoration:none;color:${theme.muted};font-size:13px;font-weight:600}
.vx-nav a:hover{color:${theme.ink}}
.vx-head-cta{padding:10px 18px;border-radius:99px;background:${accent};color:${theme.accentInk};text-decoration:none;font:800 12px/1 'Manrope',sans-serif}
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
.vx-foot{display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;padding:18px clamp(18px,4vw,44px);font-size:12px;color:${theme.muted};border-top:1px solid ${dark ? "rgba(243,239,228,.14)" : "rgba(23,21,15,.09)"}}
.vx-foot strong{color:${theme.ink}}
.vx-foot a{color:${accent};text-decoration:none;font-weight:800}
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
}`;

  return { html, css };
}
