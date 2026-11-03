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

Os serviços `ollama`, `speaches`, `pgadmin` e seus instaladores pertencem a perfis opcionais. Não os publique por padrão. Habilite `local-ai` apenas quando houver memória/CPU reservadas; habilite `maintenance` somente durante uma janela administrativa para o pgAdmin.

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
