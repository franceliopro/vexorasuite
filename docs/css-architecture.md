# Arquitetura CSS da Véxora Suite

## Visão geral

A Véxora Suite possui **uma única folha de estilos**: `apps/web/src/app/vexora.css`, importada por `layout.tsx`. Toda a estrutura visual, incluindo paleta, aliases, controles, superfícies, shell e telas específicas(Saída, Interações), vive nela.

Pontos chave:

- **Constante única** — qualquer nova regra vai pra `vexora.css`. Não crie folhas paralelas.
- **Tokens primeiro** — mantenha as variáveis `--*` como fonte da verdade. Nunca use cores diretas em componentes.
- **Escopo por classe** — prefira combinadores sobre elementos.
- **Mobile-first** — dentro de `@media` depois.

## Por que essa arquitetura

Historicamente, a Véxora carregava duas folhas: `modules.css` (onde a maioria dos estilos viviam) e `vexora.css` (o sistema novo). A folha `modules.css` ficava encapsulada em `@layer modules {}`, e regras sem camada (em `vexora.css`) venciam independentemente da especificidade. Em algum ponto, o `modules.css` virou um repositório de regras mortas: nunca quebrariam a build, nunca afetariam a renderização, mas cada PR de UI pagava o preço mental de "será que aqui dentro tem algo que importa?".

Em 2026-11-09 removemos integralmente `modules.css`. Auditoria empírica:

1. `modules.css` estava dividido por `@layer modules` — qualquer regra fora da camada (todas as regras em `vexora.css`) vencia sobre ela.
2. Nenhum teste quebrava — todos os 124 testes continuavam verdes com o arquivo deletado ou esvaziado.
3. O render visual seguia idêntico (sidebar grafite, inbox funcionando, ficha do cliente normal).
4. O arquivo representava 262 KB de CSS morto — removido sem perda funcional.

O `vexora-design-system.css` e o `globals.css` já tinham sido removidos anteriormente.

## Como estruturar a folha `vexora.css`

A folha está organizada em seções numeradas:

1. **Tokens** (`/* ===== 1. Tokens ... ===== */`) — paleta, aliases, sombras, raios, métricas
2. **Base** (`/* ===== 2. Base ... ===== */`) — reset + tipografia raiz
3. **Controles** (`/* ===== 3. Controles ... ===== */`) — inputs, buttons, selects, search-box
4. **Superfícies** (`/* ===== 4. Superfícies ... ===== */`) — cards, modais, tabelas, chips
5. **Shell** (`/* ===== 5. Shell ... ===== */`) — layout genérico (brand, nav, topbar, dock)
6. **Telas específicas** (`/* ===== 6. Overview ... ===== */`, `/* ===== 7. Inbox ... ===== */`, etc.) — uma seção por módulo
7. **Responsivo** (`@media`) — ajustes para viewport pequena

## O que **não** fazer

- Não crie um novo arquivo `.css`. Se você sentir a necessidade, documente antes como um problema de arquitetura e peça ajuda.
- Não use `@import` em cascata — tudo é diretamente importado em `layout.tsx`.
- Não escreva nomes como `.vx-foo` com prefixo por "marca" — os componentes usam convenções simples por domínio.
- Não silencie especificidade com `!important` sem compreensão. Se você achar que precisa, fale com o eng. responsável pelo shell.

## Convenções de nomenclatura

- `.conversation-tags` → componente na tela de Atendimento
- `.profile-ai-compose` → componente na ficha do cliente
- `.inbox-queue-more` → componente na lista de filas
- Não criar classe de um uso só (`.internal-note-head` é ok; `.internal-note-weird-thing` é melhor não).

## Como auditar antes de PR

1. `pnpm --filter @vexorasuite/web test` — 124/124 passando.
2. `pnpm --filter @vexorasuite/web build` — build limpo.
3. `git grep "className=\"my-new-thing\""` — verificar se a classe é usada; não deixe classes mortas.
4. `grep` nos arquivos `.tsx` para ver se a classe é exclusiva; preferir combinar
5. `git diff` — se a mudança expande `vexora.css` demais, subdividir por seção numerada já existente.

## Referência

- `docs/design-tokens.md` — documentação dos tokens, aliases e paleta
- `layout.tsx` — O único ponto de importação de CSS do app
- `test/design-system-consistency.test.mjs` — verifica o shell e o dock
- `test/canonical-aliases.test.mjs` — verifica a cadeia de aliases
