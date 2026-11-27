# Catálogo de produtos digitais e serviços + assinatura de documentos

**Status:** base de decisões e acompanhamento. A branch `feat/finance-catalog-subscriptions` implementou o escopo inicial de catálogo/Asaas descrito abaixo; a rodada de 2026-11-26 tornou o **Catálogo** um módulo próprio e compartilhado por Asaas, Stripe e InfinitePay, sem aba no Asaas. Nada aqui foi publicado ou deployado; a existência de código ou teste não prova operação real em ambiente externo.

## Decisões fixadas

1. **Catálogo canônico por tenant.** A fonte da verdade é `CatalogItem` (`apps/api/prisma/schema.prisma`), com `kind` `PRODUCT` ou `SERVICE`, preço em centavos, moeda, unidade, categoria, `imageUrl` e `active`. Não há estoque físico no MVP.
2. **Nada inventado.** Toda superfície lê nome, descrição, preço e disponibilidade do `CatalogItem` do tenant. Nunca inventar produto, preço, disponibilidade ou condição comercial. No formulário de assinatura, o navegador envia apenas `catalogItemId`, datas e dados do cliente; nome e valor vêm do servidor.
3. **Imagem e descrição são privadas da Véxora.** No bloco `catalog.item`, `imageUrl` e `description` ficam somente em metadata interna da mensagem e nos detalhes de auditoria. Nenhum dos dois entra no texto entregue a WhatsApp, e-mail ou outros canais externos.
4. **Exclusão confirmada.** Cliente e assinatura no Asaas são removidos somente após confirmação explícita (`EXCLUIR`) e resposta de sucesso do `DELETE`. A UI não afirma exclusão antes dessa resposta.
5. **Rastreabem é referência de segmento/teste**, nunca identidade global nem fluxo obrigatório.
6. **Documenso/gov.br ficam fora desta entrega.** Documenso Community Edition exigiria stack separada, segredos próprios e evidência de deploy; a API gov.br exige formalização como órgão público e credenciais ITI/MGI. Nenhuma integração de assinatura eletrônica foi implementada aqui.
7. **Vitrine externa é próxima fatia.** O bot, a IA e o atendente poderão enviar 1 item sob demanda (foto, descrição e link de aquisição) ou o catálogo completo. O feed público usará whitelist de campos aprovados para publicação; os campos internos `description`/`imageUrl` do `catalog.item` não viram texto de canal. Sem checkout real e sem afirmar envio/publicação sem evidência.

## Implementado nesta branch (código + testes locais)

| Item | Evidência no código | Limite honesto |
|---|---|---|
| Filtro por categoria no catálogo | `CatalogController.list(req, q, kind, category, limit, includeInactive)` e teste em `catalog-scope.spec.ts` | Não cria itens nem altera catálogo de outro tenant |
| Serviços e assinaturas Asaas em `AsaasService` | `asaas.service.ts` e 4 testes novos em `asaas.service.spec.ts` | Depende de credenciais e retorno real do Asaas para operar |
| `DELETE` de assinatura/cliente com auditoria | `finance.controller.ts` e `finance.controller.spec.ts` | A confirmação do provedor é necessária; falha não é sucesso simulado |
| Aba Produtos no Financeiro | `finance-workspace.tsx` busca `/api/backend/catalog?category=ASAAS&limit=200` e mostra grid/estado vazio | Imagem e descrição ficam na Véxora; nada é enviado a canais externos |
| Modal de nova assinatura refatorado | `useModalDialog`, dropdown de serviços, "Criar outros…", `endDate`, payload sem `service`/`value` | Não cria serviço novo fora de Configurações → Catálogo |
| Abertura de Configurações → Catálogo | evento interno `vexora:open-catalog` em `finance-workspace.tsx`, tratado em `page.tsx` | Somente papéis `OWNER`/`ADMIN`/`MANAGER` |
| `catalog.item` no runtime | `intelligence-runtime.service.ts` valida item ativo do tenant e mantém imagem/descrição internas | Não promete preço, estoque ou condição não gravados no catálogo |

## Fora do escopo desta branch

- Inserção de item no composer do atendimento: não implementada.
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
