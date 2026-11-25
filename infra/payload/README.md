# Payload CMS — Alto Araguaia Imóveis

Aplicação Payload CMS self-hosted, pronta para ser publicada no Dokploy. Este diretório contém código: nenhuma instância foi criada, nenhum domínio foi publicado e nenhum dado foi importado até agora.

A decisão e a sequência completa estão em `docs/payload-substitui-directus.md`.

## O que é, em palavras simples

- É o lugar onde imóveis, fotos, taxonomias e formulários serão guardados no futuro.
- Substitui o Directus, que nunca chegou a ser instalado. **Não há dados para migrar.**
- Uma única instância atende vários sites. Não existe cobrança por usuário.
- O site público continua lendo arquivos Markdown versionados; ele não consulta este CMS em tempo de execução.

## Coleções

| Coleção | Finalidade |
| --- | --- |
| `users` | contas com papéis `admin`, `editor`, `agent`, `service` e API key |
| `category`, `purpose`, `location` | taxonomias usadas pelos filtros do site |
| `property` | imóvel com `code`, dono, taxonomias, preço, status e galeria |
| `submission` | formulário público, com `submission_key` para idempotência |
| `media` | catálogo de mídia legada por URL |

`tenantId` é gravado em todos os documentos. Ele identifica o site; **não é limite de usuário** e não é uma promessa de isolamento rígido entre empresas.

## Papéis

| Papel | Permissão |
| --- | --- |
| `admin` | tudo, incluindo usuários e API keys |
| `editor` | cria e edita conteúdo, decide submissões |
| `agent` | cria imóveis; edita/apaga somente os próprios (`owner_id`) |
| `service` | conta de integração usada pela API e pelo Worker via API key |

Nenhuma conta é criada automaticamente. O primeiro `admin` e a conta `service` são criados por uma pessoa no Studio.

## Variáveis de ambiente

Preenchidas **somente no cofre do Dokploy**:

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | conexão Postgres |
| `PAYLOAD_SECRET` | chave de assinatura; trocar invalida as API keys |
| `POSTGRES_USER`, `POSTGRES_PASSWORD` | banco no Compose |
| `POSTGRES_DB` | nome do banco (padrão `vexora_payload`) |
| `PAYLOAD_PORT` | porta exposta (padrão `3000`) |

`PAYLOAD_URL`, `PAYLOAD_TOKEN` e `PAYLOAD_TENANT_ID` pertencem aos **consumidores** (API da Véxora e Worker do formulário). Não são variáveis deste app e nunca devem ser coladas no chat ou versionadas.

O app falha com mensagem explícita se `DATABASE_URL` ou `PAYLOAD_SECRET` estiverem ausentes. Não existe valor padrão escondido.

## Rodando localmente

```sh
cd infra/payload
cp .env.example .env
# edite .env com valores locais, nunca reais de produção
pnpm install --no-frozen-lockfile
pnpm run dev
```

O Studio fica em `/admin` e o health-check mínimo em `/health`. O health-check não consulta banco: **`200` nele não prova integração nem publicação.**

## Schema e migrations

O Postgres **não** cria tabelas sozinho em produção. A migration inicial
(`src/migrations/20261125_024632_initial.ts`) está versionada e é executada
automaticamente na inicialização do container via `prodMigrations`. Ela cria
tabelas e índices; a função `down` existe apenas para reversão explícita e não
é executada automaticamente.

Ao alterar coleções ou campos, gere uma nova migration em ambiente de
desenvolvimento e rode `pnpm payload migrate` antes de publicar. A URL do
banco e o segredo continuam apenas no cofre.
## API key da conta de serviço

1. Entre no Studio com uma conta `admin`.
2. Crie um usuário com papel `service` e `tenantId` do site.
3. Gere a API key e copie uma vez — o Payload não mostra o valor depois.
4. Guarde a chave no cofre da API e do Worker.

O cabeçalho usado pelos consumidores é `Authorization: users API-Key <chave>`. A mesma chave não deve ser reutilizada entre sites ou ambientes.

## O que NÃO está incluído neste PR

- Publicação, domínio, health-check 2xx em produção ou criação de imóvel real.
- Importação do Directus (não existe instância nem dado).
- Hook de snapshot Markdown. Isso virá em PR separado e exigirá credencial de Git no cofre.
- Notificações por e-mail/WhatsApp. Nenhuma mensagem é marcada como enviada sem confirmação 2xx do provedor.
- Geração de arte por modelo de IA. Sem modelo configurado, o fluxo deve falhar claro: **não existe fallback e nenhuma imagem é inventada**.
- Mudança no padrão `SUBMISSIONS_PROVIDER`, que continua `directus` até validação real do Payload.

## Verificação automática

O workflow `.github/workflows/payload-app.yml` roda `typecheck` e `build` no GitHub Actions usando valores de CI. Nenhum segredo real é necessário para compilar.
