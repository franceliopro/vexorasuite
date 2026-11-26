# Estado atual da Véxora — 2026-11-24

> Atualização de 2026-11-24: varredura visual e de processos, correção do `500` em documentos e do `prompt()` do editor, publicação observada dos sites Rastreabem e Morbeck x Carvalhinho no domínio final. Nenhuma publicação, cobrança ou integração externa foi executada por esta rodada.

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
| Assistente de fluxo (execução direta) | [~] | Agente built-in `vexora:flow-architect`, Skill `chatbot.flow.direct` e `POST /api/backend/assistant/engine/flow-command`: comando em linguagem natural vira operações curtas aplicadas no backend; `maxTokens` 1.200 no ajuste e mapa compacto com id/título/opções. Testes unitários locais passaram; ainda sem PR, CI ou evidência no ambiente publicado. Salvar/publicar continua manual. |
| Assistente direto e especialistas | [~] | Resolvedor determinístico `assistant-demand-context` responde capacidades e contagens sem IA, antes do fallback; 14 skills que prometiam operações não implementadas foram removidas e `assistant.direct.context` entrou no catálogo; cinco especialistas built-in (Financeiro, CRM, Atendimento, Tarefas/Agenda, Relatórios) são materializados em toda empresa nova. Finanças no `ask` agora exigem papel **e** módulo `FINANCE`. 15/15 testes novos passaram; sem PR/CI. |
| Presença — sites externos e artes | [~] | Novo módulo `presence`: registra referência de site já publicado fora da Véxora (informativo, sem afirmar publicação própria) e produz arte SVG original na empresa. Publicação envia arquivos para projeto Cloudflare Pages do tenant e só grava `PUBLISHED` após HTTP 2xx na URL final; sem credenciais, a arte fica como rascunho/falha honesta. 6/6 testes locais passaram; sem PR/CI/deploy. |
| Financeiro, Asaas, WhatsApp e e-mail | [x] / [~] | Contratos e código presentes. Agendamento e envio são registrados como `agendado`/`enviado`; `confirmado` exige evidência do provedor. |
| Stripe e InfinitePay | [~] | Adaptadores tenant-scoped, credenciais criptografadas, rotas autenticadas, webhooks e UI implementados; Asaas e aliases preservados. Stripe verifica assinatura v1 com corpo cru; InfinitePay só confirma após `payment_check`. Sem credenciais, webhooks registrados ou evidência externa: nenhuma cobrança real foi validada. |
| HUB de Sites | [~] | Contrato, schema/migration, service/controller tenant-scoped, testes, boot smoke e UI inicial de pedidos/preview/decisão/confirmação 2xx implementados em PRs mesclados. Não gera HTML, não hospeda página e não publica por conta própria. Publicação final depende de credenciais/evidência no ar. |
| Intake de briefing criativo | [~] | Endpoint e UI tenant-scoped exigem objetivo, canal/formato, identidade, fonte aprovada, prazo, aprovador e destino; registram evento de auditoria em `creative_briefs`. Não gera, aprova, publica nem entrega peça. Ainda sem briefing preenchido pelo proprietário. |
| Template Next.js/MDX | [x] | Padrão usado nos sites Rastreabem e Morbeck x Carvalhinho, com `output: 'export'`, conteúdo em `.mdx`/HTML saneado e menu centralizado. Publicação observada por HTTP 2xx no domínio final em 2026-11-24; esta rodada não executou deploy. |
| Sites estáticos Rastreabem e Morbeck via Git | [x] / [~] | Publicação **observada** por HTTP 2xx no domínio final em 2026-11-24 (Rastreabem: 5 páginas e 13 assets locais; Morbeck: 3 páginas e 14 assets locais, zero quebrados, marcadores dos builds presentes e ausência de `wp-content`/`wp-includes`). Esta rodada **não** executou deploy, DNS, TLS nem configurou o HUB; a automação continua sem publicação própria. |
| Alto Araguaia Imóveis | [ ] | Piloto recomendado; aguardando dump/export do CMS PHP do proprietário, campos dos imóveis, domínio/slug e direito de uso das fotos. |

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
- Modelo preenchível `docs/modelo-insumos-sites-artes.md` ligado pelo checklist: reúne os campos exigidos por site, por peça e para cobrança real. É apenas um formulário para o proprietário; preenchê-lo não publica site, gera arte nem cobra cliente.
- PR #1268: ajuste mobile do Rastreabem (remoção de “Área do Cliente” e alinhamento dos botões); head mesclada `684ab1e86c464238793e7e6e9aac31a2f1f8a492` em `foundation/bootstrap-monorepo`.
- PR #1269: sync `foundation/bootstrap-monorepo` → `main`; `main` final `10a29e408abd82c144c3d04ebf322b87ddbffb2f`, com a head esperada `2f6c4012444b6455c8bde05212470f6a142d17f9`.
- PR #1270: site estático Morbeck x Carvalhinho e documentação Git-first; CI verde em `Build and audit static site`, `Build and type-check`, `Private SearXNG runtime`, `validate`, `Container (api)` e `Container (web)`. Base esperada `2f6c4012444b6455c8bde05212470f6a142d17f9`.
- PRs #1274 a #1280: logo horizontal com limites configuráveis, correção do `500` em documentos, fallback de `prompt()`/`confirm()` no editor de fluxo, varredura e plano priorizado, além da sincronização `foundation` → `main`. CI verde nos PRs #1278, #1279 e #1280; `foundation` em `cdb24dc1479bd239f2768bda4e46eae932cea6a1` e `main` em `e78a1e0393d668690fd3e5e419b40a432bd5b4af`, com `git merge-base --is-ancestor origin/foundation/bootstrap-monorepo origin/main` retornando `0`.
- Varredura de 2026-11-24: sessão autenticada da Rastreabem e aba limpa sem imagens quebradas, overflow horizontal, `undefined`, `NaN` ou `[object Object]`. `GET /api/backend/documents/recent?limit=5` → `200`; `GET /api/backend/chatbot/runtime` → `200` com `active:false`, `publications:[]`, `defaultActive:false` e `activeBots:0`; `/api/backend/business-templates` → `200` com o fluxo salvo da Rastreabem. `GET /api/backend/finance/executive?months=6` segue `503` por falta de configuração do Asaas nesta empresa. Os `404` antigos em `/users`, `/agents` e `/operations/settings` não se reproduziram em recarregamento limpo e não existem no código atual; SSE de eventos teve apenas erros de transporte intermitentes, sem reprodutibilidade confirmada.
- Publicação observada em 2026-11-24 (não executada por esta rodada): `https://rastreabem.com.br` respondeu HTTP 200 em `/`, `/rastreamento/`, `/gestao-de-frotas/`, `/rastreacard/` e `/lp-info/`; 13 assets locais verificados, zero quebrados; marcadores `Fale com nossa equipe comercial`, `wa.me/5566996968893`, `images/logo.png`, `RASTREACARD` e `FALE CONOSCO`; ausência de `wp-content`. `https://morbeckxcarvalhinho.com.br` respondeu HTTP 200 em `/`, `/fale-conosco/` e `/resgatando-a-historia/`; 14 assets locais verificados, zero quebrados; marcadores `Buscar no site`, `search.js`, `5566996394979` e `Copyright`; ausência de `wp-content`/`wp-includes`. Cabeçalhos do Rastreabem: `Server=cloudflare`, `cf-cache-status=DYNAMIC`.

- Assistente de fluxo em execução direta: o comando “No bloco Menu principal, acrescente a opção 2ª Via Boleto (Rastreabem)” produz `addOption` + `addBlock` + `connect`; a IA devolve só operações whitelist e o backend preserva blocos, IDs, opções, canais, gatilhos e configs não citados. A resposta é aplicada ao canvas como rascunho (`persisted:false`, `active:false`); 6/6 testes novos passaram (`chatbot-flow-direct.spec.ts`, `assistant-flow-command.spec.ts`) e `tsc --noEmit` da API ficou limpo nesta rodada. Ainda não há PR, CI ou confirmação de deploy.
- Curadoria do assistente: 15/15 testes passaram (`assistant-specialists.spec.ts`, `assistant-demand-context.spec.ts`, `assistant-ask.spec.ts`, `company-blueprint.spec.ts`) — catálogo sem skills não implementadas, cinco especialistas sem atendimento automático e negação financeira respeitada mesmo para OWNER sem o módulo `FINANCE`.
- Presença Véxora: 6/6 testes passaram (`presence.service.spec.ts`), incluindo escaping da arte, URL https obrigatória, isolamento por tenant e confirmação só após 2xx; 3/3 testes estáticos do Web passaram (`sites-hub-workspace.test.mjs`) e `tsc --noEmit` limpo em API e Web.
- Varredura rápida de processos em 2026-11-24: suíte completa da API com 771/774 testes verdes. As três falhas ficaram em `events.service.spec.ts` e `team.controller.spec.ts`, arquivos não alterados nesta rodada; ao isolá-los, 7/7 passaram, indicando instabilidade por tempo/concorrência sob carga e não regressão das mudanças. Nenhuma dessas falhas foi "corrigida" alterando teste ou produção.
- Rotas novas `/api/presence` (listar, SVG, cadastrar/remover referência externa, criar e publicar arte) foram acrescentadas ao boot smoke de 401. Nenhuma chamada real à Cloudflare, publicação, cobrança ou envio foi executada nesta rodada.

## 2. O que está em construção

1. **HUB de Sites:** pedido, preview, aprovação, versão, histórico e auditoria — sem geração de HTML e sem hospedagem. UI inicial entregue; faltam integrações operacionais externas (GitHub/Cloudflare/domínio) com evidência.
2. **Template de sites Next.js/MDX:** esqueleto em componentes, conteúdo editável em `.mdx`, menu centralizado, saída estática e entrega via Cloudflare Pages.
3. **Rastreabem:** conversão do HTML já existente em MDX como primeiro piloto de aprendizado do template.
4. **Morbeck x Carvalhinho:** espelho estático limpo do WordPress, com busca client-side e build via Git.
5. **Alto Araguaia Imóveis:** inventário do CMS PHP atual do proprietário e desenho das collections `imoveis`, `bairros`, `tipos`, `fotos` e `pages` no Payload/Strapi, com Puck para edição visual.
6. **Telefonia/SMS e chamadas ao vivo com IA:** reabertura aprovada em 26/11/2026, em fatias reversíveis. Primeira fatia entregue: serviço separado com webhook assinado por tenant, consentimento default-deny, idempotência, auditoria e Postgres isolado (`apps/telephony`, `infra/telephony`). **Não entregue:** discagem, gravação, transcrição e IA em chamada. O endpoint sempre responde `aiInvoked: false`. Ver `infra/telephony/DOKPLOY.md`.

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
- Conector completo de WordPress, anúncios pagos, publicação social automática e vídeo automático. Telefonia/SMS e chamadas ao vivo com IA foram reabertas em 26/11/2026 e saíram desta lista; ver §2, item 6. O histórico de remoção permanece registrado em `docs/product-focus.md`.
- FAETER como primeiro vertical, Rastreabem como identidade global e PHP por site.
- Studio Visual completo para páginas, formulários, galerias e conteúdo dinâmico.

## 5. O que ainda depende de evidência externa

- Deploy ativo e SHA confirmado no Dokploy; domínio, TLS e sessão no ambiente publicado.
- Envio real de WhatsApp/e-mail, confirmação de cobrança pelo provedor e publicação de sites.
- Aceite ponta a ponta com aparelho de WhatsApp e contas reais de e-mail.
- Confirmação no painel Cloudflare de que os projetos Git estão configurados. Os dois sites foram **observados** com HTTP 2xx no domínio final em 2026-11-24; a configuração e a publicação não foram executadas por esta rodada.

## 6. Piloto Rastreabem — site em Next.js/MDX

- [x] As páginas do HTML original foram convertidas para MDX em `sites/rastreabem/`, com menu gerado por `content/navigation.ts` e saída estática (`output: 'export'`). O workflow `site-rastreabem.yml` valida typecheck e build.
- [x] Preview local e em endereço temporário: `python -m http.server 3105` serviu `sites/rastreabem/out` com HTTP 200 em `/`, `/rastreamento/`, `/gestao-de-frotas/`, `/rastreacard/` e `/images/1.jpg`; o túnel `https://vexora-rastreabem.loca.lt` devolveu HTTP 200 com o HTML da home em 2026-11-23. Endereço temporário, não publicação definitiva.
- [x] Auditoria estática reproduzível no workflow `site-rastreabem.yml` (`scripts/audit-links.cjs`): 10 arquivos HTML, 171 referências locais, zero links/assets quebrados em 2026-11-23.
- [x] Varredura visual e de processo em 2026-11-23: cabeçalho preto e links da Área do Cliente em nova aba com `rel="noopener noreferrer"` (#1256); menu mobile voltou a responder ao botão após remoção de regra CSS duplicada (#1258); erro de hidratação React #418 em `/lp-info/` eliminado ao alinhar MDX e DOM (#1260). Syncs de `main`: #1257, #1259 e #1261. `npm run build` e a auditoria de links foram repetidos sem regressão. Isso não é publicação.
- [x] Ajuste mobile final: remoção de “Área do Cliente” e alinhamento dos botões à borda esquerda do texto em 390px (#1268); sync para `main` (#1269). Build final a partir de `main`: 10 HTML, auditoria 171/0, sem o texto removido.
- [x] Publicação observada no domínio final em 2026-11-24: HTTP 200 em `/`, `/rastreamento/`, `/gestao-de-frotas/`, `/rastreacard/` e `/lp-info/`; 13 assets locais verificados, zero quebrados; marcadores do build presentes e ausência de `wp-content`. Esta rodada não executou deploy, DNS, TLS nem configurou o HUB. Ver `docs/site-rastreabem-mdx.md`, `docs/checklist-entrega-sites-artes.md` e `docs/cloudflare-site-deploy.md`.

## 7. Morbeck x Carvalhinho — site estático via Git

- [x] Espelho limpo do site WordPress original: 33 páginas HTML, 94 arquivos, ~4,23 MB, zero XML/feeds e zero pastas `wp-content`/`wp-includes`.
- [x] Auditoria estática de links/assets: 1.616 referências locais únicas verificadas pelo script do CI, zero quebrados. Nenhum resíduo de `author/`, `category/`, `hello-world/` ou `/r/`.
- [x] Fale Conosco com WhatsApp de Milton Pessoa Morbeck: `https://wa.me/5566996034385`.
- [x] Rodapé limpo: `Copyright © 2005 - 2026` + “Desenvolvido por Francélio Alves da Silva” com link `https://wa.me/5566996394979?text=Gostaria%20de%20falar%20com%20voc%C3%AA%20sobre%20o%20site%20Morbeck%20x%20Carvalhinho`.
- [x] Busca client-side: `src/assets/js/search.js` + `assets/js/search-index.json` gerado no build. Validação local com o termo `arlinda` retornou resultados; índice com 125.145 bytes.
- [x] Build no monorepo: `Morbeck x Carvalhinho: 33 paginas HTML geradas em sites/morbeckxcarvalhinho/out`. CI do PR #1270 validou o mesmo build e a auditoria (33 HTML, 1.616 referências, zero quebrados) no GitHub Actions.
- [x] Publicação observada no domínio final em 2026-11-24: HTTP 200 em `/`, `/fale-conosco/` e `/resgatando-a-historia/`; 14 assets locais verificados, zero quebrados; marcadores `Buscar no site`, `search.js`, `5566996394979` e `Copyright`; ausência de `wp-content`/`wp-includes`. Esta rodada não executou deploy, DNS, TLS nem configurou o HUB. Ver `docs/cloudflare-site-deploy.md` e `sites/morbeckxcarvalhinho/README.md`.

## 9. Presença Véxora — sites externos e artes

- [~] Referência externa cadastrada por empresa, sem afirmar publicação/hospedagem pela Véxora; o HUB continua sendo o único registro de `PUBLISHED` com 2xx verificado.
- [~] Estúdio de artes: SVG original gerado pela Véxora, com SHA-256, prévia e publicação orquestrada em projeto Cloudflare Pages por tenant.
- [~] Confirmação de publicação condicionada a HTTP 2xx na URL final; sem credenciais ou sem 2xx, status `FAILED`/rascunho com erro honesto. Nenhuma publicação foi executada nesta rodada.
- Guia de uso: `docs/presenca-artes-cloudflare.md`.

## 8. Fontes

- `docs/presenca-artes-cloudflare.md` — como cadastrar sites externos e criar/publicar artes com verificação 2xx.
- `docs/plano-transicao-presenca-criativos.md` — HUB de Sites (§12) e sistemas verticais (§13).
- `docs/implementation-register.md` — inventário histórico de entregas, não fonte de estado.
- `docs/product-focus.md` — escopo reduzido aprovado.
- `docs/platform-and-client-contexts.md` — limites de PLATFORM, OWNER e BOT.
