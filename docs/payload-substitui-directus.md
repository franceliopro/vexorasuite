# Payload CMS substitui o Directus

**Status:** decisão do proprietário em 24/11/2026.  
**Supersede:** `docs/directus-imoveis-contract.md` e todas as seções que indicam Directus em `docs/sites-stack-hibrido.md`, `docs/plano-transicao-presenca-criativos.md` e `README.md`.

Nada aqui afirma que o Payload já foi instalado, migrado ou publicado. A execução real depende de PR revisado, credenciais no cofre e evidência 2xx no domínio final.

**Estado em 25/11/2026:** app self-hosted, migration inicial, cliente na API/Worker (por flag) e guia do Dokploy estão no repositório e validados em CI. Nenhuma instância foi publicada e `SUBMISSIONS_PROVIDER` continua `directus`.

## 1. Motivo

- O Directus impõe limite de assentos para usuários que precisam operar o CMS. A Véxora não aceita sistema com limite de usuários.
- A regra rígida de isolamento (“um cliente não pode ver os dados do outro”) veio de um único cliente. O proprietário consegue fazer esse cliente mudar de ideia e não vai sacrificar um sistema inteiro por causa de um caso.
- O Payload CMS self-hosted é MIT, não cobra por assento e permite uma instância única com papéis, usuários ilimitados e escopo por tenant quando necessário.

## 2. Decisão

1. **Uma instância Payload + Postgres**, self-hosted no Dokploy/VPS, para todos os sites e futuros módulos verticais.
2. **Usuários ilimitados**, com papéis `admin`, `editor`, `agent` e `service`. Não existe mais obrigação de instância por cliente.
3. O tenant continua sendo registrado nos dados e aplicado pela API da Véxora. A separação rígida por cliente deixa de ser requisito bloqueante; se voltar a ser exigida, será implementada por access control do Payload, não por multiplicação de instâncias.
4. Coleções mantidas: `category`, `purpose`, `location`, `property`, `submission`, `media`. O contrato atual de campos é preservado; `owner_id` passa a apontar para usuário do Payload e `directusId` na Véxora passa a ser `cmsId`.
5. O Astro continua consumindo **snapshot Markdown versionado**. O Payload não vira runtime do site nem API pública do front.
6. Hooks do Payload substituem os Flows do Directus para gerar snapshot e notificar. Notificação só é marcada como enviada após resposta 2xx do provedor; configuração não é confirmação.

## 3. Fronteira de verdade

| Dono | Conteúdo |
| --- | --- |
| Tina / Git | páginas, blocos, textos, SEO, navegação e imagens de marca |
| Payload CMS | imóveis, galeria, taxonomias, usuários, permissões, `submission`, decisão e mídia dinâmica |
| Véxora | pedido, preview, aprovação humana, versão, publicação, health-check e auditoria |

O formulário público continua passando pelo Cloudflare Worker. O visitante nunca recebe token de escrita. `200` no formulário significa **recebido e pendente**, não imóvel criado, anúncio publicado ou mensagem entregue.

## 4. Variáveis de ambiente

| Antigo | Novo | Onde fica |
| --- | --- | --- |
| `DIRECTUS_URL` | `PAYLOAD_URL` | cofre do servidor e do Worker |
| `DIRECTUS_TOKEN` | `PAYLOAD_TOKEN` | cofre do servidor e do Worker |
| `DIRECTUS_TENANT_ID` | removido | tenant vem da sessão da Véxora e do campo `tenantId` no Payload |

Nenhuma credencial é copiada entre empresas. Nenhum token aparece no navegador, em log ou em resposta de API.

## 5. Sequência de PRs

1. **Decisão e contrato:** registrados neste documento, com ponteiros antigos atualizados.
2. **API:** `PayloadSubmissionsService` criado com a mesma interface de `DirectusSubmissionsService` (`assertConfigured`, `listPending`, `findByKey`, `decide`), injetado por `SUBMISSIONS_PROVIDER`. O padrão continua `directus` até validação real.
3. **Worker:** caminho de gravação no Payload implementado atrás da mesma flag. Remoção de `DIRECTUS_*` fica para a limpeza final.
4. **App self-hosted:** `infra/payload/` com Payload 3.94.1, Postgres, papéis, acesso por tenant, Dockerfile/Compose e CI (PRs #1313 e #1314).
5. **Migration inicial:** gerada pelo Payload CLI e executada no boot de produção via `prodMigrations` (PRs #1315 e #1316). O CI de smoke sobe o servidor em modo produção contra Postgres descartável e confirma as tabelas (PR #1318). Nada disso é deploy.
6. **Guia operacional:** `infra/payload/DOKPLOY.md` traz o passo a passo simples de publicação (PR #1317).
7. **Dados:** não há o que migrar — o Directus nunca rodou e o proprietário confirmou que não existem dados. `scripts/payload-migrate/` segue apenas como precaução, com dry-run padrão e `--apply` explícito.
8. **Limpeza (bloqueada até deploy real):** remover `directus-submissions.service.ts`, variáveis `DIRECTUS_*`, comentários de migração e renomear `directusId` para `cmsId` com migração revisável; atualizar UI e testes. Só acontece depois de o Payload estar no ar, com contas `admin` e `service` criadas, API key no cofre e um formulário de teste conferido em `submission`.

## 6. Critérios de aceite

- Nenhuma variável `DIRECTUS_*` permanece no repositório, no Worker ou no deploy após o PR 5.
- API e Worker com testes verdes no GitHub Actions; typecheck e build limpos.
- Instância Payload com pelo menos dois usuários criados, sem cobrança por assento, e papéis aplicados.
- Decisões da Véxora continuam gravadas em `site_hub_submission_decisions`, com autor, motivo, horário e idempotência.
- Nenhuma afirmação de publicação, imóvel criado, notificação entregue ou pagamento sem evidência real.

## 7. Fora de escopo

- Não reintroduzir a exigência de instância por cliente nem a presentation com papel de parede.
- Não mexer no núcleo de atendimento, financeiro, CRM, agenda, relatórios, tarefas, configurações ou chatbot nesta mudança.
- Não publicar domínio nem afirmar site “no ar” sem health-check 2xx.

Rastreabem permanece como cliente/segmento de referência, não como identidade global nem fluxo obrigatório.
