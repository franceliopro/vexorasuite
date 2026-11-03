# Auditoria de continuidade — 03/11/2026

Revisão dos PRs #331–#342 em `foundation/bootstrap-monorepo`, verificando no código se cada
correção faz o que o título promete. Onde a entrega estava incompleta, a correção foi feita
nos PRs #343 e #344.

## Veredito por item

| PR | Entrega declarada | Veredito | Evidência |
|---|---|---|---|
| #331 | Composer acima da navegação móvel via tokens | **Entregue** | `globals.css` define `--mobile-nav-h` uma vez; `.main-area` reserva `var(--mobile-nav-h)`; nenhuma subtração `100dvh - 1xx` restante; E2E `copilot-browser.mjs` passa |
| #332/#333 | `AuthThrottle` seguro para provider em cache | **Entregue** | `AuthThrottle` registrado em `AuthModule.providers`, injetado por construtor com default; 4 testes de janela/bloqueio passam |
| #334 | Build independente de fontes externas | **Incompleto → corrigido em #343** | O PR removeu o `next/font` **e as fontes**: `--font-ui`/`--font-display` viraram `ui-sans-serif`, o produto perdeu DM Sans/Manrope e nenhum `.woff2` existia no repositório |
| #335 | Lint bloqueante na CI | **Entregue** | `validate.yml` e `pr-build-checks.yml` rodam `pnpm lint`; `eslint.config.mjs` nos dois apps; `pnpm lint` = 0 erros |
| #336 | Reconciliação Asaas sem duplicar | **Entregue** | `pg_try_advisory_xact_lock(73910483)` dentro de transação em `asaas-customer-sync.scheduler.ts` |
| #337 | Logout invalida token | **Entregue** | `logout()` incrementa `authVersion`; `AuthGuard` compara `sessionVersion` do JWT a cada request; `POST /auth/logout` exposto |
| #338 | CSP e headers de segurança | **Entregue com ressalva** | Headers aplicados em `next.config.ts` para `/:path*`. Ressalva: `script-src 'self' 'unsafe-inline'` (sem nonce) e `connect-src https:` amplo — reduz o valor da política |
| #339 | Worker durável de webhooks | **Entregue** | `webhook-worker.ts` com `FOR UPDATE SKIP LOCKED`, 3 tentativas, backoff, recuperação de entrega travada em `PROCESSING` |
| #340 | Eventos em tempo real entre réplicas | **Incompleto → corrigido em #344** | Tabela `realtime_events` e poll funcionam, mas `void this.persist()` sem `catch` (unhandled rejection encerra o processo), erro de leitura fechava **todos** os SSE abertos e o `Set` de dedupe crescia sem limite |
| #341 | Histórico paginado | **Entregue** | Cursor `(occurredAt, id)` com `lt` composto em `conversations.controller.ts` |
| #342 | Mídia por proxy autenticado | **Entregue** | `downloadMedia` só aceita caminho `/api/files/…`, `redirect:error`, allowlist de MIME, limite de 25 MB em streaming, escopo por empresa + conversa |

## Correções desta rodada

### #343 — fontes no próprio domínio

`apps/web/public/fonts/*.woff2` (variáveis, latino) + `@font-face` com `font-display:swap` +
tokens `"DM Sans"`/`"Manrope"`. Build continua sem rede. O teste de consistência agora falha se a
fonte sumir, se um CDN voltar ou se o token perder a família da marca.

### #344 — durabilidade do fan-out e jobs single-flight

- `EventsService`: escrita em background com `catch` + log, 3 tentativas com backoff, erro de poll
  não encerra mais o stream, dedupe limitado a 5000 ids.
- `JobLeaseService` + tabela `scheduler_leases`: cada tick de triagem de áudio, cadência de
  workflows, saúde de canais e Asaas só roda em um processo por vez.
- `SCHEDULER_MODE` (`in-process` padrão, `worker`, `off`) e processo dedicado
  `scheduler-worker` no Compose como profile opcional.
- `docs/background-jobs.md` documenta intervalo, local e trava de cada job.

## Ainda aberto (prioridade sugerida)

1. **Recuperação de senha** — só existe reset feito por administrador em `team.controller.ts`;
   não há fluxo de e-mail para o próprio usuário.
2. **Refresh token / sessão curta** — JWT de 8 h sem rotação; logout invalida por `authVersion`,
   mas não existe renovação controlada nem revogação por dispositivo.
3. **Auditoria de escrita** — 24 chamadas de `auditLog.create` para 249 rotas; a maior parte das
   mutações não registra ator, antes/depois e resultado.
4. **Rate limiting além do login** — nenhum uso de `@nestjs/throttler`; upload, criação de contatos
   e disparos de automação ficam sem limite por usuário.
5. **Unificação do CSS** — seguem duas folhas (5.850 linhas) e dois vocabulários de token
   (`--ink` × `--text-primary`), com 540 `!important`.
6. **Realtime escalável** — o poll é por conexão a cada 2 s; com muitas abas o custo cresce
   linearmente. O caminho é `LISTEN/NOTIFY` ou um poller compartilhado por tenant.
7. **Testes de UI** — boa parte ainda valida o fonte por regex; falta verificação de comportamento.
