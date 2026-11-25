# Publicar o Payload no Dokploy — passo a passo

Este guia cria **o CMS**. Ele não cria imóveis, não publica anúncios, não envia mensagens e não mexe no site público. O site continua lendo arquivos Markdown versionados.

Nenhuma senha, chave ou token deve ser colado no chat. Tudo fica no cofre do Dokploy.

## 1. Criar o projeto

1. No Dokploy, abra **Projects** → **New Project** e chame-o de `Vexora CMS`.
2. Dentro do projeto, clique em **Create Service** → **Compose**.
3. Em **Compose Type**, escolha **Docker Compose**.

## 2. Ligar o serviço ao GitHub

Preencha:

| Campo | Valor |
| --- | --- |
| Provider | GitHub |
| Repository | `franceliopro/vexorasuite` |
| Branch | `main` |
| Compose Path | `./infra/payload/docker-compose.yml` |
| Watch Paths | `infra/payload/*` |

O **Watch Paths** evita que o CMS seja reconstruído quando mudar outro lugar do repositório.

Salve.

## 3. Preencher as variáveis no cofre

Na aba de variáveis/ambiente do serviço, crie apenas estes nomes:

| Nome | Valor |
| --- | --- |
| `POSTGRES_USER` | usuário do banco, por exemplo `vexora` |
| `POSTGRES_PASSWORD` | senha longa e aleatória, gerada no próprio cofre |
| `POSTGRES_DB` | `vexora_payload` |
| `PAYLOAD_SECRET` | chave longa e aleatória, gerada no próprio cofre |
| `PAYLOAD_PORT` | `3000` (opcional; já é o padrão) |

Não preencha `DATABASE_URL`: o Compose monta essa URL sozinho a partir das variáveis do Postgres.

`PAYLOAD_URL`, `PAYLOAD_TOKEN` e `PAYLOAD_TENANT_ID` **não** são deste serviço. Ficam no cofre da API e do Worker da Véxora, na etapa 6.

Atenção: trocar `PAYLOAD_SECRET` depois de criar API keys invalida essas chaves.

## 4. Colocar o domínio

1. Abra a aba **Domains** do serviço.
2. Adicione o domínio que quiser usar e aponte para a porta `3000`.
3. Aguarde o certificado TLS.

## 5. Subir e criar as contas

1. Clique em **Deploy** e acompanhe os logs. As tabelas do banco são criadas automaticamente na subida do container; não é preciso rodar comando de migration na mão.
2. Abra `https://seu-dominio/admin`. Crie o primeiro usuário com papel `admin` — faça isso apenas uma vez, ainda no primeiro acesso.
3. Crie um usuário com papel `service` e o `tenantId` do site. Gere a API key dessa conta e guarde-a no cofre da API/Worker. O Payload mostra o valor uma única vez.

O volume `pgdata` guarda o banco. Não o apague ao atualizar o serviço.

## 6. Só depois: ligar o formulário ao Payload

No cofre da **API** e do **Worker**, configure:

| Nome | Valor |
| --- | --- |
| `SUBMISSIONS_PROVIDER` | `payload` |
| `PAYLOAD_URL` | `https://seu-dominio` |
| `PAYLOAD_TOKEN` | a API key da conta `service` |
| `PAYLOAD_TENANT_ID` | o identificador do site no CMS |

Envie um formulário de teste e confirme que apareceu em `submission` no Studio.

- `200` no formulário significa **recebido e pendente**. Não significa imóvel criado, anúncio publicado ou mensagem entregue.
- O `/health` não consulta o banco. `200` nele não prova integração.
- Se algo não funcionar, volte `SUBMISSIONS_PROVIDER` para `directus`. Isso não apaga nada e restaura o comportamento anterior.

## O que ainda não existe

Até a execução deste guia, não há instância Payload, domínio publicado, usuário criado, dado importado ou integração ativa. O Directus nunca rodou, então não há dados para migrar.

Se o deploy falhar, leia os logs do serviço. Não cole trechos que possam conter segredos no chat.
