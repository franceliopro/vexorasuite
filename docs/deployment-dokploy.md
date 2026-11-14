# Deploy da Véxora Suite no Dokploy

## Escopo

Este stack publica a Véxora Suite em um ambiente separado. Ele não deve compartilhar banco, volumes, chaves, sessões ou domínio com a Véxora Matriz ou com a operação oficial da Rastreabem.

O arquivo de implantação é o `docker-compose.yml` da raiz. O deploy deve usar Compose; os Dockerfiles individuais são usados pelo próprio Compose e pelo CI.

## Serviços do perfil padrão

- `web`: Next.js na porta interna 3000.
- `api`: NestJS na porta interna 3001, com `/api/health`.
- `webhook-worker`: entrega assíncrona de webhooks e limpeza de eventos realtime.
- `scheduler-worker`: jobs periódicos, áudio, saúde de canais, cadências e reconciliações.
- `postgres`: PostgreSQL privado, persistido em `postgres_data`.
- `redis`: contador compartilhado de rate limit e cache operacional, persistido em `redis_data`.
- `waha`: gateway WhatsApp privado, persistido em `waha_sessions`.
- `searxng`: busca privada usada pela Intelligence, sem publicação externa.

Os serviços `ollama`, `speaches`, `pgadmin` e seus instaladores pertencem a perfis opcionais. Não os publique por padrão. Habilite `local-ai` apenas quando houver memória/CPU reservadas; habilite `maintenance` somente durante uma janela administrativa para o pgAdmin. O `llama-cpp` também vive no perfil `local-ai` e serve o blob .gguf indicado por `LLAMA_CPP_MODEL_BLOB`.

## Configuração obrigatória no Dokploy

Cadastre os valores reais no secret store do Dokploy, nunca no Git:

- `POSTGRES_PASSWORD`
- `JWT_ACCESS_SECRET`
- `PGADMIN_DEFAULT_EMAIL` e `PGADMIN_DEFAULT_PASSWORD` apenas se o perfil `maintenance` for habilitado
- `CORS_ORIGINS` com a origem HTTPS exata da web
- `NEXT_PUBLIC_APP_URL`, `PUBLIC_APP_URL`, `WEB_PUBLIC_URL` e `API_PUBLIC_URL` com as URLs públicas corretas
- `WEBHOOK_ENCRYPTION_KEY` para manter estáveis os segredos armazenados dos webhooks
- `INTEGRATION_ENCRYPTION_KEY` e `GOOGLE_TOKEN_ENCRYPTION_KEY` quando integrações armazenadas forem usadas
- `WAHA_API_KEY` se o gateway exigir autenticação
- `ZERNIO_API_KEY` e `ZERNIO_WEBHOOK_SECRET` quando o canal Zernio estiver ativo
- chaves de IA somente quando o provedor correspondente for habilitado

O `.env.example` contém os nomes e valores de desenvolvimento. Não copie valores de exemplo para produção.

## Valores operacionais importantes

- `TRUST_PROXY=1` quando houver um único Traefik/Dokploy na frente da API; use `0` se a API estiver diretamente exposta.
- `RATE_LIMIT_ENABLED=true` e os limites de rate limit devem ser ajustados conforme o tráfego.
- `WAHA_IMAGE` e `WHATSAPP_DEFAULT_ENGINE` são configuráveis pelo ambiente e chegam ao serviço WAHA.
- `SCHEDULER_MODE=worker`; o scheduler dedicado é o proprietário dos jobs periódicos.
- Não publique as portas de PostgreSQL, Redis, WAHA ou SearXNG. O Compose usa `expose` e a rede interna.

## Referência de variáveis do Compose

Gerada a partir de `docker-compose.yml`; confira o arquivo se algo divergir. **Obrigatória** significa que o Compose recusa subir sem o valor. Os demais itens têm padrão ou são opcionais (vazio desativa a integração correspondente).

### Aplicação e segurança

| Variável | Situação | Padrão |
|---|---|---|
| `API_PUBLIC_URL` | Opcional | `https://api.vexorasuite.com.br` |
| `CORS_ORIGINS` | Opcional | `https://app.vexorasuite.com.br` |
| `INTEGRATION_ENCRYPTION_KEY` | Opcional | vazio |
| `JWT_ACCESS_SECRET` | **Obrigatória** | — |
| `NEXT_PUBLIC_APP_URL` | Opcional | `https://app.vexorasuite.com.br` |
| `PUBLIC_APP_URL` | Opcional | `https://app.vexorasuite.com.br` |
| `TRUST_PROXY` | Opcional | `1` |
| `WEB_PUBLIC_URL` | Opcional | `https://app.vexorasuite.com.br` |

### Banco

| Variável | Situação | Padrão |
|---|---|---|
| `POSTGRES_DB` | Opcional | `vexorasuite` |
| `POSTGRES_PASSWORD` | **Obrigatória** | — |
| `POSTGRES_USER` | Opcional | `vexora` |

### E-mail

| Variável | Situação | Padrão |
|---|---|---|
| `MAIL_FROM` | Opcional | vazio |
| `MAIL_FROM_NAME` | Opcional | `Vexora Suite` |
| `MAIL_HOST` | Opcional | vazio |
| `MAIL_PASSWORD` | Opcional | vazio |
| `MAIL_PORT` | Opcional | `587` |
| `MAIL_REPLY_TO` | Opcional | vazio |
| `MAIL_SECURE` | Opcional | vazio |
| `MAIL_SERVICE` | Opcional | vazio |
| `MAIL_TRANSPORT` | Opcional | vazio |
| `MAIL_USER` | Opcional | vazio |

### Google

| Variável | Situação | Padrão |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Opcional | vazio |
| `GOOGLE_CLIENT_SECRET` | Opcional | vazio |
| `GOOGLE_MAPS_API_KEY` | Opcional | vazio |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | Opcional | vazio |

### IA local

| Variável | Situação | Padrão |
|---|---|---|
| `LOCAL_TTS_VOICE` | Opcional | `pf_dora` |
| `LOCAL_VOICE_URL` | Opcional | vazio |
| `LLAMA_CPP_BASE_URL` | Opcional | `http://llama-cpp:8080` (Compose, perfil `local-ai`) |
| `LLAMA_CPP_MODEL_BLOB` | Opcional | blob qwen2.5:1.5b do Ollama |
| `LLAMA_CPP_API_KEY` | Opcional (somente se o llama-server subiu com `--api-key`) | vazio |
| `OLLAMA_BASE_URL` | Opcional | vazio |
| `OLLAMA_DEFAULT_MODEL` | Opcional | `qwen2.5:1.5b` |

### Meta

| Variável | Situação | Padrão |
|---|---|---|
| `META_APP_ID` | Opcional | vazio |
| `META_APP_SECRET` | Opcional | vazio |
| `META_OAUTH_REDIRECT_URI` | Opcional | vazio |
| `META_WEBHOOK_APP_SECRET` | Opcional | vazio |
| `META_WEBHOOK_VERIFY_TOKEN` | Opcional | vazio |

### Provedores de IA

| Variável | Situação | Padrão |
|---|---|---|
| `BRAVE_SEARCH_API_KEY` | Opcional | vazio |
| `OPENAI_API_KEY` | Opcional | vazio |
| `OPENROUTER_API_KEY` | Opcional | vazio |

### Rate limit

| Variável | Situação | Padrão |
|---|---|---|
| `RATE_LIMIT_AUTH_AUX_PER_MIN` | Opcional | `60` |
| `RATE_LIMIT_AUTH_PER_MIN` | Opcional | `10` |
| `RATE_LIMIT_ENABLED` | Opcional | `true` |
| `RATE_LIMIT_READ_PER_MIN` | Opcional | `900` |
| `RATE_LIMIT_UPLOAD_PER_MIN` | Opcional | `60` |
| `RATE_LIMIT_WRITE_PER_MIN` | Opcional | `240` |

### Sessões

| Variável | Situação | Padrão |
|---|---|---|
| `AUTH_ACCESS_TTL_SECONDS` | Opcional | `1800` |
| `AUTH_REFRESH_TTL_DAYS` | Opcional | `30` |

### Tempo real e jobs

| Variável | Situação | Padrão |
|---|---|---|
| `REALTIME_EVENT_RETENTION_DAYS` | Opcional | `7` |
| `REALTIME_POLL_MS` | Opcional | `5000` |
| `SCHEDULER_MODE` | Opcional | `worker` |
| `WEBHOOK_ENCRYPTION_KEY` | **Obrigatória** | — |
| `WEBHOOK_WORKER_BATCH_SIZE` | Opcional | `25` |
| `WEBHOOK_WORKER_INTERVAL_MS` | Opcional | `2000` |

### WhatsApp (WAHA)

| Variável | Situação | Padrão |
|---|---|---|
| `WAHA_API_KEY` | Opcional | vazio |
| `WAHA_BASE_URL` | Opcional | `http://waha:3000` |
| `WAHA_EVENTS_DOWNLOAD_MEDIA` | Opcional | `true` |
| `WAHA_GOWS_DEVICE_HISTORY_SYNC_FULL_SYNC_DAYS_LIMIT` | Opcional | `0` |
| `WAHA_GOWS_DEVICE_HISTORY_SYNC_FULL_SYNC_SIZE_MB_LIMIT` | Opcional | `1` |
| `WAHA_GOWS_DEVICE_HISTORY_SYNC_INITIAL_SYNC_MAX_MESSAGES_PER_CHAT` | Opcional | `0` |
| `WAHA_GOWS_DEVICE_HISTORY_SYNC_RECENT_SYNC_DAYS_LIMIT` | Opcional | `0` |
| `WAHA_GOWS_DEVICE_HISTORY_SYNC_STORAGE_QUOTA_MB` | Opcional | `1` |
| `WAHA_GOWS_DEVICE_REQUIRE_FULL_SYNC` | Opcional | `false` |
| `WAHA_IMAGE` | Opcional | `devlikeapro/waha:gows` |
| `WAHA_MEDIA_STORAGE` | Opcional | `LOCAL` |
| `WHATSAPP_DEFAULT_ENGINE` | Opcional | `GOWS` |
| `WHATSAPP_FILES_LIFETIME` | Opcional | `600` |

### Zernio

| Variável | Situação | Padrão |
|---|---|---|
| `ZERNIO_API_KEY` | Opcional | vazio |
| `ZERNIO_WEBHOOK_SECRET` | Opcional | vazio |

### pgAdmin (perfil maintenance)

| Variável | Situação | Padrão |
|---|---|---|
| `PGADMIN_DEFAULT_EMAIL` | **Obrigatória** | — |
| `PGADMIN_DEFAULT_PASSWORD` | **Obrigatória** | — |

## Ordem segura de publicação

1. Criar um projeto novo no Dokploy apontando para a branch aprovada.
2. Selecionar Docker Compose e a raiz do repositório como contexto.
3. Configurar os secrets antes do primeiro deploy.
4. Criar volumes novos e exclusivos para este ambiente.
5. Configurar DNS e TLS para a web e, se necessário, para a API.
6. Fazer o primeiro deploy e aguardar os healthchecks de PostgreSQL, Redis, API e Web.
7. Confirmar `https://<api>/api/health` e a home da web.
8. Conferir os logs dos workers: devem indicar inicialização, não loop de reinício.
9. Validar login, refresh de sessão, uma conversa de teste e uma entrega de webhook.
10. Só depois liberar tráfego real ou alterar DNS de produção.

## Diagnóstico rápido

- API unhealthy: conferir `POSTGRES_PASSWORD`, migrations, `DATABASE_URL` gerada e logs de `api`.
- Web aguardando API: conferir o healthcheck `/api/health` e a origem pública.
- Rate limit inconsistente: conferir `REDIS_URL` e `TRUST_PROXY`.
- Mensagens WhatsApp sem mídia: conferir `WAHA_EVENTS_DOWNLOAD_MEDIA`, volume e `WHATSAPP_FILES_LIFETIME`.
- Intelligence parada: conferir logs de `scheduler-worker`, estado `engineStatus` das mensagens e conectividade com o provedor configurado.
- Webhook em retry: conferir o status da entrega, o motivo resumido do worker e se o destino HTTPS resolve para rede pública.

## Limite atual da integração Hostinger/Dokploy

A consulta automatizada ao projeto Docker do VPS identificado como `srv1.nexorasuite.com` retornou:

`[VPS:2044] Currently installed operating system does not support Docker Manager.`

Esse retorno impede confirmar o estado dos serviços pelo endpoint da Hostinger; não é evidência de que o Compose esteja falhando. A confirmação final exige acesso funcional ao painel/API do Dokploy ou execução direta no host.

## Isolamento e rollback

- Nunca reutilizar volumes de outro ambiente.
- Nunca trocar secrets de criptografia sem plano de re-encriptação.
- Fazer backup do PostgreSQL antes de migrations.
- Em falha de deploy, retornar à imagem/commit anterior mantendo volumes intactos e coletar os logs antes de qualquer limpeza.
