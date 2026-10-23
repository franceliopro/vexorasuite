# Dokploy — primeiro deploy

## Objetivo
Publicar o ambiente inicial em `app.vexorasuite.com.br`, sem tocar na Véxora Matriz ou no domínio oficial da Rastreabem.

## Antes de publicar
1. Confirmar que o projeto Dokploy novo aponta para `franceliopro/vexorasuite` e para a branch aprovada.
2. Confirmar se o projeto será implantado por Dockerfile ou Docker Compose. A configuração deve corresponder ao método escolhido no Dokploy.
3. Criar serviços/volumes separados para PostgreSQL e Redis; nunca reutilizar os volumes do sistema existente.
4. Configurar DNS e TLS do subdomínio de staging.
5. Cadastrar secrets no Dokploy, não no Git.

## Variáveis
- `NEXT_PUBLIC_APP_URL`: URL pública da web.
- `API_PORT`: porta interna da API.
- `CORS_ORIGINS`: origens web autorizadas, separadas por vírgula.
- `DATABASE_URL`: conexão PostgreSQL privada.
- `REDIS_URL`: conexão Redis privada.
- `WAHA_BASE_URL` e `WAHA_API_KEY`: somente quando a integração for implementada e o endpoint seguro estiver definido.

## Verificações após o deploy
- Home responde por HTTPS.
- Endpoint de saúde da API responde em `/api/health`.
- Logs não contêm segredos.
- A aplicação nova não compartilha banco, volumes, chaves ou sessões com a Matriz.
- Nenhum tráfego de produção é redirecionado sem aceite explícito.

> O scaffold inicial não é ainda um CRM operacional. O banco, autenticação, autorização, migrations, realtime e integração WAHA serão implementados e testados em etapas seguintes.
