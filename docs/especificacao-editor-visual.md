# Especificação UI/UX — Editor Visual de Sites e Wizard Base (Véxora Suite)

> **Histórico — produto substituído.** Este documento descreve o editor visual e wizard de criação de sites do criador de sites com IA, retirado do produto em 2026-11-23. O serviço atual é o HUB da Véxora (docs/plano-transicao-presenca-criativos.md §12), que não gera HTML nem hospeda página. Não implementar o que está aqui sem nova decisão.
**Produto:** Véxora Sites — Editor visual estilo Elementor/Divi/Crocoblock + wizard de criação
**Arquitetura:** `docs/vexora-editor-visual-arquitetura.md` (contrato do Orquestrador)
**Checkout de destino:** `C:/nexora-suite` (novo checkout do programador)
**Status:** pronto para integrar com o registry do programador (backend não toca)
**Pasta dos componentes:** `apps/web/src/app/sites/editor/`
**Pasta do wizard:** `apps/web/src/app/sites/wizard/wizard-shell.tsx`

---

## 1. Visão geral

O editor visual é uma interface em tela cheia dividida em:
- **Topbar mínima**: info do site, controles de dispositivo, desfazer/refazer, salvar, publicar.
- **Paleta de blocos (esquerda)**: lista de blocos do `BLOCK_REGISTRY` para adicionar ao site.
- **Canvas (centro)**: iframe isolado com preview do site + overlay de seleção.
- **Inspetor (direito)**: propriedades do nó selecionado (renderizadas a partir do schema de cada bloco) + caixa de prompt da IA.
- **Árvore de camadas (esquerda, abaixo da paleta)**: árvore de nós com seleção simples/múltipla.

O **wizard base** é uma janela não-modal em tela cheia com 5 etapas: Origem → Tipo → Tema → Domínio → Publicar. Suporta minimizar/restaurar (dock flutuante) e fechar.

---

## 2. Componentes entregues (arquivos em C:/nexora-suite)

| Arquivo | Responsabilidade |
|---|---|
| `apps/web/src/app/sites/editor/editor.css` | Tokens Véxora (CSS vars) + classes de todos os componentes (sem hex direto nos componentes) |
| `apps/web/src/app/sites/editor/editor-shell.tsx` | Shell em tela cheia: topbar, paleta, canvas, inspetor, árvore de camadas, histórico undo/redo, banners de desabilitado |
| `apps/web/src/app/sites/editor/palette.tsx` | Paleta de blocos por categoria a partir do `BLOCK_REGISTRY` |
| `apps/web/src/app/sites/editor/inspector.tsx` | Campos renderizados do schema de cada bloco (`BlockPropSchema`) + caixa de prompt da IA (Ctrl+Enter) |
| `apps/web/src/app/sites/editor/layer-tree.tsx` | Árvore de camadas `role="tree"`, `aria-selected`, teclado, visibilidade/bloqueio por nó |
| `apps/web/src/app/sites/editor/canvas.tsx` | Canvas com iframe sandboxed, toolbar de dispositivo, overlay de seleção, runtime de seleção via postMessage |
| `apps/web/src/app/sites/wizard/wizard-shell.tsx` | Wizard não-modal tela cheia: minimizar/restaurar (dock), 5 etapas, tokens Véxora |

---

## 3. Contratos consumidos (não duplicados)

- `packages/shared-types/src/site-document.ts`: `SiteNode`, `SiteDocument`, `BlockDescriptor`, `BlockPropSchema`, `NodeType`, `SiteKind`, `ThemeTokens`
- `apps/web/src/app/sites/[siteId]/edit/nodes/registry.ts`: `BLOCK_REGISTRY` (9 blocos com schemas de props), `createNode`, `BLOCK_TYPES`
- `apps/web/src/app/sites/[siteId]/edit/canvas.tsx`: iframe + runtime de seleção via postMessage (programador)
- `apps/web/src/app/sites/[siteId]/edit/history.ts`: `createHistory`, `pushHistory`, `undo`, `redo`, `canUndo`, `canRedo`
- `apps/web/src/app/sites/[siteId]/edit/adapters/ai-generate.ts`: `aiEditNode` (lógica de IA do programador, consumida pelo inspetor)

**Não foram criados** `schema.tsx` nem `nodes/registry.tsx` próprios, para evitar divergência de contratos. `EditorSelection`/`InspectorField` não são recriados: o schema vem direto de `BlockPropSchema` do `BLOCK_REGISTRY`.

---

## 4. Estados visuais

| Estado | Classe | Apresentação |
|---|---|---|
| Seleção | `.is-selected` | fundo `var(--primary-soft)`, borda `var(--primary)` |
| Hover | hover sutil | `var(--hover)` |
| Drag-over / drop | destaque do alvo | nó inserido na árvore |
| Multiseleção | múltiplos `.is-selected` | inspector mostra campos do nó ativo |
| Vazio | `.vx-palette-empty-state` / `.vx-canvas-empty` / `.vx-inspector-empty-state` | ícone + texto instrutivo |
| Desabilitado | `.is-disabled` / banners | opacidade reduzida, clique bloqueado, aviso de permissão |
| Loading | `.vx-palette-loading` / `Loader2` | ícone girando + "Carregando…" |

---

## 5. Tokens de design (sem hex direto nos componentes)

Todos os valores usam `var(--token)` definidos em `apps/web/src/app/sites/editor/editor.css`:
- `--primary` (cor da marca do tenant, tenant-scoped), `--primary-soft`, `--primary-ink`
- `--surface`, `--background`, `--surface-2`, `--hover`
- `--text`, `--text-secondary`, `--border`, `--border-strong`
- `--ok`, `--warn`, `--bad`
- `--r`, `--r-sm`, `--r-lg`, `--gap`, `--pad`, `--ctl` (44px touch)
- `--shadow`, `--shadow-lg`, `--focus-ring`, `--ease`

**Regra:** componentes usam apenas `var(--token)`; nenhum valor hexadecimal direto nos `.tsx`.

---

## 6. Contrato de integração com o programador

O programador implementa (fora do escopo do designer):
- Runtime de seleção no iframe (`canvas.tsx` postMessage) — já existente
- Persistência: `SiteDocument` no Postgres (JSONB) + versões
- Endpoints de domínio/Cloudflare (deploy) — pendentes
- `aiEditNode` — já existente em `adapters/ai-generate.ts`

O designer expõe pontos de integração (callbacks):
- `EditorShell`: `onSave`, `onPublish`, `onUndo`, `onRedo`, `onSelectNode`, `onPropChange`, `onAIChange`, `onDeviceChange`, `onClose`
- `Inspector`: `onPropChange`, `onAIChange`
- `LayerTree`: `onSelect`, `onToggleVisibility`, `onLock`
- `Canvas`: `onSelectNode`, `onDrop`, `onDeviceChange`
- `WizardShell`: `onComplete`

---

## 7. Fluxo do wizard (etapas)

1. **Origem** — Do zero / Clonar link / Importar ZIP / Gerar por IA
2. **Tipo** — Estático / Blog-Portal / Imobiliária / E-commerce
3. **Tema** — Variação visual da marca do tenant
4. **Domínio** — domínio próprio, DNS/SSL, deploy via Cloudflare
5. **Publicar** — resumo + confirmação

**Janela:** não-modal, tela cheia, barra de título com minimizar/restaurar/fechar. Minimizar → dock flutuante inferior (estado preservado).

---

## 8. Acessibilidade

- `role="application"` no shell, `role="dialog"` `aria-modal` no wizard
- `role="tree"`, `aria-multiselectable`, `aria-selected`, `aria-expanded` na árvore de camadas
- Navegação por teclado: setas para mover, Enter/Espaço para selecionar, Ctrl+Enter para aplicar IA
- Inputs com `aria-invalid`/`aria-describedby` ligados a textos de erro/hint
- Botões com `disabled` durante estados ocupados; ícones com `aria-hidden="true"`
- Foco visível via token `--focus-ring`

---

## 9. O que não está neste escopo

- Endpoints de domínio/Cloudflare (programador)
- Persistência e versionamento (programador)
- Colaboração em tempo real, marketplace de templates, versionamento público
