# Catálogo de produtos digitais e serviços + assinatura de documentos

**Status:** base de decisões e acompanhamento. A branch `feat/finance-catalog-subscriptions` implementou o escopo inicial de catálogo/Asaas descrito abaixo; a rodada de 2026-11-26 tornou o **Catálogo** um módulo próprio e compartilhado por Asaas, Stripe e InfinitePay. A aba em uma plataforma só aparece quando ela é a preferência escolhida no Catálogo. A mesma rodada acrescentou publicação explícita por plataforma e importação inversa de itens criados nas plataformas. Nada aqui foi publicado ou deployado; a existência de código ou teste não prova operação real em ambiente externo.

## Decisões fixadas

1. **Catálogo canônico por tenant.** A fonte da verdade é `CatalogItem` (`apps/api/prisma/schema.prisma`), com `kind` `PRODUCT` ou `SERVICE`, preço em centavos, moeda, unidade, categoria, `imageUrl` e `active`. Não há estoque físico no MVP.
2. **Nada inventado.** Toda superfície lê nome, descrição, preço e disponibilidade do `CatalogItem` do tenant. Nunca inventar produto, preço, disponibilidade ou condição comercial. No formulário de assinatura, o navegador envia apenas `catalogItemId`, datas e dados do cliente; nome e valor vêm do servidor.
3. **Imagem e descrição são privadas da Véxora.** No bloco `catalog.item`, `imageUrl` e `description` ficam somente em metadata interna da mensagem e nos detalhes de auditoria. Nenhum dos dois entra no texto entregue a WhatsApp, e-mail ou outros canais externos.
4. **Exclusão confirmada.** Cliente e assinatura no Asaas são removidos somente após confirmação explícita (`EXCLUIR`) e resposta de sucesso do `DELETE`. A UI não afirma exclusão antes dessa resposta.
5. **Rastreabem é referência de segmento/teste**, nunca identidade global nem fluxo obrigatório.
6. **Documenso/gov.br ficam fora desta entrega.** Documenso Community Edition exigiria stack separada, segredos próprios e evidência de deploy; a API gov.br exige formalização como órgão público e credenciais ITI/MGI. Nenhuma integração de assinatura eletrônica foi implementada aqui.
7. **Vitrine externa tem contrato próprio.** O bot, a IA e o atendente podem enviar 1 item sob demanda ou o catálogo completo por links derivados de uma URL HTTPS configurada. O feed público usa whitelist de campos aprovados (`publicDescription`, `publicImageUrl`, `publicLink`); os campos internos `description`/`imageUrl` do `catalog.item` não viram texto de canal. O destino do link é solicitação de proposta, não checkout real; publicação, envio e pagamento nunca são afirmados sem evidência.
8. **Publicação é um espelho explícito, não uma troca da fonte canônica.** `CatalogItem` continua sendo a fonte única; `CatalogPublication` registra no máximo uma linha por `(tenant, item, plataforma)`. Um item pode ter vários espelhos. A publicação cria o objeto compatível com cada API documentada e só é marcada como confirmada após resposta utilizável; importação inversa cria o item básico na Véxora e deixa os campos aprovados para preenchimento humano.

## Implementado nesta branch (código + testes locais)

| Item | Evidência no código | Limite honesto |
|---|---|---|
| Filtro por categoria no catálogo | `CatalogController.list(req, q, kind, category, limit, includeInactive)` e teste em `catalog-scope.spec.ts` | Não cria itens nem altera catálogo de outro tenant |
| Serviços e assinaturas Asaas em `AsaasService` | `asaas.service.ts` e 4 testes novos em `asaas.service.spec.ts` | Depende de credenciais e retorno real do Asaas para operar |
| `DELETE` de assinatura/cliente com auditoria | `finance.controller.ts` e `finance.controller.spec.ts` | A confirmação do provedor é necessária; falha não é sucesso simulado |
| Catálogo integrado no Asaas | `finance-workspace.tsx` busca `/api/backend/finance/catalog-provider` e, só quando a preferência for `ASAAS`, mostra a aba Catálogo com o mesmo catálogo do menu | Imagem e descrição ficam na Véxora; nada é enviado a canais externos |
| Modal de nova assinatura refatorado | `useModalDialog`, dropdown de serviços, "Criar outros…", `endDate`, payload sem `service`/`value` | Não cria serviço novo fora de Configurações → Catálogo |
| Abertura de Configurações → Catálogo | evento interno `vexora:open-catalog` em `finance-workspace.tsx`, tratado em `page.tsx` | Somente papéis `OWNER`/`ADMIN`/`MANAGER` |
| `catalog.item` no runtime | `intelligence-runtime.service.ts` valida item ativo do tenant e mantém imagem/descrição internas | Não promete preço, estoque ou condição não gravados no catálogo |

## Vitrine externa — contrato implementado na API (2026-11-26)

| Item | Evidência no código | Limite honesto |
|---|---|---|
| Campos públicos aprovados | `CatalogItem.publicDescription`, `publicImageUrl`, `publicLink` em `schema.prisma`, migration `20261126160000_storefront_public_fields` e whitelist em `CatalogController`/`StorefrontCatalogService` | `description` e `imageUrl` continuam privados; URLs públicas só HTTPS |
| Token tenant-scoped e revogável | `StorefrontToken` (`vx_store_` + 43 caracteres base64url, hash SHA-256, `siteUrl`, `lastUsedAt`, `revokedAt`) e migration `20261126150000_storefront_tokens` | O valor é exibido uma vez; listagem e feed nunca devolvem hash |
| Links derivados da configuração | `storefront-links.ts` produz `/servicos/` e `/servicos/{id}/` a partir de `siteUrl` HTTPS | Sem `siteUrl`, a resposta `UNCONFIGURED` não inventa domínio |
| Feed público e `share` | `GET /public/storefront/:token` e `GET /storefront/share` em `storefront.controller.ts` | Feed sem sessão, somente catálogo ativo do tenant do token; `share` exige sessão, mas não exige administrador |
| Blocos executáveis | `catalog.item` e `catalog.list` em `flow-runtime.ts` e `intelligence-runtime.service.ts`; vocabulário da IA atualizado | Texto não afirma pagamento, pedido, envio ou conexão; humano confirma o envio no atendimento |
| Testes focados | 123/123 specs locais e `tsc --noEmit` limpo; `boot-smoke.cjs` cobre `401` nas rotas protegidas | CI, build, migrations e aceite externo ainda dependem do PR |

## UI final do Catálogo e da vitrine (2026-11-26)

| Item | Evidência no código | Limite honesto |
|---|---|---|
| Página completa de produtos | `catalog-settings.tsx` abre com a listagem, capas 16:9 e todos os dados do item; novo item/edição usam modal | A vitrine pública recebe só os campos aprovados |
| Plataforma condicional | `catalog-provider` grava a preferência; `finance-workspace.tsx` e `finance-provider-workspace.tsx` filtram a aba Catálogo | A preferência não cria cobrança nem prova conexão |
| Vitrine pública | `sites/catalogo-servicos/` com `/servicos/`, `/servicos/{id}/`, 16:9, whitelist, `verify-catalog` e `audit-links` | Sem deploy, HTTP 2xx no domínio final ou envio real |
| Validação final local | API 123/123 e Web 595/595 testes; `tsc` limpo nas duas apps; Astro `check`/`build`/verificações verdes | CI e aceite externo ainda dependem do PR |

## Publicação por plataforma e importação inversa (2026-11-26)

| Item | Evidência no código | Limite honesto |
|---|---|---|
| Espelhos independentes | `CatalogPublication` e migration `20261127090000_catalog_publications`, chave única por `(tenant_id, catalog_item_id, provider)` | Um item pode ter vários espelhos; nenhum provedor substitui o `CatalogItem` canônico |
| Asaas | `AsaasService.publishCatalogItem()` chama `POST /paymentLinks` com `externalReference` `vexora:catalog:<itemId>` | API pública não expõe catálogo de produtos; o espelho é um link de pagamento, não um produto |
| Stripe | `StripeService.publishCatalogItem()` cria `Product` e `Price` com idempotência por item | Falha do preço preserva o `Product` e registra `PARTIAL`; nunca reenvia `description` privada |
| InfinitePay | `InfinitePayService.publishCatalogItem()` chama `/links` com `order_nsu` `vxcat_<itemId>` | Exige valor mínimo de R$ 1,00; não há API documentada de produtos |
| Confirmação e estados | `CatalogPublicationService` exige `confirm: true`, item ativo e plataforma configurada; estados `NOT_PUBLISHED`, `PUBLISHING`, `PUBLISHED`, `PARTIAL`, `FAILED`, `IMPORTED` | Configuração ou link salvo não prova objeto externo; `canPublish` autoriza a tentativa, não o resultado |
| Rotas | `GET /catalog/publications/:itemId`, `POST /catalog/publications/:itemId/publish`, `GET /catalog/publications/import/preview`, `POST /catalog/publications/import` | Todas tenant-scoped; publicar/importar exige papel administrativo e gera `auditLog` |
| Importação inversa | Asaas `/products` e Stripe produtos/preços alimentam `importPreview`/`importItem` | InfinitePay responde `UNSUPPORTED`; itens já importados são marcados para não duplicar |
| Campos deixados na Véxora | Importação grava nome, descrição básica, preço, moeda e imagem HTTPS quando disponíveis | `publicDescription`, `publicImageUrl`, `publicLink`, SKU, unidade e categoria permanecem vazios para preenchimento humano |
| Validação local | Prisma Client regenerado, API `tsc --noEmit` limpo, 8/8 specs novas (incluindo dois provedores no mesmo item); Web `tsc --noEmit` limpo e 596/596 testes | Nenhuma chamada real às APIs, nenhum webhook, cobrança, pedido, envio ou deploy foi executado |

**Itens criados diretamente nas plataformas:** sim, a Véxora consegue catalogá-los quando a plataforma oferece listagem consultável — Asaas e Stripe nesta fatia. O item importado entra como `PRODUCT` com dados básicos e os campos complementares aprovados pela Véxora permanecem para preenchimento manual. Na InfinitePay, sem API documentada de listagem, o cadastro é manual na Véxora com o identificador/link conferido pela pessoa.

## Fora do escopo desta branch

- Inserção automática no composer pelo bot/IA: o fluxo humano insere o texto preparado no Atendimento; nenhum envio automático é afirmado.
- Correção de `templateId` em orçamento: não alterada; não afirmar que geração de PDF funciona sem evidência.
- Modelo `DocumentSignature`, envio para assinatura, status de envelope e UI de assinatura: não implementados.
- Infraestrutura Dokploy do Documenso: não criada; nenhum deploy afirmado.
- BOT continua sem gerar notificações de atendimento.

## Critérios de aceite

- Preço e dados exibidos vêm sempre do `CatalogItem` do tenant; item desativado falha de forma clara, sem fallback inventado.
- Nenhum texto externo recebe `imageUrl` ou `description` do catálogo.
- Assinatura e exclusão só são consideradas concluídas quando a API confirmar; `200` em criação não prova pagamento, e falha de `DELETE` não é excluído.
- Segredos de integração ficam somente no cofre/Dokploy; nunca no repositório ou chat.
- CI deve passar antes de merge. Merge não é deploy.
