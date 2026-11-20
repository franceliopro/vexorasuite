# Checklist de entrada em produção

Documento vivo. Atualizado em 2026-11-20. Este checklist **não autoriza** publicação, deploy, cobrança, envio de mensagens nem afirmação de validade jurídica. Cada item só avança com evidência anexada.

## Regras de atualização

1. Só marcar um item como **COMPROVADO** com evidência verificável: URL de run do GitHub Actions, resposta de endpoint com data/hora, log ou print do painel do Dokploy, número de ticket/deploy.
2. Configuração declarada, variável preenchida ou teste com credencial fictícia **não** é evidência de execução real.
3. Nunca registrar segredos, tokens, senhas ou URLs assinadas neste arquivo.
4. Se uma verificação falhar, registrar o erro exatamente como observado (inclusive request id), sem transformar falha em "pendência vaga".
5. A tabela do registro consolidado (`docs/implementation-register.md`) continua sendo a fonte de estado funcional; este documento acompanha somente a prontidão operacional.

Legenda: **COMPROVADO** = evidência observada · **IMPLEMENTADO/NÃO VERIFICADO** = código existe, sem prova de produção · **AUSENTE/BLOQUEADOR** = impede a entrar em produção.

---

## 1. Estado observado em 2026-11-20

| Verificação | Evidência observada | Status |
|---|---|---|
| API viva | `GET https://api.vexorasuite.com.br/api/health` → `{"status":"ok","service":"vexorasuite-api","database":"ok",...}` às 20:09:55Z | COMPROVADO |
| API pronta | `GET https://api.vexorasuite.com.br/api/health/ready` → `database ok`, `redis ok` às 20:10:00Z | COMPROVADO |
| Web responde | `https://app.vexorasuite.com.br/` carrega a aplicação | COMPROVADO |
| CI das entregas recentes | PRs #880, #881, #883, #884, #886, #887 mergeados; carriers #882, #885, #888 fechados sem merge com checks verdes | COMPROVADO |
| Commit rodando no Dokploy | Sem acesso ao painel/API do host; não foi possível conferir hash nem container ativo | AUSENTE/BLOQUEADOR |
| Domínio próprio de Sites | `GET /api/public/sites/resolve?host=...` em produção → 404; `GET /sites/<slug>` → 404 | AUSENTE/BLOQUEADOR |
| Publicação Cloudflare de site | Credenciais `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` vazias em `.env.example:153-155`; nenhum deploy real executado | AUSENTE/BLOQUEADOR |

> Health verde prova que existe API/web no ar. Não prova qual commit está implantado nem que integrações externas funcionam.

---

## 2. Bloqueios por área

### 2.1 Deploy e infraestrutura

- Não existe workflow de CD em `.github/workflows/`; apenas `validate.yml` e `pr-build-checks.yml`, disparados por PR/push (`validate.yml:3-10`, `pr-build-checks.yml:3-9`).
- A confirmação automatizada no VPS retornou `[VPS:2044] Currently installed operating system does not support Docker Manager.` (`docs/deployment-dokploy.md:210-216`). A conclusão depende de painel/API do Dokploy ou acesso ao host.
- Ordem segura de publicação já documentada: secrets antes do primeiro deploy, volumes novos, DNS/TLS, healthchecks, logs dos workers, login/refresh/conversa/webhook, e só depois liberar tráfego (`docs/deployment-dokploy.md:188-199`).
- Roteamento: o Compose declara labels Traefik somente para `web` (`docker-compose.yml:13-18`); rota pública da API não é provada pelo Compose.
- Backup antes de migration, restauração, retenção e observabilidade seguem sem execução registrada (`docs/deployment-dokploy.md:218-223`; `docs/implementation-register.md:56`).

### 2.2 Credenciais e ambiente

- Cloudflare: `cloudflare.service.ts:16-21` avisa quando faltam credenciais e `:32-35` lança erro no uso; `sites-deploy.service.ts:182-184` bloqueia o deploy. Sem `API_PUBLIC_URL` HTTPS, o formulário publicado é desligado de propósito (`sites-deploy.service.ts:188-195`).
- Billing: `PLATFORM_ASAAS_API_KEY`, `PLATFORM_ASAAS_BASE_URL` e `PLATFORM_ASAAS_WEBHOOK_TOKEN` estão documentados em `docs/platform-billing.md:5-11` e lidos em `billing.controller.ts:39-42`, mas **ausentes** de `.env.example` e `docker-compose.yml`. Sem a chave, o endpoint responde 424 (`billing.controller.ts:65-68`).
- E-mail: com `MAIL_HOST` vazio o envio fica desabilitado e a mensagem só vai para o log (`.env.example:128-131`). Existe CLI de diagnóstico (`apps/api/src/mail/mail-check.cli.ts`), não executada pela CI.
- WAHA, Meta Cloud API, Zernio e Google: integrações implementadas, porém sem smoke real com credenciais de produção.
- Não há schema central de variáveis de ambiente: validações isoladas em `main.ts:17-52` (CORS), `auth.guard.ts:28-31` (JWT), `webhook-crypto.ts:4-9` (criptografia) e nos módulos citados acima.

### 2.3 Sites públicos

- `GET /api/public/sites/resolve?host=` é chamado pelo middleware (`apps/web/src/middleware.ts:24-29`), mas não existe controller que o implemente neste checkout.
- Não existe página `apps/web/src/app/sites/[slug]/page.tsx`; as únicas páginas são `app/page.tsx`, `app/p/[token]/page.tsx` e `app/design-approval/[token]/page.tsx`.
- Registro reconhece ambas as lacunas em `docs/implementation-register.md:120`.
- `post-list` e `product-grid` continuam placeholders no HTML publicado (`apps/api/src/modules/sites-deploy/site-html.ts:172-175`).
- A etapa de domínio no wizard ainda tem rótulos/TODOs de placeholder e progresso simulado (`apps/web/src/app/sites-domain-config.tsx:10-12`, `:197-214`).
- A documentação de Cloudflare descreve rotas e variáveis que não existem mais no código (ex.: `SITE_PAGES_PROJECT_PREFIX` em `docs/sites-cloudflare-deploy.md:31,139-144`, enquanto `sites-deploy.service.ts:270-274` fixa o nome do projeto a partir de tenant/slug).
- Formulário publicado tem proteções implementadas — honeypot, rate limit em processo, tempo mínimo de preenchimento, allowlist de campos e transação com `SiteFormSubmission` + `Contact` + `auditLog` (`apps/api/src/modules/site-forms/site-forms.service.ts:32-48`, `:97-126`, `:144-208`) — mas nenhuma entrega real foi verificada.

### 2.4 Dados, LGPD e conteúdo

- As páginas legais geradas pelo wizard são fictícias e marcadas como rascunho (`apps/api/src/modules/sites/site-pages.ts:1-9`, `:284-332`); exigem revisão do proprietário (`docs/implementation-register.md:120`).
- Existe política institucional estática de privacidade e exclusão em `sites/institucional/`, mas não há endpoint de titular para acesso, correção, anonimização, portabilidade, objeção ou revogação de consentimento.
- Não há evidência de propagação de exclusão para backups, nem de retenção/rotação aplicada: `docs/audit-trail.md:34-38` e `docs/sessions.md:57-62` registram a lacuna.
- `GET /api/backend/documents/recent` retornou 500 em produção em 2026-11-20 (request ids `37bb9bf5-90ad-414d-9f8a-91fe867c12d4` e `0968efb2-00dc-4e76-9641-22b821f13753`); revalidar com sessão válida.

### 2.5 Verificação e qualidade

- CI usa credenciais fictícias (`.github/workflows/validate.yml:23-29`, `:62-64`); boot smoke roda com `NODE_ENV=test`, `SCHEDULER_MODE=off`, `RATE_LIMIT_ENABLED=false` e secrets injetados (`apps/api/test/boot-smoke.cjs:100-112`).
- E2E de browser usa respostas mockadas; `apps/web/e2e/copilot-browser.mjs` é no-op, embora seja invocado por `validate.yml:122-123`.
- Não existe smoke credenciado de Cloudflare, SMTP, Asaas, Meta, WAHA, domínio próprio ou formulário publicado. O `mail-check` não é chamado por nenhum workflow.
- `docs/implementation-register.md:66` define o escopo reduzido aprovado: telefonia, SMS, campanhas, anúncios, WordPress, vídeo automático e publicação social automática **não** fazem parte da entrada em produção.

---

## 3. Checklist ordenado

| # | Ação | Evidência de aceitação | Status |
|---|---|---|---|
| 1 | Fechar integração pendente do `FileManager` (#886 → #887, carrier #888) | PRs mergeados, heads foundation/main verificados | COMPROVADO |
| 2 | Obter acesso ao Dokploy/painel/host e confirmar que o commit atual está rodando | Print/log do deploy com hash do commit e horário | AUSENTE/BLOQUEADOR |
| 3 | Confirmar TLS e DNS de `app`, `api` e domínios de sites; conferir roteamento da API | Comando/resposta de certificado e requisição autenticada à API pública | AUSENTE/BLOQUEADOR |
| 4 | Conferir logs dos workers (webhook, scheduler) sem loop de restart e sem erros de conexão | Recorte de log com horário e identificação do container | AUSENTE/BLOQUEADOR |
| 5 | Preencher secrets de ambiente sem registrá-los aqui: Cloudflare, Asaas da plataforma, SMTP, WAHA/Meta, Google | Confirmação no painel + teste funcional de cada item (itens 6-9) | AUSENTE/BLOQUEADOR |
| 6 | Smoke real de SMTP (handshake e envio de teste) | Saída do `mail-check` com resultado de entrega | AUSENTE/BLOQUEADOR |
| 7 | Smoke de billing: criar cobrança em sandbox, confirmar webhook e ativação do plano | Ids da cobrança e do evento, log de `plan.activated` | AUSENTE/BLOQUEADOR |
| 8 | Smoke de canais: WAHA ou Meta Cloud API receber e enviar mensagem de teste | Id da mensagem e status final (`sent`/`delivered`/`read`) | AUSENTE/BLOQUEADOR |
| 9 | Smoke de Cloudflare: site temporário criado no wizard, publicado, aberto pela URL e despublicado | URL pública, resposta HTTP e registro do deploy | AUSENTE/BLOQUEADOR |
| 10 | Smoke de formulário publicado: enviar teste no site temporário e conferir em "Respostas" | Registro de `SiteFormSubmission`, `Contact` e `auditLog` | AUSENTE/BLOQUEADOR |
| 11 | Implementar `GET /api/public/sites/resolve` e a rota pública `/sites/<slug>`; validar reescrita por Host | Testes automatizados + 200 nos endpoints em produção | AUSENTE/BLOQUEADOR |
| 12 | Revisar textos legais gerados e definir processo de direitos do titular (inclusive backup) | Aprovação registrada do proprietário e procedimento publicado | AUSENTE/BLOQUEADOR |
| 13 | Revalidar `GET /api/backend/documents/recent` em produção com sessão válida | 200 ou diagnóstico do 500 com request id e correção | AUSENTE/BLOQUEADOR |
| 14 | Decidir se `post-list`/`product-grid` entram no escopo; se entrarem, substituir placeholders | Teste de renderização com dados reais | AUSENTE/BLOQUEADOR |
| 15 | Backup antes de migration, teste de restauração, retenção e observabilidade básica | Log de backup + restauração executada em ambiente separado | AUSENTE/BLOQUEADOR |
| 16 | Sincronizar docs de Cloudflare/Sites com o código atual (rotas e variáveis) | PR de documentação revisado | AUSENTE/BLOQUEADOR |

---

## 4. Não afirmar sem evidência

- "Deploy feito" ou "produção está na versão X" — exige hash confirmado no Dokploy/host.
- "Site publicado", "domínio ativo" ou "SSL funcionando" — exige URL pública respondendo e certificado verificado.
- "Formulário entregue" — exige registro no banco e confirmação no painel.
- "Cobrança ativada" — exige webhook real e evento `plan.activated`.
- "E-mail enviado" — exige resultado do SMTP, não apenas escrita no log.
- "Conexão WhatsApp viva" — exige mensagem recebida/enviada com status confirmado.
- "Conteúdo juridicamente válido" — exige revisão do proprietário; textos gerados são rascunhos fictícios.
- "Integração concluída" — exige teste com a conta real; credencial configurada não é conexão executada.

## 5. Histórico

- 2026-11-20: criação do checklist a partir do levantamento de estado, da configuração do repositório e de verificações read-only em produção. Nenhum item de integração externa foi marcado como COMPROVADO.
