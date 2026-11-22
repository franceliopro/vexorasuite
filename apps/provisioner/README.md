# Provisionador de sites

Serviço interno de operação do projeto Dokploy `Estúdio de Sites`. **O modo padrão é simulação**: sem `PROVISIONER_MODE=real`, nenhuma pasta, banco, usuário, vhost, TLS, DNS ou container é criado.

A camada real está implementada, mas **não foi executada contra a infraestrutura do proprietário**. Ela depende de configuração por ambiente e de endpoints cujos contratos ainda precisam ser validados no servidor real. Nada aqui afirma deploy, domínio no ar ou integração pronta.

## Rotas

| Método | Rota                             | Finalidade                                           |
| ------ | -------------------------------- | ---------------------------------------------------- |
| `GET`  | `/`                              | GUI web                                              |
| `GET`  | `/styles.css`, `/app.js`         | Arquivos estáticos da GUI                            |
| `GET`  | `/health`                        | Verificação do processo e do modo                    |
| `GET`  | `/meta`                          | Modo, capacidades, versões PHP e versões legadas     |
| `POST` | `/provision/dry-run`             | Valida e devolve o plano, sem aplicar                |
| `POST` | `/provision/:requestId/approve`  | Registra aprovação humana (obrigatória no modo real) |
| `POST` | `/provision/apply`               | Executa o plano; no real, exige aprovação e health   |
| `GET`  | `/provision/:requestId/status`   | Estado persistido do job                             |
| `POST` | `/provision/:requestId/rollback` | Desfaz apenas recursos do mesmo `requestId`          |
| `POST` | `/webhooks/provision`            | Webhook assinado da Véxora                           |

## Configuração por ambiente

Todas as opções são lidas de `process.env`. Nenhuma senha, token ou string de conexão é aceita como variável direta: apenas **caminhos de arquivos Docker secret**.

| Variável                                | Padrão             | Uso                                                   |
| --------------------------------------- | ------------------ | ----------------------------------------------------- |
| `PROVISIONER_MODE`                      | `simulation`       | `simulation` ou `real`                                |
| `PROVISIONER_ALLOW_REAL_APPLY`          | desligado          | Deve ser `1`/`true` para habilitar `apply` real       |
| `PROVISIONER_STATE_FILE`                | vazio (memória)    | Arquivo JSON do estado dos jobs                       |
| `PROVISIONER_SITES_ROOT`                | vazio              | Raiz das pastas dos sites                             |
| `PROVISIONER_TRAEFIK_CONFIG_DIR`        | vazio              | Diretório de config dinâmica do Traefik               |
| `PROVISIONER_TRAEFIK_NETWORK`           | `estudio-de-sites` | Rede interna dos containers                           |
| `PROVISIONER_TLS_RESOLVER`              | vazio              | Nome do resolver TLS do Traefik                       |
| `PROVISIONER_SITE_CONTAINER_TEMPLATE`   | `{slug}`           | Nome do container na rede interna                     |
| `PROVISIONER_SITE_PORT`                 | `80`               | Porta do serviço interno do site                      |
| `PROVISIONER_PHP_IMAGE_TEMPLATE`        | vazio              | Modelo de imagem com `{version}`; nunca `latest`      |
| `PROVISIONER_PHP_IMAGES`                | `{}`               | JSON opcional `{"8.3":"registry/...:tag"}` por versão |
| `PROVISIONER_DB_ADMIN_URL`              | vazio              | Endpoint HTTP interno de administração do MariaDB     |
| `PROVISIONER_DB_ADMIN_SECRET_FILE`      | vazio              | Secret com o token desse endpoint                     |
| `PROVISIONER_FILEBROWSER_URL`           | vazio              | URL interna do Filebrowser                            |
| `PROVISIONER_FILEBROWSER_SECRET_FILE`   | vazio              | Secret com o token do Filebrowser                     |
| `PROVISIONER_WEBHOOK_SECRET_FILE`       | vazio              | Secret com a chave HMAC do webhook                    |
| `PROVISIONER_WEBHOOK_TOLERANCE_SECONDS` | `300`              | Janela máxima de defasagem do timestamp               |
| `PROVISIONER_HEALTH_TIMEOUT_MS`         | `5000`             | Timeout por tentativa de health-check                 |
| `PROVISIONER_HEALTH_RETRIES`            | `1`                | Tentativas adicionais                                 |

No modo `real`, a inicialização falha se faltarem `STATE_FILE`, `SITES_ROOT`, `TRAEFIK_CONFIG_DIR`, `TLS_RESOLVER`, `WEBHOOK_SECRET_FILE`, um modelo de imagem PHP e `ALLOW_REAL_APPLY`. A validação também recusa qualquer imagem com a tag `latest`. Veja `apps/provisioner/.env.example`.

### Contratos HTTP configuráveis

- MariaDB: `POST {DB_ADMIN_URL}/operations` com `Authorization: Bearer <secret>` e corpo `{operation, requestId, tenantId, slug, database, passwordSecretName}`. Operações: `create-database`, `create-user`, `drop-database`, `drop-user`.
- Filebrowser: `POST {URL}/api/users` para criar e `DELETE {URL}/api/users/:username` para remover, com `Authorization: Bearer <secret>`. O provisionador **não envia senhas**; ele informa apenas o nome do secret que deve conter a senha.

Esses contratos precisam ser conferidos com as versões efetivamente instaladas antes de qualquer `apply` real. Nenhuma chamada é feita em simulação.

## Webhook assinado

`POST /webhooks/provision` exige:

- `x-vexora-timestamp`: segundos Unix dentro da janela configurada;
- `x-vexora-correlation-id`: ID de correlação;
- `x-vexora-signature`: `sha256=` + HMAC-SHA256 de `timestamp.corpo`;
- corpo JSON com `event` e `payload`.

Eventos: `provision.dry-run`, `provision.approve`, `provision.apply`, `provision.status`, `provision.rollback`. A assinatura é comparada em tempo constante. A chave vem somente de `PROVISIONER_WEBHOOK_SECRET_FILE` — escopo e rotação ainda a definir com o proprietário.

## Contrato mínimo

```json
{
  "requestId": "vx-1001",
  "tenantId": "tenant-a",
  "slug": "alto-araguaia-imoveis",
  "domain": "exemplo.com.br",
  "type": "php-mysql",
  "phpVersion": "8.3",
  "quotaGb": 2,
  "source": "valuehost"
}
```

`type` aceita `php-mysql` ou `nextjs`. As 17 versões de 5.2 a 8.6 estão habilitadas; 5.x e 7.x geram aviso no `dry-run` e exigem `confirmLegacy: true` no `apply`. O padrão da GUI continua na linha 8.x.

## Segurança e honestidade operacional

- `requestId` é a chave de idempotência; reutilizá-lo com dados diferentes retorna `409`.
- Campos desconhecidos são descartados; senhas e tokens enviados no corpo não aparecem em plano, status, arquivo de estado ou resposta.
- O estado é gravado de forma atômica em `PROVISIONER_STATE_FILE` quando configurado; sem isso, fica apenas em memória.
- `apply` real exige aprovação registrada e, para PHP legado, confirmação explícita.
- Publicação (`published: true`, `tls: "configured"`) só aparece depois de health-check **real** com resposta 2xx no domínio final. Falha de health marca o job como `failed` e não afirma publicação.
- Rollback é melhor esforço e limitado aos recursos criados pelo mesmo `requestId`; ele nunca altera DNS e não desfaz mudanças feitas fora do job.
- Senhas são referenciadas por nome de secret, nunca geradas em log, response ou variáveis visíveis na GUI.

## Comandos

```sh
pnpm --filter @vexorasuite/provisioner build
pnpm --filter @vexorasuite/provisioner test
pnpm --filter @vexorasuite/provisioner start
```
