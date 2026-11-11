# Hospedar os produtos isolados da Véxora (bot/chat/sites) em domínios próprios

> Estado em 2026-11-10 (matriz de entrega honesta):
> - **Jenovas criadas no Cloudflare** para `site.vexorasuite.com.br`, `bot.vexorasuite.com.br`, `chat.vexorasuite.com.br` e o wildcard `*.vexorasuite.com.br`;
> - O app ainda **não** faz roteamento por Host: `site.vexorasuite.com.br` e `app.vexorasuite.com.br` servem a **mesma** UI;
> - O código que resolve o tenant pelo Host (middleware) está **pendente**;
> - Os URLs de sites de clientes já funcionam em `https://app.vexorasuite.com.br/sites/<slug>` e os robôs em `https://app.vexorasuite.com.br/p/<token>`.
> Este documento descreve o que tem de ser feito na **Cloudflare** e no **Dokploy/Traefik** para publicar as páginas isoladas com cert TLS adequado.

## 1. O que existe hoje (funciona sem nenhum ajuste)

| Produto | URL público | Status |
|---|---|---|
| Site de um cliente | `https://app.vexorasuite.com.br/sites/<slug>` | **Funciona** (publicar no painel Sites) |
| Robô público do chatbot | `https://app.vexorasuite.com.br/p/<token>` | **Funciona** (publicar no painel Chatbots) |
| Painel administrativo | `https://app.vexorasuite.com.br/` | **Funciona** |
| API | `https://api.vexorasuite.com.br/` | **Funciona** |

## 2. O que falta na Cloudflare

### 2.1 DNS — apontar os três domínios + o wildcard para o Dokploy

No painel Cloudflare → `vexorasuite.com.br` → DNS → Records → Add record:

| Type | Name | Target | Proxy |
|---|---|---|---|
| `CNAME` | `@` | `dokploy.vexorasuite.com.br` (o hostname público do seu Traefik/Dokploy) | **Proxied (laranja)** |
| `CNAME` | `app` | `dokploy.vexorasuite.com.br` | **Proxied (laranja)** |
| `CNAME` | `api` | `dokploy.vexorasuite.com.br` | **Proxied (laranja)** |
| `CNAME` | `site` | `dokploy.vexorasuite.com.br` | **Proxied (laranja)** |
| `CNAME` | `bot` | `dokploy.vexorasuite.com.br` | **Proxied (laranja)** |
| `CNAME` | `chat` | `dokploy.vexorasuite.com.br` | **Proxied (laranja)** |
| `CNAME` | `*` | `dokploy.vexorasuite.com.br` | **Proxied (laranja)** |
| `CNAME` | `www` | `dokploy.vexorasuite.com.br` | **Proxied (laranja)** |

> Observação: Cloudflare "Proxy laranja" só funciona para o primeiro nível:
> - `site.vexorasuite.com.br` (1 nível) coberto pelo certificado universal;
> - `bot.cliente.vexorasuite.com.br` (2 níveis) **não** coberto pelo universal — precisa wildcard pago ou cert por subdomínio.
> O wildcard `*.vexorasuite.com.br` só cobre **um** nível. Se quiser `bot.clienteA.vexorasuite.com.br`, use CNAME específico por cliente.

### 2.2 SSL/TLS

1. Cloudflare → SSL/TLS → Overview → **Full (strict)**.
2. Em "Edge Certificates", confirmar que o Universal SSL cobre `*.vexorasuite.com.br` (só um nível). Se qualquer subdomínio específico falhar, criar um CNAME por cliente (não o wildcard).
3. Se o Dokploy usar Let's Encrypt HTTP-01 interno do Traefik, o TLS é terminado no Traefik e a Cloudflare só precisa de "Full (strict)" — desde que o Traefik tenha cert válido para `*.vexorasuite.com.br` ou para os domínios enumerados.
   - **Caminho mais seguro**: use o **Certificado de Origem** da Cloudflare (`*.vexorasuite.com.br`, RSA ou ECDSA, válido por 15 anos). No Traefik do Dokploy, configure este cert para os domínios públicos desse stack. Assim não depende de Let's Encrypt nem de desafio de DNS.
   - Alternativa: configurar o Traefik para pedir certs Let's Encrypt por DNS-01 usando um token da Cloudflare (escopo `Zone:DNS:Edit`). Mais propenso a erro se algo expirar.

### 2.3 Verificação de domínio para Sites do cliente (`_vexora-verify.<domínio>`)

O que é: o site de um cliente pode publicar no domínio dele (ex.: `www.institutoluz.com.br`). Para garantir que só o dono do domínio pode apontá-lo ao Véxora, o painel gera um **token TXT** ePede que você

1. No painel Sites (dentro do tenant) → aba "Publicar" → "Adicionar domínio próprio":
   - Domínio: `www.institutoluz.com.br`
   - Um token único aparece (ex.: `vexora-verify=4f7c9a...`).
2. O dono do domínio precisa criar no DNS do cliente:
   - `Type: TXT`
   - `Name: _vexora-verify.www`
   - `Content: vexora-verify=4f7c9a...`
   - TTL: `300` (cinco minutos)
3. O painel consulta o DNS público periodicamente; quando encontra o registro com o valor certo, marca "DNS verificado" e o site passa a responder no domínio dele.

> Este fluxo **já está implementado** (`/api/sites/:id/domain/verify`) e funciona independente de wildcard — ele valida por DNS público, sem precisar de tráfego no domínio.
> O que **não** está implementado ainda é o roteamento Host→site (ver seção 4) — o domínio do cliente só renderiza o site depois que o Traefik e o middleware da aplicação forem configurados.

## 3. O que falta no Dokploy (Traefik)

O Dokploy roda Traefik na frente do stack `compose`. Para que `site.vexorasuite.com.br` e `*.vexorasuite.com.br` cheguem ao container `web` (porta 3000), adicione regras no app no Dokploy:

### 3.1 Pelo painel Dokploy (recomendado)

1. Entre no seu servidor Dokploy → projeto do Véxora → app `web` (ou compose) → **Domains** → **Add domain**:
   - Domínio: `site.vexorasuite.com.br` → serviço: `web` → porta: `3000` → certificado: `letsencrypt` (se você aumentou de certificados) ou use o wildcard.
   - Repita para `bot.vexorasuite.com.br`, `chat.vexorasuite.com.br` e os domínios isolados que quiser expor.
2. Para o wildcard, o Dokploy nem sempre aceita no painel; use as variáveis `TRAEFIK_RULE_ADDITIONAL_HOSTS` com `HostRegexp(...)` (se houver esse campo) ou edite o labels do compose abaixo.

### 3.2 Manualmente via `docker-compose.yml` (Traefik labels)

Em `docker-compose.yml`, serviço `web`, adicione `deploy.labels`:

```yaml
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.vexora-web.rule=Host(`app.vexorasuite.com.br`) || Host(`site.vexorasuite.com.br`) || Host(`bot.vexorasuite.com.br`) || Host(`chat.vexorasuite.com.br`)"
      - "traefik.http.routers.vexora-web.entrypoints=websecure"
      - "traefik.http.routers.vexora-web.tls.certresolver=letsencrypt"
      - "traefik.http.services.vexora-web.loadbalancer.server.port=3000"
```

Para wildcard (exige Traefik `>= v2.5` com `HostRegexp`):

```yaml
      - "traefik.http.routers.vexora-web-all.rule=HostRegexp(`{host:^.+\\.vexorasuite\\.com\\.br$}`)"
```

> O caractere `^` escapado com `\\` é necessário no YAML string.
> Se o Dokploy expõe apenas "Domains" no painel, use o painel e não edite YAML — evite conflito.

### 3.3 Cert TLS para o wildcard

- **Opção A (recomendado) — Certificado de Origem da Cloudflare:**
  1. Cloudflare → SSL/TLS → Certificates (Origin) → **Create Certificate**:
     - Hostnames: `*.vexorasuite.com.br`, `vexorasuite.com.br`
     - Validity: 15 years
     - RSA (default) ou ECDSA
  2. Baixe `*.vexorasuite.com.br.pem` e `*.vexorasuite.com.br.key`.
  3. Monte no Traefik (via Dokploy → volumes): ex. `/data/origin.pem` e `/data/origin.key`, readonly.
  4. Configure o Traefik `entrypoints websecure.tls.certificates` ou crie um `certResolver` externo com esses arquivos, e aponte `tls.certresolver=cloudflare-origin` em vez de `letsencrypt`.
  5. Cloudflare SSL/TLS → Overview → **Full (strict)**.

- **Opção B — Let's Encrypt DNS-01 com Cloudflare API:**
  1. Cloudflare → My Profile → API Tokens → Create Token:
     - Permissions: `Zone : Zone : Read`; `Zone : DNS : Edit`
     - Zone Resources: Include → Specific zone → `vexorasuite.com.br`
  2. No Dokploy/Traefik, passe `CF_API_EMAIL` e `CF_DNS_API_TOKEN` como variáveis e configure o resolver `dnschallenge` apontando para `cloudflare`.
  3. O Traefik renova automaticamente. Não use HTTP-01 com proxy laranja — não funciona.

> O `*.vexorasuite.com.br` (universal) da Cloudflare já faz TLS no edge; se você deixar "Full" (não strict), o Traefik pode usar um cert autossignado. Se preferir "Full (strict)", monte um cert válido no Traefik.

## 4. O que falta na aplicação (código) — sincero

Para que as páginas isoladas funcionem sem expor a UI completa para qualquer `sub.vexorasuite.com.br`, a aplicação precisa de um **middleware de Host**:

- Ler `x-forwarded-host` (ou `host`);
- Reconhecer `site|bot|chat.<empresa>.vexorasuite.com.br`;
- Redirecionar/reescrever para `/sites/<slug>`, `/p/<token>` e `/chat/<token>` (este último cria iframe no `/p/<token>` ou uma página mínima de embed);
- Se não bater nenhum padrão, servir homepage (brand white label) com 404 ou redirecionar para `app.vexorasuite.com.br`.

Nenhuma dessas três etapas foi implementada ainda. O que já existe na aplicação:
- `/p/<token>` renderiza orobô/telar isolada sem moldura da Véxora — está funcionando hoje em `app.vexorasuite.com.br/p/<token>`;
- `/sites/<slug>` renderiza o site finalizado — funcionando hoje em `app.vexorasuite.com.br/sites/<slug>`;
- Ambos servem qualquer Host porque não há condicionamento por Host na aplicação.

> Para colocar o três avisos em pé com risco zero hoje, o mais seguro é: apontar o DNS para o Traefik, configurar o TLS, e adicionar `x-forwarded-host` sem alterar código. Os usuários verão a UI da Véxora em `site.vexorasuite.com.br` — o que não é exatamente o que queremos, mas prova que DNS/TLS está OK.

## 5. Ordem segura para você fazer hoje

1. **Cloudflare**:
   - DNS: CNAMEs `site`, `bot`, `chat`, `*`, `www`, `app`, `api` → `dokploy.vexorasuite.com.br` (proxied).
   - SSL: **Full (strict)** se montar cert no Traefik; **Full** se aceitar cert autossignado interno.
   - Criar/receber o cert de origem `*.vexorasuite.com.br`.
2. **Dokploy**:
   - Serviços → `web` → **Domains** → Add: `site.vexorasuite.com.br` (porta 3000, certresolver escolhido no passo 1).
   - Repetir para `bot.vexorasuite.com.br`, `chat.vexorasuite.com.br`.
   - (Opcional, só após validar TLS) Adicionar wildcard `*.vexorasuite.com.br` via painel ou YAML.
3. **Verificação**:
   - `curl -I https://site.vexorasuite.com.br/` — deve responder HTTP 200 com resposta do Traefik (cabeçalho `server: traefik` ou `CF-RAY`).
   - `https://site.vexorasuite.com.br/sites/<slug>` deve carregar o site finalizado (conteúdo real).
   - `https://bot.vexorasuite.com.br/p/<token>` deve carregar o robô da empresa.
4. **Middleware de Host** (quando quiser isolar de fato):
   - Criar `apps/web/src/middleware.ts` que mapeia `host → target` e executa `NextResponse.rewrite(...)`; este é o passo que a entrega do Fase 5.2 ainda não fez.

## 6. Referências

- `docs/deployment-dokploy.md` — o deploy base do stack.
- `docs/isolated-sites-and-platform-admin.md` — o desenho completo das fases 5.1–5.4 para isolar Marketing, Sites e Robô como produtos independentes.
- `docs/implementacao-register.md` — registro de releases por PR.

## 7. O que não está pronto (e por que isso importa)

- **Redirecionamento automático por Host** não existe. Hoje, qualquer subdomínio serve a UI da Véxora (mesmo site, mesmo html). O cliente não tem login isolado em `site.vexorasuite.com.br`.
- **Tokens por entrega para cliente** — o que hoje torna público qualquer `/p/<token>` sem sessão — passa pelo mesmo processo de criar empresa dentro do Véxora; não há account binding entre o subdomínio e o tenant.
- **Segredos e cotas por segmento** ainda não residem em serviços distintos; todos consomem `POSTGRES_PASSWORD` e `JWT_ACCESS_SECRET`, e as fronteiras são de aplicação (multi-tenancy por código), não por rede.
- **SSL para subdomínios de segundo nível** (`bot.cliente.vexorasuite.com.br`) não é coberto pelo Universal SSL da Cloudflare — exija CNAME específico para cada cliente, ou pague um cert wildcard (Cloudflare Advanced Certificate Manager (~US$10/mês, cobre `*.vexorasuite.com.br` com um wildcard único de um nível — não cobre `bot.cliente.vexorasuite.com.br`)).
- **CORS** (`CORS_ORIGINS`) precisa listar todos os novos hosts que farão chamadas à API — senão o login do painel quebra.
