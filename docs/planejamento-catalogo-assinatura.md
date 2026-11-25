# Catálogo de produtos digitais e serviços + assinatura de documentos

**Status:** proposta de arquitetura aprovada em 25/11/2026. Nada disso foi implantado, publicado ou deployado até aqui. Sites ficam para a frente seguinte.

## Decisões fixadas

1. **Catálogo canônico por tenant.** A fonte da verdade é `CatalogItem` (`apps/api/prisma/schema.prisma`), com `kind` `PRODUCT` ou `SERVICE`, preço em centavos, moeda, unidade, categoria e `active`. Não há estoque físico no MVP.
2. **Nada inventado.** IA, chatbot e atendimento só podem apresentar itens que existem no catálogo do tenant, com nome, descrição e preço lidos do banco. Nunca inventar produto, preço, disponibilidade ou condição comercial.
3. **Um catálogo, todas as superfícies:** Configurações → Catálogo (gestão), composer do atendimento (inserir item na conversa), painel de orçamento, documentos (PDF), chatbot (bloco com item escolhido) e IAs (MCP `search_catalog`, já existente). Todo dado é tenant-scoped.
4. **Documenso Community Edition (AGPL-3.0), sem modificar o código.** Imagem oficial, stack separada no Dokploy, com Postgres, domínio e segredos próprios. Integração pela API do Documenso; nenhuma credencial em Git ou chat.
5. **API de assinatura do gov.br não é substituto imediato.** A documentação oficial (manual-integracao-assinatura-eletronica.servicos.gov.br) exige formalização como órgão público, integração prévia ao Login Único e credenciais OAuth emitidas pelo ITI/MGI. Para Véxora como SaaS privada não há acesso; só considerar se um cliente órgão público trouxer credenciais próprias e fizer a homologação.

## Estado verificado no `main` (`95cb5da7`)

- `CatalogItem` e a migration `20261118150000_catalog_items` já existem.
- `apps/api/src/operations/catalog.controller.ts` expõe `GET /catalog`, `GET /catalog/:id` e CRUD com permissão `OWNER`/`ADMIN`.
- `apps/api/src/operations/mcp.controller.ts` já expõe `search_catalog` para IAs.
- `apps/web/src/app/catalog-quote-panel.tsx` já busca o catálogo e gera orçamento, mas envia `generate` sem `templateId`, enquanto `documents.controller.ts` exige `templateId`. Há também prazos/condições de pagamento fixos no painel que precisam deixar de parecer dados do catálogo.
- `apps/api/src/operations/documents.controller.ts` já gera PDF (`pdfkit`) para `QUOTE`, `CONTRACT`, `WORK_ORDER` e `RECEIPT`, com envio por WhatsApp e e-mail.
- `apps/web/src/app/inbox-workspace.tsx` tem composer com respostas rápidas e variáveis, mas não tem inserção de item do catálogo.
- `apps/api/src/ai/flow-runtime.ts` tem lista fechada de blocos executáveis; não existe bloco de catálogo.
- Não existe integração de assinatura eletrônica nem modelo de assinatura no banco.

## Lacunas a fechar

| # | Lacuna | Superfície |
|---|---|---|
| 1 | Geração de orçamento quebra por falta de `templateId` | API + atendimento |
| 2 | Sem UI de gestão do catálogo (o backend já existe) | Configurações |
| 3 | Sem inserção de item no composer | Todas as inboxes/canais |
| 4 | Sem bloco de catálogo no fluxo | Chatbot |
| 5 | Sem envio de documento para assinatura | Documentos/contratos |

## Plano em PRs pequenos e reversíveis

1. **Este documento** — decisões e evidências (sem código de produção).
2. **Correção do orçamento** — resolver modelo `QUOTE` padrão no servidor quando `templateId` não vier; remover condições comerciais inventadas do painel; teste de contrato.
3. **Gestão do catálogo** — página em Configurações com CRUD usando os endpoints existentes; sem novo model no banco.
4. **Inserção no atendimento** — ação no composer que busca itens ativos e insere snapshot real (nome, tipo, preço, descrição) no texto; disponível em todas as inboxes.
5. **Bloco no chatbot** — bloco `catalog.item` com item escolhido no inspector; runtime valida o item no tenant antes de enviar; falha clara se o item foi desativado; E2E no editor.
6. **Infra do Documenso** — `infra/documenso/compose.yml`, `.env.example` sem segredos, documento de pré-requisitos (Postgres, SMTP, certificado `.p12`, TLS via reverse proxy) e validação de compose no CI. Nenhum deploy afirmado.
7. **Integração de assinatura** — cliente da API do Documenso, modelo `DocumentSignature` por tenant/documento, endpoint "enviar para assinatura" e leitura de status; estados explícitos: `CONFIGURED`, `SENT`, `SIGNED`, `FAILED` (nunca "assinado" por presunção).
8. **UI de assinatura no documento** — botão e status na tela do documento, com link para o envelope quando existir.
9. **Syncs `foundation` → `main`** após cada lote, com CI verde antes de mesclar.

## Critérios de aceite

- Preço e dados exibidos vêm sempre do `CatalogItem` do tenant; if item desativado, falha clara, sem fallback inventado.
- Orçamento e contrato registram snapshot dos itens no `values` do documento, para não mudar com reajuste posterior.
- Assinatura só é considerada concluída quando a API do Documenso confirmar; `200` em requisição de criação de envelope significa "enviado/pendente", não "assinado".
- Segredos (SMTP, `NEXTAUTH_SECRET`, chaves de criptografia, token da API do Documenso, certificado) somente no cofre/Dokploy; nunca no repositório ou chat.
- Cada PR passa no CI (incluindo `validate`) antes do merge; merge não é deploy.
