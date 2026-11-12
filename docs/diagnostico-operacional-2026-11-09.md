# Diagnóstico operacional — Véxora Suite (2026-11-09)

> Pedido do proprietário: "Faça um diagnóstico operacional no design desse projeto e fale algo sobre, o Véxora Suite?"
> Método: auditoria técnica do repositório + acompanhamento direto das últimas duas semanas de entregas; nenhuma auditoria de concorrência foi feita — este documento descreve o produto como ele é, não como o mercado o enxerga.

## 1. O que é o Véxora Suite

Plataforma de atendimento e operação para PMEs brasileiras: **atendimento multi-canal** (WhatsApp como espinha dorsal, com Instagram, Facebook, e-mail, webchat, TikTok ao mesmo tempo), com **IA como assistente — sempre sob controle humano**. O CRM, Agenda, Financeiro (Asaas) e Automações vivem no mesmo shell; a marca de cada empresa (tenant) colore toda a UI (`--primary`), enquanto a Véxora como produto nunca aparece como identidade de cliente.

Modelo arquitetural que o código mostra: **multi-tenant com isolamento por empresa** (testes de isolamento no CI provam a fronteira), **domínios humanos** (máquina atua sob política; a pessoa final decide nos momentos sensíveis), e **dados reais, não protótipos** — as telas Atendimento e Visão geral já renderizam dados reais do backend (municípios, filas, métricas horárias, assuntos).

## 2. O que encontramos (e o que já fizemos)

### 2.1 Dívidas que custavam velocidade e dinheiro

| # | Dívida | Evidência | Situação |
|---|---|---|---|
| #474 | `globals.css` e `vexora-design-system.css` (~6.200 linhas mortas) declarados "removidos" mas rastreados no repo | branch `docs/design-tokens` os mantinha; nenhum import os referenciava | **Corrigido** em PR #483; doc de arquitetura reescrita |
| #476 | `modules.css` fechado em `@layer modules{}` — 3.229 linhas que **sempre perdiam a cascata** para o `vexora.css` | auditoria empírica: esvaziar não quebrou build, testes nem render | **Corrigido** em PR #480; `layout.tsx` importa só `vexora.css`; `docs/css-architecture.md` publicado |
| #472 | Ausência de documento canônico de tokens | cada PR mexia em cor/raio sem guia | **Corrigido** em PR #478 (`docs/design-tokens.md`) |
| #475 | `inbox-workspace.tsx` era um monolítico de 1.196 linhas | importações de dezenas de ícones, JSX gigante | **Em andamento** — extraídos `mention-popover.tsx`, `inbox-avatars.tsx`, `inbox-workspace-types.ts`, `conversation-list.tsx`; 1.164 → meta <600 |

### 2.2 Dívidas que causavam fricção direta no tenant

| # | Dívida | Efeito | Situação |
|---|---|---|---|
| — | Sidebar e topbar com linguagem inconsistente entre módulos | desconforto visual em toda a navegação | Corrigido (#459–#468: grafite, barras finas brancas, 2-line avatar) |
| — | Faltava "Nova há…" para conversas sem responsável | atendente não via urgência | Corrigido (listagem renderiza pill) |
| — | Avatar colonial achatado na ficha | identidade visual quebrada | Corrigido (#470: avatar real com fallback e bytes via proxy) |
| — | Nota privada sem sinal visual | risco de enviar comentário interno ao cliente | Corrigido parcial (composer `composer-is-note` amarelo + aba ativa amarela em PR #484) |
| #477 | Microcopy genérico ("Falha na operação.") | operador não sabia o que fazer | **Corrigido** em PR #484 (20 mensagens com ação e caminho de recuperação) |
| #473 | Zero verificação visual automática | regressões silenciosas (o tenant reclamava primeiro) | **Parcial** em PR #484 (`e2e/inbox-visual-regression.mjs`) |

### 2.3 Dívidas que continuamos pagando (honestidade)

1. **`inbox-workspace.tsx` ainda tem ~1.164 linhas** — composer e thread são os blocos mais arriscados; fragmentação segue em PRs dedicados (#475 aberto).
2. **Sem baseline pixel-perfect** — o teste visual verifica invariantes, não pixels; regressões finas de cor podem passar (#473 aberta).
3. **`vexora-night.css` existe e não é importado por ninguém** — esperando decisão: apagar ou virar experimento documentado.
4. **Workflow do CI fora do token** — o passo de regressão visual no job `validate` depende de escopo `workflow` que a conta atuadora não tem; rodamos manualmente ou um maintainer com o escopo adiciona as duas linhas (documentado em `docs/visual-regression.md`).
5. **Dependência indireta de builds manuais** — o `next build` local falha no Windows (EPERM de symlink no tracing); esperamos sempre o CI Linux verde antes de merge — funciona, mas reduz o loop de feedback.
6. **CSS monofólio remanescente** — `vexora.css` tem 1.141 linhas com poucas seções numeradas coerentes; crescemos nele sem disciplina estrutural desde a remoção do `modules.css`.

## 3. Leitura de mercado — o que é o Véxora de verdade

Sem auditar concorrentes item a item, mas com honestidade de engenharia: há três forças de mercado que o produto enfrenta hoje:

1. **CRMs com botão de WhatsApp** (Kommo, Botconversa-likes): cobrem recepção e automação, mas raramente a **ficha do cliente viva** integrada com agenda real, cobrança e contexto financeiro.
2. **Chamadas e omnichannel enterprise** (Zendesk, Octadesk): cobrem madurez e SLAs, mas com complexidade e custo que uma clínica de 4 pessoas não absorve.
3. **WhatsApp Business API puro + tag**: barato e estável, mas sem inteligência nem coordenação de equipe.

A vantagem real do Véxora é **camada humana assistida por determinismo + IA sob controle**, com a **ficha viva** (tags, protocolos, dados financeiros Asaas, agenda) no centro da conversa e **conta de empresa limpa** — nada da credencial da Véxora vaza para tenants. Esse é um posicionamento honesto e defensável de PMEs brasileiras.

Onde perdemos: experiência móvel do agente em campo, onboarding auto-serviço real (hoje depende de conversa com a operação), e prova social (nenhum estudo de caso público ainda).

## 4. Riscos operacionais imediatos

- **Regressão visual silenciosa** — mitigado parcialmente por PR #484; conferir artefatos de print quando houver mudança de UI.
- **Token/credencial sem escopo** — o token da automação não pode alterar workflows de CI; qualquer mudança de processo precisa vir de quem tem escopo.
- **Fila humana vs. IA** — a política "humano no centro" precisa continuar como regra de engenharia: nenhuma mensagem chega a cliente sem aprovação quando `human-in-loop` estiver ligado; qualquer PR que fure isso reprova.
- **Drift de identidade do tenant** — novos componentes devem herdar `--primary`, nunca hex fixo; `test/canonical-aliases.test.mjs` e `design-token-contrast` verificam parte disso.

## 5. Plano e verificação

- **Concluído em 2026-11-09 (mesma semana):** #472, #474 (de fato, em #483), #476, #477.
- **Em execução:** #475 (composer/thread).
- **Aberto com dono claro:** #473 (regressão visual completa), monofólio `vexora.css`, `vexora-night.css` órfão, escopo `workflow` para wiring do CI.
- **Regra permanente:** nada é considerado "entregue" sem CI verde + merge + comentário na issue com referência ao PR; nada do que este diagnóstico descreve exige transação externa real (p.ex. cobrar cliente, publicar conteúdo) — todas as mudanças são código, docs e testes.

## 6. Se você ler só uma coisa

O Véxora Suite parou de pagar pelo passado (3.200 linhas de CSS morto, aliases órfãos, microcopy vergonhosa) e virou **um produto de uma única folha de estilos documentada, com tokens canônicos, testes de contrato e CI verde** — com atenção obsessiva para manter a experiência do atendente em primeiro lugar. O próximo passo é acabar com o monolítico do inbox e blindar a tela com regressão visual completa.
