# Véxora Suite — Design tokens e sistema visual

> Documento canônico da paleta, escala forma e significado relacional dos tokens que compõem a Véxora Suite.
> **Mantenedor:** Engenharia Véxora. **Referência executiva:** `docs/product-focus.md` (o que o produto existe para ser).

## Princípios

1. **Identidade da empresa é a marca da interface** — o `--primary` vem do tenant, nunca é um verde fixo: mudar a marca recolores toda a UI. Cada empresa mantém a sua própria paleta.
2. **Claro/escuro/híbrido são irmãos, não clones** — mesma semântica, mesma escala forma, cada um com o seu vocabulário.
3. **Hierarquia por forma e espaço, não por cor** — cor é exceção (de erros à marca), nunca regra.
4. **Acessibilidade antes de beleza** — contraste mínimo 4.5 (texto normal) e 3.0 (texto grande). Testado em `design-token-contrast.test.mjs` e `night-theme-contrast.test.mjs`.

---

## 1. Paleta estrutural

| Token | Claro | Híbrido | Escuro | Propósito |
|---|---|---|---|---|
| `--bg` | `#F6F7F4` | `#F6F7F4` | `#0A0F0C` | Fundo de página — a única superfície que nunca aparece em card |
| `--s1` | `#FFFFFF` | `#FFFFFF` | `#101713` | Superfície principal de cards, modais, painéis |
| `--s2` | `#FAFBF9` | `#FAFBF9` | `#151E18` | Superfície secundária (listas alternadas, estados de hover) |
| `--s3` | `#F0F2ED` | `#F0F2ED` | `#1B261F` | Superfície terciária (chip ativo, fundo de tooltip) |
| `--hover` | `#EDF3EE` | `#EDF3EE` | `#1F2B23` | Estado de hover interativo |
| `--tx` | `#161A17` | `#161A17` | `#F3F7F4` | Texto primário — nunca `#000` |
| `--tx2` | `#5B645D` | `#5B645D` | `#A7B4AC` | Texto mutedo / secundário |
| `--tx3` | — | — | — | (payload útil para densidade, reservado) |

## 2. Marca da empresa (tenant-scoped)

| Token | Claro/Híbrido | Escuro | Propósito |
|---|---|---|---|
| `--primary` | `#0E7A5C` (esmeralda da Clínica Lume) | `#0E7A5C` | Cor da marca da empresa — aciona todos os estados ativos, botões primários e o brilho da sidebar |
| `--primary-contrast` | `#FFFFFF` | `#FFFFFF` | Texto sobre `--primary` com contraste máximo |
| `--primary-soft` | `color-mix(in srgb, var(--primary) 12%, var(--s1))` | `color-mix(in srgb, var(--primary) 20%, var(--s1))` | Fundo sutil de elementos ativos (chips, pills) |
| `--primary-ink` | `color-mix(in srgb, var(--primary) 76%, #000)` | `color-mix(in srgb, var(--primary) 46%, #FFFFFF)` | Texto sobre fundos suaves, com legibilidadeAA |
| `--primary-strong` | `color-mix(in srgb, var(--primary) 80%, #000)` | `color-mix(in srgb, var(--primary) 70%, #FFFFFF)` | Versão mais forte para interação (hover de botão primário) |

**Regra:** `--primary` é a única cor que muda com com o tenant. Nunca usar `#6258df` (um roxo residual de uma marca anterior) em nenhum estado novo — sempre `var(--primary)`.

## 3. Sidebar (fixo em todos os temas)

| Token | Valor | Propósito |
|---|---|---|
| `--sb-bg` | `#24262E` | Fundo do menu — grafite neutro, nunca muda com a identidade visual |
| `--sb-tx` | `#ECEEF1` | Texto primário do menu |
| `--sb-mut` | `#9CA0AA` | Texto mutedo / ícones inativos |
| `--sb-ln` | `#343740` | Borda/divisor — usado raramente, preferindo espaço |
| `--sb-on` | `#2C2F38` | Estado active / colapso / popover de perfil |
| `--sb-active` | `var(--primary)` | Destaque do item ativo — herda a marca |
| `--sb-active-tx` | `var(--primary-contrast)` | Texto sobre item ativo |
| `--sb-thumb` | `#FFFFFF` | Cor da barra de rolagem do menu no híbrido/escuro |

## 4. Semântica do estado

| Token | Claro/Híbrido | Escuro | Propósito |
|---|---|---|---|
| `--ok` | `#0E7A5C` | `#3FCE9E` | Sucesso / finalizado |
| `--warn` | `#9A5B09` | `#F0B25E` | Alerta / atenção |
| `--bad` | `#B4402E` | `#F0907A` | Erro / crítico |
| `--accent2` | `#2C7BC4` | `#7CB6EF` | Destaque analítico / contexto (suíte de gráficos) |

## 5. Acentos de dados (paleta de gráficos)

| Token | Claro | Escuro | Propósito |
|---|---|---|---|
| `--mint` | `#12A97E` | `#3FCE9E` | Verde principal — neutro, tratamento neutro |
| `--mint-ink` | `#0A7A58` | `#7BE3C0` | Legível sobre fundo claro/escuro |
| `--amber` | `#D08A18` | `#F0B25E` | Atenção negativa |
| `--amber-ink` | `#8A5A07` | `#F6CD93` | Texto sobre amber leve |
| `--coral` | `#D9583F` | `#F0907A` | Alerta vermelho-terra |
| `--coral-ink` | `#A33A26` | `#F7B4A5` | Texto sobre coral claro |

## 6. Forma e estrutura

| Token | Valor | Propósito |
|---|---|---|
| `--r` | `18px` | Raio principal — chips grandes, modais |
| `--r-sm` | `12px` | Raio secundário — cards, popover |
| `--r-lg` | `22px` | Raio destacado — cards grandes, painéis |
| `--r-xl` | `28px` | Raio hero — contornos de destaque |
| `--gap` | `18px` | Espaçamento entre seções — nunca abaixo de 12px |
| `--pad` | `24px` | Padding de cards / seções |
| `--ctl` | `44px` | Altura mínima para interatividade touch (mobile PWA) |
| `--sb` | `272px` | Largura padrão da sidebar |
| `--top` | `68px` (desktop) / `58px` (≤760px) | Altura da barra superior |
| `--dock` | `calc(var(--dock-btn) + 8px + env(safe-area-inset-bottom))` | Altura da barra inferior mobile |
| `--ease` | `cubic-bezier(.2,.8,.2,1)` | Easing de todas as transições |

## 7. Status semântico / "brilho"

| Token | Valor | Propósito |
|---|---|---|
| `--ring` | `0 0 0 4px color-mix(in srgb, var(--primary) 16%, transparent)` | Indicador de foco no estado keyboard |
| `--shadow` | `0 1px 2px rgba(...)+0 18px 40px -26px rgba(...)` | Sombra padrão — rasa, nível 1 |
| `--shadow-sm` | `0 1px 2px rgba(...)` | Inset / borda suave |
| `--shadow-lg` | `0 4px 10px rgba(...) + 0 30px 64px -34px rgba(...)` | Popovers, menus, modais |
| `--sheen` | `linear-gradient(180deg, rgba(255,255,255,.62), rgba(255,255,255,0))` | Camada de luz superior — só em escuro tem equivalente sutil |

---

## 8. Aliases e retrocompatibilidades

| Token | Valor | Motivo |
|---|---|---|
| `--card` | `var(--s1)` | Alias duplo — `--card` ainda aparece em legado |
| `--page` | `var(--bg)` | Alias duplo em testes |
| `--surface-1` | `var(--s1)` | Padrão novo |
| `--ink` | `var(--tx)` | Texto forte |
| `--text-secondary` | `var(--tx2)` | Texto suave |
| `--muted` | `var(--tx2)` | Idem |
| `--border-subtle` | `var(--ln)` | Border padrão |
| `--border-strong` | `var(--ln2)` | Border proeminente (hairline) |
| `--focus` | `var(--tx)` | Cor de foco em estados finos |
| `--thumb` | `var(--thumb)` | Scrollbar no híbrido/escuro (branco), no claro (cinza-terra) |

## 9. Regras de uso

1. **Nunca use valores diretos.** Use sempre `var(--token)`. Hard-coding quebra o produto quando a marca do tenant muda.
2. **Prioridade de cascade:** `vexora.css` vence `modules.css` vence `globals.css` (este último ainda não é importado — see `docs/css-architecture.md`).
3. **Classes `*-is-selected`, `*-active`, `*-is-note`** sempre usam `var(--primary-soft)` ou `var(--primary)` — nunca cores diretas de "verde esmeralda obvio".
4. **Textos sobre `var(--primary)`** sempre `var(--primary-contrast)` (branco). Nunca `#000` sobre `var(--primary)`.
5. **Adicionar um novo token** exige: valor nos 3 temas + entrada nesta tabela + justificativa.

## 10. Brand Tenant × Véxora Suite

Véxora Suite é a plataforma, não a marca de um tenant. O tenant pode ter qualquer cor, e o produto muda com ela, mas a **Véxora Suite**:
- Esmeralda está definida em `--primary:#0E7A5C` como **alias canônico do tenant padrão da Véxora** (a Clínica Lume). Tenants em produção podem trocar.
- Never mostrar `Véxora · alguma outra cor`. É sempre o tenant: "Véxora · Clínica Lume", não "Véxora · Esmeralda".
