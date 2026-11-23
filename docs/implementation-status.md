# Estado atual da Véxora — 2026-11-23

Este arquivo é a **fonte canônica de status**. Ele substitui os checklists históricos para responder três perguntas: onde estamos, o que está em construção e onde vamos chegar. Documentos antigos continuam no repositório como registro, mas não definem o produto atual.

## Como ler os estados

- **[x] Implementado:** existe no repositório e há evidência de teste, build ou inspeção objetiva no GitHub Actions.
- **[~] Implementado, sem aceite externo:** existe no código, mas depende de conversa real, aparelho, provedor ou ambiente publicado.
- **[ ] Planejado:** decidido e documentado, sem implementação ou evidência suficiente.
- **Removido:** decisão do proprietário retirou o item do produto. Não voltar sem nova decisão.

Nenhum item vira “entregue” por causa de configuração, rascunho ou flag. Não afirmamos deploy, domínio ativo, pagamento, publicação ou integração funcionando sem evidência no ar.

## 1. Onde estamos hoje

| Área | Estado | Evidência / limite |
| --- | --- | --- |
| Monorepo web + API + workers | [x] | Next.js, NestJS, Postgres/Prisma, webhook-worker e scheduler-worker; build, typecheck, lint e testes passaram no GitHub Actions (PRs #1132, #1134 e #1135). |
| Atendimento e Inbox | [x] / [~] | Código, contratos e testes presentes; mídia, recibos e conversa ponta a ponta com aparelho real ainda dependem de aceite. |
| CRM, tarefas, agenda e relatórios | [x] | Fluxos e testes no repositório; abas de Relatórios com aba ativa em Primary e Tarefas com métricas reais. |
| Temas Slate, Claro e Híbrido | [x] | Alinhamento ao mock `cores-tailwind-temas.html`: superfície única, relógio claro, amarelo restrito ao contexto do atendimento, notas privadas azuis, “Conheça” em largura total. PRs #1122 e #1128. |
| Agentes de IA | [x] / [~] | Lista no topo em largura total, cards horizontais, nav ativa `bg-blue-600 text-white`, fieldsets com `mt-5`, PR #1127. Execução exige `agent.enabled` e `bindings.inboxes`; sem isso há handoff, não resposta automática. |
| Financeiro, Asaas, WhatsApp e e-mail | [x] / [~] | Contratos e código presentes. Agendamento e envio são registrados como `agendado`/`enviado`; `confirmado` exige evidência do provedor. |
| Stripe e InfinitePay | [~] | Adaptadores tenant-scoped, credenciais criptografadas, rotas autenticadas, webhooks e UI implementados; Asaas e aliases preservados. Stripe verifica assinatura v1 com corpo cru; InfinitePay só confirma após `payment_check`. Sem credenciais, webhooks registrados ou evidência externa: nenhuma cobrança real foi validada. |
| HUB de Sites | [~] | Contrato, schema/migration, service/controller tenant-scoped, testes, boot smoke e UI inicial de pedidos/preview/decisão/confirmação 2xx implementados em PRs mesclados. Não gera HTML, não hospeda página e não publica por conta própria. Publicação final depende de credenciais/evidência no ar. |
| Intake de briefing criativo | [~] | Endpoint e UI tenant-scoped exigem objetivo, canal/formato, identidade, fonte aprovada, prazo, aprovador e destino; registram evento de auditoria em `creative_briefs`. Não gera, aprova, publica nem entrega peça. Ainda sem briefing preenchido pelo proprietário. |
| Template Next.js/MDX | [ ] | Definido como padrão, com `output: 'export'`, conteúdo em `.mdx` e menu em `content/navigation.ts`. Ainda sem site publicado. |
| Directus + Postgres (imobiliária) | [ ] | Piloto recomendado; aguardando dump/export do CMS PHP do proprietário, campos dos imóveis, domínio/slug e direito de uso das fotos. |
| Sistemas verticais | [ ] | Escola de Música, Escola com provas/notas, Estética e Delivery registrados em §13. Nenhum módulo implantado. |

### Evidência das mudanças visuais recentes

- PRs #1122, #1125, #1127 e #1128: temas, superfície única, agentes em largura total e contraste da navegação.
- PR #1132:.documentação do HUB de Sites; PR #1134: correção dos quatro sites; PRs #1133 e #1135: sincronização de `main`.
- Validação local da rodada visual: 571/571 testes, `tsc --noEmit` limpo e `git diff --check` limpo.
- CI do GitHub Actions: Build and type-check, Private SearXNG runtime, validate, Container (api) e Container (web) com `SUCCESS` nos PRs de documentação.
- PR #1183: Stripe e InfinitePay tenant-scoped preservando Asaas; PR #1184: sincronização de `main` preservando as duas histórias (`foundation` é ancestral de `main`).
- Varredura rápida em 2026-11-23: 500/500 testes estáticos do Web, typecheck/lint de API e Web limpos, 4/4 specs de provedores de pagamento e 5/5 testes estáticos das rotas de pagamento. Nenhuma cobrança real foi feita.
- Piloto Rastreabem: build estático de 9 páginas e auditoria reproduzível de links/assets com `sites/rastreabem/scripts/audit-links.cjs` — 10 arquivos HTML, 171 referências locais, zero quebrados. Isso não é publicação.
- Intake de briefing criativo: seis blocos obrigatórios com validação no servidor, tenant isolation, migração e histórico de eventos; UI em Marketing → Briefings. Nenhuma peça é produzida ou publicada.
- Correção de honesty: `sites-domain-config.tsx` deixou de afirmar publicação, domínio conectado e SSL ativo — a tela agora diz explicitamente que tudo é simulação e que a confirmação real depende do HUB e de 2xx no domínio final.
- PR #1187: intake estruturado de briefing e correção da linguagem de domínio simulado; CI verde em `Build and type-check`, `Private SearXNG runtime`, `validate`, `Container (api)` e `Container (web)`; merge `a5e13d7bf0c117f99e7e1c93713c2085e49f9132`.
- PR #1188: sync `foundation/bootstrap-monorepo` → `main` preservando as duas histórias; merge `de1ec15f6eb1124b1d2345ae64c2fe92c0029cca`, mesclado com head esperada `db118c1534112dd92bade26e32c8db9b9e8c220d` e todos os cinco checks verdes. Após o merge, `git merge-base --is-ancestor origin/foundation/bootstrap-monorepo origin/main` retornou `0`.
- Varredura de processo em 2026-11-23: `docs/especificacao-ui-dominio-cloudflare.md` foi alinhado à simulação (sem promessa de deploy, DNS ou SSL reais). Nenhum item foi promovido a “entregue” por configuração, rascunho ou flag.

## 2. O que está em construção

1. **HUB de Sites:** pedido, preview, aprovação, versão, histórico e auditoria — sem geração de HTML e sem hospedagem. UI inicial entregue; faltam integrações operacionais externas (GitHub/Cloudflare/domínio) com evidência.
2. **Template de sites Next.js/MDX:** esqueleto em componentes, conteúdo editável em `.mdx`, menu centralizado, saída estática e entrega via Cloudflare Pages.
3. **Rastreabem:** conversão do HTML já existente em MDX como primeiro piloto de aprendizado do template.
4. **Alto Araguaia Imóveis:** inventário do CMS PHP atual do proprietário e desenho das collections `imoveis`, `bairros`, `tipos`, `fotos` e `pages` no Directus.

## 3. Onde vamos chegar

1. HUB de Sites operando com aprovação humana e registro de versão; publicação só marcada após health-check 2xx no domínio final.
2. Quatro sites recriados em Next.js — três no ciclo inicial e SOS sob avaliação. Morbeck x Carvalhinho vem do WordPress em ~40 páginas; Alto Araguaia Imóveis usa CMS headless.
3. Módulo Escola de Música: agenda, presença de aluno e professor, saldo de aulas/reposições e cobrança recorrente via Financeiro/Asaas com aviso por WhatsApp/e-mail.
4. Módulo Escola com provas/notas: login tenant-scoped de aluno, vídeo do YouTube por embed, notas em tempo real e mensalidade recorrente com aviso por WhatsApp/e-mail.
5. Estética e Delivery como segmentos/configurações sobre os mesmos núcleos; checkout de Delivery em motor de comércio externo.
6. Reavaliação do SOS Alto Araguaia com medição de storage, banda e tráfego antes de qualquer migração.

## 4. Removido — não será oferecido

- Criador de sites com IA, wizard de blueprint e editor visual legado (Véxora Sites). Substituído pelo HUB.
- Home de apresentação com papel de parede. A página inicial é a Visão geral e o logo leva para ela.
- Conector completo de WordPress, telefonia/SMS, chamadas com IA, anúncios pagos, publicação social automática e vídeo automático.
- FAETER como primeiro vertical, Rastreabem como identidade global e PHP por site.
- Studio Visual completo para páginas, formulários, galerias e conteúdo dinâmico.

## 5. O que ainda depende de evidência externa

- Deploy ativo e SHA confirmado no Dokploy; domínio, TLS e sessão no ambiente publicado.
- Envio real de WhatsApp/e-mail, confirmação de cobrança pelo provedor e publicação de sites.
- Aceite ponta a ponta com aparelho de WhatsApp e contas reais de e-mail.

## 7. Piloto Rastreabem — site em Next.js/MDX

- [x] As 7 páginas do HTML original foram convertidas para MDX em `sites/rastreabem/`, com menu gerado por `content/navigation.ts` e saída estática (`output: 'export'`). O workflow `site-rastreabem.yml` valida typecheck e build.
- [x] Preview local e em endereço temporário: `python -m http.server 3105` serviu `sites/rastreabem/out` com HTTP 200 em `/`, `/rastreamento/`, `/gestao-de-frotas/`, `/rastreacard/` e `/images/1.jpg`; o túnel `https://vexora-rastreabem.loca.lt` devolveu HTTP 200 com o HTML da home em 2026-11-23. Endereço temporário, não publicação definitiva.
- [x] Auditoria estática reproduzível no workflow `site-rastreabem.yml` (`scripts/audit-links.cjs`): 10 arquivos HTML, 171 referências locais, zero links/assets quebrados em 2026-11-23.
- [ ] Publicação em Cloudflare Pages e domínio final: sem credenciais, sem `apply` e sem evidência no ar. Ver `docs/site-rastreabem-mdx.md` e `docs/checklist-entrega-sites-artes.md`.

## 6. Fontes

- `docs/plano-transicao-presenca-criativos.md` — HUB de Sites (§12) e sistemas verticais (§13).
- `docs/implementation-register.md` — inventário histórico de entregas, não fonte de estado.
- `docs/product-focus.md` — escopo reduzido aprovado.
- `docs/platform-and-client-contexts.md` — limites de PLATFORM, OWNER e BOT.
