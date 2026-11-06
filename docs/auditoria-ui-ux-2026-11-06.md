# Auditoria de consistência UI/UX, temas e implantação — 06/11/2026

Base: `foundation/bootstrap-monorepo` @ `5966238` (a `main` está 197 arquivos atrás e não representa o produto).
Branch de trabalho: `audit/ui-consistency-2026-11-06`.

## Escopo e limites desta passada

Inspeção estática do código (CSS, componentes, Compose, docs) e testes Node do pacote web. **Não** houve build, typecheck, renderização em navegador nem teste em dispositivo: o ambiente não tinha rede para instalar dependências. Nada aqui comprova aparência final; a validação de build e testes completos fica para a CI do PR. Não se trata de redesenho completo.

## Corrigido nesta entrega

| # | Problema verificado | Correção |
|---|---|---|
| 1 | No tema claro, `--muted` (`#777f96`) tinha contraste de 3,99:1 sobre cartões e 3,73:1 sobre a página, abaixo de AA (4,5:1). `vexora-design-system.css` redeclarava `--page/--card/--ink/--muted/--line` com literais, anulando os aliases de `globals.css`; o teste só olhava `globals.css`, por isso não pegava | Literais removidos dos blocos light/dark; os aliases passam a valer (5,44:1). Teste ampliado para o design system |
| 2 | `--sidebar-muted-text` no tema claro: 4,22:1 | `#737b92` → `#687087` (4,93:1) |
| 3 | Botão da cor da marca: `operations-settings.tsx` ainda escolhia texto por luminância aproximada (corte 0,62). Para `#7898F7` o texto saía branco a 2,75:1 após salvar a marca, até recarregar. `page.tsx` usava o cálculo WCAG | Helper único `lib/brand-theme.ts` (`applyBrandTheme`) usado pelos dois; código morto removido |
| 4 | `100vh` sem fallback `dvh` em 4 pontos (body, `.suite-app`, `.sidebar`, `.auth-screen`), causando salto/corte com a barra do navegador móvel | `min-height: 100dvh` após o `100vh` |
| 5 | `docs/deployment-dokploy.md` não listava 50 das 68 variáveis que o Compose consome | Seção "Referência de variáveis do Compose" gerada do `docker-compose.yml`, com situação e padrão |
| 6 | Sem proteção contra regressão | Novo `test/brand-theme-consistency.test.mjs` (AA da cor de texto da marca, helper único, ausência de literais legados, contraste dos tokens secundários) |

Verificado localmente: 17/17 nos testes de marca, contraste de tokens, consistência do design system e contrato de ambiente. Os 3 testes que dependem de `jsdom` não puderam rodar sem instalação.

## Descartado após verificação

`--primary-rgb` está fixo em roxo em `globals.css`, mas não é usado em nenhum lugar; não é defeito hoje. Se for usado no futuro, precisa entrar em `applyBrandTheme`.

## Dívida medida, não resolvida (priorizada)

1. **Camada de CSS**: 472 `!important` (158 em `globals.css`, 314 no design system), ~946 cores hex e ~465 `font-size` em px fora dos tokens. A cascata depende de ordem e especificidade; qualquer troca de tema exige regra por componente. Caminho: migrar componente a componente para tokens, com captura visual antes/depois.
2. **Breakpoints**: cerca de 20 valores de `max-width` distintos (760 é o dominante; também 480, 640, 680, 700, 720, 800, 850, 900, 980, 1050, 1100, 1120). Definir 3 a 4 faixas oficiais e um teste que impeça novos valores.
3. **Hierarquia de texto**: `--text-muted` é igual a `--text-secondary` em todos os temas (`#626982` / `#c0c6d7`), então não há terceiro nível de texto.
4. ~~**Foco**~~ Resolvido na segunda passada (abaixo).
5. ~~**`themeColor`** estático~~ Resolvido na segunda passada (abaixo).
6. **Contraste da cor padrão de marca**: `#7898F7` com branco dá 2,75:1; hoje mitigado por `brandTextColor`, mas links/ícones sobre fundo claro usando `--primary` não passam pelo mesmo cálculo.
7. **Divergência de branches**: a `main` (e documentos como `auditoria-vexora-2026-10-27.md`, `roadmap.md` antigo) descreve um estado anterior da `foundation/bootstrap-monorepo`. Decidir se a `main` é sincronizada ou aposentada, para evitar auditoria sobre a base errada.
8. Pendências funcionais já registradas em `implementation-register.md` e `auditoria-continuacao-2026-10-27.md` (mídia no atendimento, outbox/reconciliação, concorrência de metadata, testes reais de Google/Zernio/Asaas) permanecem abertas; esta auditoria não as tocou.

## Próximo passo recomendado

Abrir o PR, esperar a CI (build, typecheck, testes completos com jsdom) e só então mesclar na `foundation/bootstrap-monorepo`. Após o deploy, conferir por evidência: login, alternância dos três temas, salvar uma cor de marca clara e uma escura, e rolagem no celular com barra do navegador recolhendo.

## Segunda passada (06/11/2026, após o merge do PR #450)

| # | Problema verificado | Correção |
|---|---|---|
| 7 | `--focus-ring` era um tom pálido da marca (48% de mistura com branco): 2,03:1 sobre branco com a marca padrão, 1,57:1 com `#7898F7` e 1,28:1 com amarelo. Falha o mínimo de 3:1 para indicadores de foco (WCAG 1.4.11) nos temas claro e híbrido. O anel global de inputs usava `--primary` puro (2,75:1 com `#7898F7`) | `--focus-ring` passa a ser `--text-primary` (neutro por tema, independente da marca); na `.sidebar` usa `--sidebar-text`. Anel de inputs unificado nele |
| 8 | Campos sem borda dentro de `.search-box`, `.crm-search`, `.origin-search` e `.profile-tag-editable` removiam o `outline` e o contêiner não tinha `:focus-within`; sobrava só uma sombra de 16% de opacidade | Regra `:focus-within` no contêiner: anel de 2px no token de foco mais halo suave da marca |
| 9 | `themeColor` fixo em `#111827`: a barra de status do celular ficava escura nos temas claro e híbrido | `lib/theme-color.ts` mapeia cada tema para sua superfície de página e atualiza a meta `theme-color` ao trocar de tema; padrão do viewport passa a `#f7f8fc` (tema inicial híbrido). O `theme_color` do manifest (tela de abertura do PWA instalado) permanece fixo |

Testes novos (`focus-and-theme-color.test.mjs`) leem os tokens do CSS e falham se o contraste do foco, da sidebar ou a cor da barra divergirem. Validação local: 99 de 102 testes web; os 3 que faltam dependem de `jsdom` e rodam na CI.

Limites: contraste calculado, não observado em tela; focos de componentes com regra própria de `:focus-visible` (calendário, chatbot, finance) mantêm seus estilos e não foram revisados um a um. Os 3 `outline` restantes em controles internos do calendário e do inbox ficam para uma varredura visual.
