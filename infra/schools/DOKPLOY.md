# Escolas — contrato e stack separada no Dokploy

Este diretório descreve apenas a infraestrutura e o contrato de vínculo do futuro serviço escolar. **Nenhuma credencial, token, senha ou chave deve entrar no Git ou no chat.** Os valores reais ficam somente no cofre do Dokploy.

## Estado deste slice

- Entregue: Postgres isolado, volume exclusivo e a tabela `tenant_links` com `UNIQUE (tenant_id, provider, external_customer_id)`.
- Não entregue: alunos, turmas, matrículas, notas, mensalidades, API da aplicação, imagem Docker do serviço e deploy. O Dockerfile da aplicação virá junto com o primeiro slice funcional.
- A presença deste Compose **não** prova deploy, conexão com escola, envio de mensagem ou chamada de IA.

## Limites

- Projeto Dokploy **separado** do stack Véxora, do Payload e do Documenso: banco, volume, domínio e segredos próprios. Nunca reutilizar volumes ou credenciais de outro ambiente.
- `tenant_id` é sempre o tenant autenticado na Véxora; nunca é aceito do corpo de uma requisição ou do sistema escolar.
- `provider` identifica o sistema escolar de origem e `external_customer_id` identifica o cliente nesse sistema. A associação é única por essa tríade; tenants diferentes podem apontar para o mesmo cliente externo.
- Nenhum segredo de acesso ao sistema escolar é gravado neste banco; ele fica no cofre da Véxora quando a integração for implementada.
- Sem alunos, turmas ou envios neste slice. Nenhuma IA é chamada daqui.

## Variáveis no cofre do Dokploy

| Variável | Origem |
| --- | --- |
| `SCHOOLS_POSTGRES_USER` | Nome do usuário do banco exclusivo desta stack |
| `SCHOOLS_POSTGRES_PASSWORD` | Senha gerada no cofre (`openssl rand -base64 24`) |
| `SCHOOLS_POSTGRES_DB` | Nome do banco exclusivo desta stack |

## Configuração no Dokploy

1. Criar um projeto novo, separado, apontando para a branch aprovada.
2. Selecionar Docker Compose e usar `infra/schools/docker-compose.yml` como Compose Path.
3. Cadastrar as três variáveis acima no secret store **antes** do primeiro deploy.
4. Criar um volume novo e exclusivo; não reutilizar `postgres_data`, `pgdata` ou `documenso-pgdata`.
5. Não publicar a porta 5432: o banco é alcançável apenas pela rede interna do Compose.
6. Fazer o primeiro deploy e confirmar o healthcheck do banco antes de considerar a stack disponível.
7. Fazer backup do volume `schools-pgdata` antes de qualquer atualização de imagem.

## Verificação do contrato

- `docker compose -f infra/schools/docker-compose.yml config` com as variáveis do cofre (ou valores de CI) deve resolver sem erro.
- A migration `migrations/001_tenant_link.sql` é aplicada pelo initdb somente em volume vazio.
- O CI valida a unicidade por `(tenant_id, provider, external_customer_id)` e confirma que tenants diferentes podem usar o mesmo cliente externo.

## Rollback

- Mantido o volume exclusivo, reverter o Compose para a revisão anterior.
- Nunca apagar o volume para "corrigir" configuração sem backup.
