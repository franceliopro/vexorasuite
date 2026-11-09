# Verificação de regressão visual da Véxora Suite

> Estado em 2026-11-09. Parte da issue #473. Base técnica: Playwright + Chromium no CI.

## Ideia

Em vez de comparar pixels ("golden PNGs", que quebram a cada mudança legítima de design e a cada máquina), o teste regressivo verifica **invariantes determinísticos** em telas críticas do tenant e ainda salva prints como artefatos para revisão humana.

## Como funciona

`apps/web/e2e/inbox-visual-regression.mjs`:

1. Sobe a build de produção (`next start`) numa porta isolada (3101).
2. Moca o backend com fixtures determinísticas (empresa Clínica Lume; conversa sem atendente marcada como "Nova há…"). Its works like `e2e/copilot-browser.mjs`.
3. Verifica:
   - **Visão geral**: o hero mostra "5 conversas esperam por uma pessoa"; a sidebar mantém o rail grafite (`--sb-bg` = rgb(36, 38, 46)).
   - **Atendimento**: lista renderiza o contato; conversa sem responsável expõe o pill "Nova há…"; o botão balão ("Tipos de interação") existe com o tooltip `Todos · Arquivados · Lixeira · Concluídos` e, ao abrir, mostra os três destinos.
   - **Composer**: a aba "Nota privada" ativa `composer-is-note` (borda tracejada âmbar).
   - **Cartão do cliente**: visível ao lado da conversa, com o telefone formatado (`+55 (DD) …`).
   - **Mobile (390px)**: sem overflow horizontal.
4. Salva prints em `apps/web/artifacts/inbox-visual/` — enviados como artefato (`copilot-interface`) junto ao CI, para inspeção humana.

## No CI

Roda depois do build dentro do job `validate` (`.github/workflows/validate.yml`), com Chromium pré-instalado (`playwright install --with-deps chromium`), portanto sem dependência de rede externa nos testes.

## Captura local

```
pnpm --filter @vexorasuite/web build
pnpm --filter @vexorasuite/web exec node e2e/inbox-visual-regression.mjs
```

## O que falta do escopo completo da #473

- Snapshots de: aba Nota privada com nota salva renderizada; menu de filas aberto com foco
  ciclo por teclado (Tab/Shift+Tab saindo do balão sem prender); login split-screen;
  rodapé fixo da ficha com Identidades/Origem/Agenda; cartão de "Acesso rápido".
- Comparação de imagem com tolerância (p.ex. pixelmatch) para detectar regressão
  cosmética fina quando o time quiser um gate mais rígido.
- Decidir baseline por tenant (Clínica Lume) vs. por suíte genérica.
