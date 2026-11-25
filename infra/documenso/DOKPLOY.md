# Documenso — stack separada no Dokploy

Este diretório descreve apenas a infraestrutura de assinatura eletrônica. **Nenhuma credencial, token, senha, chave ou certificado deve entrar no Git ou no chat.** Os valores reais ficam somente no cofre do Dokploy.

## Limites

- Usar a **imagem oficial** `documenso/documenso` (Community Edition, AGPL-3.0). Não fork, não modificar a imagem, não aplicar patch ao código do Documenso.
- Projeto Dokploy **separado** do stack Véxora e do stack Payload: banco, volume, domínio e segredos próprios. Nunca reutilizar volumes ou credenciais de outro ambiente.
- A presença deste Compose **não** significa que a stack foi publicada nem que assinaturas foram enviadas. Para afirmar qualquer deploy é necessário verificar o deploy no Dokploy e o healthcheck da aplicação.
- `200` em criação de envelope pela API significa envelope criado/pendente; **não** prova assinatura concluída.

## Variáveis no cofre do Dokploy

| Variável | Origem |
| --- | --- |
| `DOCUMENSO_POSTGRES_USER` |Nome do usuário do banco exclusivo desta stack |
| `DOCUMENSO_POSTGRES_PASSWORD` | Senha gerada no cofre (`openssl rand -base64 24`) |
| `DOCUMENSO_POSTGRES_DB` | Nome do banco exclusivo desta stack |
| `DOCUMENSO_NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `DOCUMENSO_ENCRYPTION_KEY` | `openssl rand -base64 32` (mínimo 32 caracteres) |
| `DOCUMENSO_ENCRYPTION_SECONDARY_KEY` | `openssl rand -base64 32` (mínimo 32 caracteres) |
| `DOCUMENSO_PUBLIC_URL` | Domínio público da instância, ex.: `sign.exemplo.com` (sem `https://`) |
| `DOCUMENSO_SMTP_HOST` | Host SMTP real |
| `DOCUMENSO_SMTP_PORT` | Porta SMTP (padrão `587`) |
| `DOCUMENSO_SMTP_USERNAME` | Usuário SMTP real |
| `DOCUMENSO_SMTP_PASSWORD` | Senha SMTP real |
| `DOCUMENSO_SMTP_FROM_ADDRESS` | Remetente verificado |
| `DOCUMENSO_SIGNING_PASSPHRASE` | Senha do certificado local `.p12` |
| `DOCUMENSO_CERT_PATH` | Caminho absoluto, no host, do `.p12` somente-leitura |
| `DOCUMENSO_IMAGE` | Opcional: fixar uma versão oficial em vez de `latest` |
| `DOCUMENSO_PORT` | Opcional: porta publicada no host (padrão `3000`) |
| `DOCUMENSO_SMTP_TRANSPORT` | Opcional: transporte SMTP (padrão `smtp-auth`) |
| `DOCUMENSO_SMTP_FROM_NAME` | Opcional: nome do remetente |

Não existe `NEXT_PRIVATE_DOCUMENSO_LICENSE_KEY` nesta stack: a edição Community não usa licença paga.

O token de API para integração com a Véxora deve ser criado **dentro do Documenso** quando a integração for implementada, e guardado somente no cofre do Dokploy da Véxora. Nunca commitar esse token e nunca pedi-lo no chat.

## Configuração no Dokploy

1. Criar um projeto novo, separado, apontando para a branch aprovada.
2. Selecionar Docker Compose e usar `./infra/documenso/compose.yml` como Compose Path.
3. Cadastrar todas as variáveis acima no secret store **antes** do primeiro deploy.
4. Criar volumes novos e exclusivos; não reutilizar o volume do PostgreSQL da Véxora nem do Payload.
5. Configurar DNS e TLS (reverse proxy) para o domínio em `DOCUMENSO_PUBLIC_URL`.
6. Fazer o primeiro deploy e verificar os healthchecks e o acesso ao domínio antes de considerar a stack disponível.
7. Fazer backup do volume `documenso-pgdata` antes de qualquer atualização de imagem.

## Rollback

- Mantido o volume exclusivo, voltar à imagem anterior alterando apenas `DOCUMENSO_IMAGE` no cofre.
- Nunca trocar as chaves de criptografia sem plano de re-encriptação: isso pode tornar documentos antigos ilegíveis.
- Nunca apagar o volume para “corrigir” um erro de configuração sem backup.
