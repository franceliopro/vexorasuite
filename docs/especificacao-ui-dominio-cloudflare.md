# Especificação UI/UX — Configuração de domínio próprio (Cloudflare for SaaS)

> **Histórico — produto substituído.** Este documento descreve o configuração de domínio próprio dentro do assistente de sites do criador de sites com IA, retirado do produto em 2026-11-23. O serviço atual é o HUB da Véxora (docs/plano-transicao-presenca-criativos.md §12), que não gera HTML nem hospeda página. Não implementar o que está aqui sem nova decisão.
**Produto:** Véxora Sites — etapa do assistente de criação de sites
**Arquivo de referência:** `apps/web/src/app/sites-domain-config.tsx`
**Status:** pronto para integrar com os endpoints de deploy (backend em paralelo pelo VexoraProgramador)
**Público:** empresa cliente — somente usuários com permissão de domínio

---

## 1. Objetivo

Tela/etapa do wizard em que o usuário informa o domínio próprio, verifica DNS/SSL e dispara o deploy do site publicado no domínio, com instruções para configurar CNAME/ANAME na Cloudflare e erro com retry.

---

## 2. Regras de produto aplicadas

- Todo o fluxo é tenant-scoped; nunca misturar dados/credenciais de outra empresa.
- Apenas usuários com permissão de domínio veem/editam a etapa (gate de permissão).
- Não publicar nem afirmar deploy vivo antes da confirmação real do backend (registro consolidado, regra de produto Rastreabem).
- Textos em português do Brasil; exemplos rotulados como tais.

---

## 3. Estados e fluxo

| Etapa | Estado | O que acontece |
|---|---|---|
| 1. Domínio | `domain` | Usuário digita o domínio; validação de formato ao clicar em "Validar domínio". |
| 2. DNS | `dns` / `pending` | Verificação de DNS iniciada; polling a cada 4s. |
| 2. SSL | `ssl` / `pending` | SSL/TLS provisionado após DNS confirmado. |
| 2. Erro | `error` | Falha de DNS/SSL ou deploy; exibe mensagem + botão "Tentar novamente". |
| 3. Deploy | `deploy` | Barra de progresso 0→100%; site sendo publicado. |
| 4. Concluído | `done` | Sucesso; opções "Fechar" e "Ver site publicado". |

Estados de DNS/SSL: `idle` (—), `pending` (Verificando…), `verified` (Verificado), `error` (Erro).

---

## 4. Layout (em português)

```
┌─────────────────────────────────────────────┐
│ [Globe]  Conectar domínio próprio            │
│    Publique o site <slug> no seu domínio,…   │
├─────────────────────────────────────────────┤
│ [banner de permissão, se não houver permissão]│
├─────────────────────────────────────────────┤
│  1  Domínio    2  DNS e SSL    3  Deploy    │
│     ●          ○               ○             │
│  4  Concluído                             │
│     ○                                     │
├─────────────────────────────────────────────┤
│  [Passo 1 — Domínio]                        │
│  Seu domínio  [seusite.com.br________] [V]   │
│    Endereço que os visitantes usarão…       │
│  (erro: "Digite um domínio válido…")        │
│                                             │
│  [Voltar ao domínio] [Publicar no domínio]  │
└─────────────────────────────────────────────┘
```

No passo DNS/SSL são exibidos:
- Dois cards de status: DNS e SSL (pílulas `is-muted` / `is-ok` / `is-bad`).
- Tabela de registros DNS (Tipo, Nome, Valor) com botão copiar.
- Caixa de instruções Cloudflare com o destino `static.vexorasuite.com.br` (exemplo, do registro de implementação).
- Botões "Verificar agora" e "Publicar no domínio".

---

## 5. Componentes e classes (padrão Véxora)

- `content-card` — superfície do painel (token `--s1`, raio `var(--r-lg)`).
- `primary-button`, `secondary-button`, `danger-button`, `icon-button` — `vexora.css`.
- `status-pill` com variantes `.is-muted`, `.is-active` (adaptado para `is-ok`/`is-bad` via token `--ok`/`--bad`).
- `VexoraDialog` (opcional) para abrir como diálogo: `apps/web/src/app/vexora-dialog.tsx`.
- Ícones `lucide-react`: `Globe`, `CheckCircle2`, `AlertCircle`, `Loader2`, `RefreshCw`, `Copy`, `ExternalLink`, `Shield`, `Cloud`, `Zap`, `ChevronRight`.
- Tokens obrigatórios: `var(--primary)`, `var(--ok)`, `var(--warn)`, `var(--bad)`, `var(--tx)`, `var(--tx2)`, `var(--s1)`, `var(--s2)`, `var(--r)`, `var(--r-sm)`, `var(--gap)`, `var(--pad)`, `var(--ctl)` (44px touch).
- **Proibido:** valores hexadecimais diretos e `#6258df` (roxo residual); usar sempre `var(--token)` (design-tokens.md, regra 1 e 38).

---

## 6. Textos (cópias)

| Contexto | Texto |
|---|---|
| Título | Conectar domínio próprio |
| Subtítulo | Publique o site {slug} no seu domínio, com deploy via Cloudflare. |
| Label do campo | Seu domínio |
| Placeholder | seusite.com.br |
| Hint | Exemplo: loja.suaempresa.com.br. O domínio deve ser de sua titularidade. |
| Erro vazio | Informe o domínio próprio. |
| Erro formato | Digite um domínio válido (ex.: seusite.com.br). |
| Erro Véxora | Use um domínio externo próprio, não um subdomínio da Véxora. |
| Botão validar | Validar domínio / Verificando… |
| Status DNS | DNS — Verificando… / Verificado / Erro |
| Status SSL | SSL / TLS — Verificando… / Verificado / Erro |
| Título registros | Registros a configurar na Cloudflare |
| Destino CNAME/ANAME | static.vexorasuite.com.br |
| Botão verificar | Verificar agora |
| Botão publicar | Publicar no domínio / Publicando… |
| Progresso | Publicando no domínio próprio… / {pct}% |
| Sucesso | Domínio conectado — o site {slug} está publicado com SSL ativo. |
| Erro global | Não foi possível completar a configuração. + Tentar novamente |
| Sem permissão | Você não tem permissão para configurar domínios nesta empresa. |

Todos os textos acima com dados entre chaves `{}` são exemplos rotulados; substituir pelos valores reais da sessão.

---

## 7. Contrato de integração (a definir com o backend)

Os endpoints abaixo ainda não existem neste checkout; os caminhos são placeholders marcados com `TODO` no componente:

- `POST /api/backend/sites/:siteId/domain` — corpo `{ domain }`; valida e armazena o domínio.
- `GET /api/backend/sites/:siteId/domain/verify` — retorna `{ dns: status, ssl: status, records: [{type,name,value}] }`.
- `POST /api/backend/sites/:siteId/domain/deploy` — dispara o deploy via Cloudflare.
- `POST /api/backend/sites/:siteId/domain/retry` — retry após erro (ou reuso do verify).

O middleware existente (`apps/web/src/middleware.ts`) já resolve Host externo → `/sites/<slug>` via `GET /api/public/sites/resolve?host=`.

---

## 8. Acessibilidade

- `role="region"` com `aria-label` no painel; `aria-label` em cada etapa.
- Inputs com `aria-invalid`, `aria-describedby` ligado ao texto de erro/hint.
- Erros em `role="alert"`; foco visível via token `--focus-ring`/`--ring`.
- Botões com `disabled` durante estados ocupados; ícones com `aria-hidden="true"`.

---

## 9. O que não está neste escopo

- Implementação dos endpoints de domínio (responsável: VexoraProgramador).
- Integração real com a API da Cloudflare (chaves/tokens da plataforma).
- Publicação de conteúdo; o deploy só é afirmado após confirmação do backend.
