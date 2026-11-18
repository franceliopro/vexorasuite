# Cobrança automática da Véxora (self-service billing)

A empresa ativa ou troca de plano em **Configurações → Planos e preços → Ativar agora**. O Asaas gera uma assinatura mensal com pagamento imediato (boleto com PIX via página da fatura) e o plano é ativado **automaticamente** assim que o pagamento é confirmado — sem ninguém da Véxora no meio.

## Variáveis exigidas (Dokploy, serviço `api`)

| Variável | Obrigatória | Exemplo |
|---|---|---|
| `PLATFORM_ASAAS_API_KEY` | Sim (sem ela o recurso responde "indisponível") | `$aact_YTU5...` |
| `PLATFORM_ASAAS_BASE_URL` | Não (padrão `https://api.asaas.com/v3`) | `https://api.asaas.com/v3` (ou `https://sandbox.asaas.com/api/v3` em teste) |
| `PLATFORM_ASAAS_WEBHOOK_TOKEN` | Sim, obrigatória para a ativação automática do plano | string aleatória de pelo menos 24 caracteres |

**Não confunda com as credenciais Asaas de cada empresa cliente** — estas são as da conta Asaas **da própria Véxora** (de onde saem as cobranças de mensalidade do Véxora).

## Configurar no painel do Asaas

Em Configurações → Integrações → Webhooks, crie um webhook apontando para:

```
https://app.vexorasuite.com.br/api/backend/billing/webhooks/asaas
```

com o header `asaas-access-token` igual a `PLATFORM_ASAAS_WEBHOOK_TOKEN`, assinando os eventos de pagamento (o código trata `PAYMENT_CONFIRMED` e `PAYMENT_RECEIVED`).

## Como funciona

1. O proprietário clica **Ativar agora** num plano.
2. O backend cria (ou reusa) o cliente no Asaas da Véxora com `externalReference = vexora:tenant:<id>`, usando o CNPJ/CPF do **Dados da empresa** — se faltar documento, a ativação é recusada com instrução clara.
3. Cria assinatura mensal com valor do plano e referência `vexora:plan:<code>:<tenantId>`.
4. O Asaas confirma o pagamento → webhook ativa o plano (planId + entitlements materializados) e registra `plan.activated` na trilha de auditoria + evento `plan.updated`.

Sem as variáveis acima, nada é cobrado errado: o botão avisa que a cobrança automática está indisponível e a empresa segue pelo canal comercial.
