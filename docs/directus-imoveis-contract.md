# Contrato do módulo de imóveis no Directus

> **Documento histórico — supersedido em 24/11/2026.** O Directus foi removido
> do plano. A decisão vigente é Payload CMS, instância única com papéis e
> usuários ilimitados: `docs/payload-substitui-directus.md`. O contrato de dados
> abaixo serve apenas como especificação de origem para a migração.

## Escopo

Este documento descreve o contrato de dados e de fluxo para o site **Alto
Araguaia Imóveis**. O Directus é a fonte da verdade de imóveis, usuários,
permissões, submissões e mídia. O GitHub recebe apenas um **snapshot publicado**;
ele não é a fonte primária.

Nada aqui foi executado ou configurado em uma instância real até 24/11/2026.

## Collections

### `category` — Categoria

| Campo | Tipo | Observação |
| --- | --- | --- |
| `id` | uuid | gerado |
| `name` | string | `Urbano`, `Rural`, novos valores criados no Studio |
| `slug` | string | único, usado nos filtros e URLs |

### `purpose` — Pretensão

| Campo | Tipo | Observação |
| --- | --- | --- |
| `id` | uuid | gerado |
| `name` | string | `Comprar`, `Alugar`, `Emprestar`, `Doar` |
| `slug` | string | único |

### `location` — Localização

| Campo | Tipo | Observação |
| --- | --- | --- |
| `id` | uuid | gerado |
| `city` | string | exigido |
| `state` | string | UF |
| `region` | string | opcional |
| `neighborhood` | string | opcional |

Bairros e regiões são documentos da mesma coleção, não campos fixos no imóvel.
Novos valores entram pelo Studio, sem PR e sem deploy.

### `property` — Imóvel

| Campo | Tipo | Observação |
| --- | --- | --- |
| `id` | uuid | gerado |
| `code` | string | único, `isTitle` |
| `title` | string | exigido |
| `type` | string | `Casa`, `Apartamento`, `Sala comercial`, `Área`, `Chácara`, `Fazenda`; alimenta “Tipo de Imóvel” |
| `owner_id` | uuid → `directus_users` | dono do registro; base da política RBAC |
| `category` | many-to-one → `category` | |
| `purpose` | many-to-one → `purpose` | |
| `location` | many-to-one → `location` | |
| `price` | decimal | |
| `condominium` | decimal | opcional |
| `bedrooms`, `bathrooms`, `parking`, `area` | integer/decimal | filtros |
| `status` | string | `draft`, `pending`, `published`, `rejected` |
| `gallery` | json (`o2m` ou `object[]`) | `{ src, alt, position }` |
| `description` | text | |
| `rejection_reason` | text | preenchido na rejeição da submissão |
| `updated_at` | datetime | usado para idempotência do snapshot |

### `submission` — Submissão de anunciante

| Campo | Tipo | Observação |
| --- | --- | --- |
| `id` | uuid | gerado |
| `submission_key` | string | único; derivado do formulário, garante idempotência |
| `name`, `email`, `phone` | string | contato do anunciante |
| `payload` | json | dados brutos validados do formulário |
| `status` | string | `pending`, `approved`, `rejected` |
| `rejection_reason` | text | obrigatório quando `status = rejected` |
| `property_id` | uuid → `property` | preenchido quando aprovado |
| `created_at`, `decided_at` | datetime | auditoria |

## Papéis e políticas

| Papel | Permissão |
| --- | --- |
| **Admin** | CRUD total em `property`, `submission`, taxonomias e usuários; aprova/rejeita |
| **Agente** | cria `property`; lê, edita e exclui **somente** os próprios (`owner_id = $CURRENT_USER`) |
| **Anunciante** | sem login no Studio; preenche só o formulário público |
| **worker (service account)** | API-only, `create` em `submission` e leitura para o snapshot; **0 assentos** |

Política do Agente em `property` (leitura, atualização e exclusão):

```json
{ "owner_id": { "_eq": "$CURRENT_USER" } }
```

Na criação, o valor de `owner_id` deve ser forçado pelo hook/Flow ao usuário
autenticado; nunca aceitar `owner_id` enviado pelo cliente.

`submission` é gravada apenas pela service account do Worker. O anunciante não
recebe token de escrita direta.

## Fluxo de aprovação e rejeição

1. `POST /api/forms/anunciar` no Cloudflare Worker (`workers/form-submissions`)
   valida campos, aplica rate limit por IP e honeypot, e grava `submission`
   com `status = pending`. Código e testes versionados; **deploy pendente**.
2. Flow `submission.created` notifica o Admin por Resend e/ou WhatsApp.
3. O Admin decide no Studio:
   - **aprovar**: cria/atualiza `property` com `owner_id` do agente responsável,
     seta `submission.status = approved` e `property_id`;
   - **rejeitar**: exige `rejection_reason`, seta `submission.status = rejected`.
4. Flow notifica o anunciante com a decisão; no caso de rejeição, inclui o
   motivo. O registro da notificação só é marcado como enviado após HTTP 2xx do
   provedor — nunca por flag de configuração.
5. Após aprovação, o Flow de publicação gera o snapshot (abaixo).

## Worker do formulário público

Implementação: `workers/form-submissions/index.mjs`, com `wrangler.toml` e
testes em `workers/form-submissions/test/`. O site liga a página
`/anuncie-seu-imovel/` ao Worker quando `PUBLIC_ANNOUNCEMENTS_ENDPOINT` é
definido no build; sem essa variável, o formulário abre o WhatsApp e não afirma
registro.

| Situação | HTTP | Significado observável |
| --- | --- | --- |
| Submissão criada | 200 | `submissionKey` + `status: "pending"`; nada além disso |
| Mesmo conteúdo no mesmo período | 200 | `duplicate: true`; nenhum segundo registro |
| Honeypot preenchido | 200 | resposta neutra, sem gravação |
| Configuração ausente | 503 | sem Directus, sem KV ou URL inválida |
| Mais de 5 envios por IP em uma hora | 429 | `Retry-After: 3600` |
| Campos inválidos | 400 | lista de campos; nenhuma chamada ao Directus |
| Directus indisponível | 502 | falha de registro, sem promessa de envio |

Regras do Worker:

- `DIRECTUS_URL` e `DIRECTUS_TOKEN` ficam no cofre do Cloudflare; o navegador
  nunca recebe o token da service account.
- `RATE_LIMIT_KV` é obrigatório: sem ele o Worker responde `503` em vez de
  aceitar envios sem limite.
- `Origin` diferente de `ALLOWED_ORIGIN` é recusado; `OPTIONS` tem resposta
  explícita; a resposta usa `Cache-Control: no-store`.
- `submission_key` é derivada por SHA-256 de e-mail, origem, mensagem, código do
  imóvel e faixa horária. O Worker consulta o Directus antes de gravar e trata
  concorrência pela mesma chave como duplicata.
- `200` significa **recebido e pendente**. Não significa imóvel criado, anúncio
  publicado nem mensagem entregue ao anunciante.

## Painel de Anúncios na Véxora

O gestor decide na Aba Sites, sem entrar no Studio do Directus. A Véxora não
substitui o Directus: ela consome a coleção `submission` e registra a decisão
humana com autor, motivo e horário.

| Rota da API | Uso |
| --- | --- |
| `GET /api/sites/hub/submissions` | lista submissões pendentes e decisões locais |
| `POST /api/sites/hub/submissions/:submissionKey/decide` | `{ "decision": "APPROVED" \| "REJECTED", "reason": "..." }` |

Regras implementadas:

- `reason` é obrigatório para `REJECTED` e opcional para `APPROVED`.
- O tenant vem da sessão; `DIRECTUS_TENANT_ID` autoriza **uma** empresa a usar a
  instância configurada. Outro tenant recebe `503`, sem detalhes da configuração.
- `DIRECTUS_URL`, `DIRECTUS_TOKEN` e `DIRECTUS_TENANT_ID` ficam no cofre do
  servidor; o navegador nunca recebe o token da service account.
- `site_hub_submission_decisions` guarda a reivindicação (`PROCESSING`),
  o resultado (`DECIDED`) ou a falha (`FAILED`) por
  `(tenant_id, submission_key)`. Repetir a mesma decisão é idempotente; trocar a
  decisão é recusado; falha na chamada externa pode ser tentada de novo.
- A resposta de notificação é `NOT_CONFIRMED` até o Flow do Directus registrar a
  confirmação real do Resend/WhatsApp. A UI não mostra “enviado” por configuração.

A criação/atualização de `property` com `owner_id` e o envio ao anunciante
continuam sendo execução do Directus. A Véxora registra e audita; não afirma
publicação, imóvel criado nem mensagem entregue sem evidência externa.

## Snapshot publicado

O Astro **não lê JSON de conteúdo**. O build usa Content Collections com
`glob({ pattern: "**/*.md", base: "./src/content/properties" })`, definido em
`sites/alto-araguaia-imoveis/src/content.config.ts`. O snapshot publicado é,
portanto, um conjunto de arquivos Markdown versionados:

```text
sites/alto-araguaia-imoveis/src/content/properties/<slug>.md
```

Cada arquivo tem frontmatter validado pelo schema da coleção `properties`:

```yaml
---
title: "Casa moderna com área de lazer"
code: "AA-1024"
type: "Casa"                    # property.type
category: "urbano"              # category.slug do Directus
operation: "Venda"              # purpose convertido para o enum do site
neighborhood: "Alto Araguaia"   # location.neighborhood
city: "Alto Araguaia"           # location.city
state: "MT"                     # location.state
price: 650000
rentPrice: 4800                 # opcional; omitir quando não houver
area: 180
areaUnit: "m²"
bedrooms: 3
bathrooms: 2
garage: 2                       # property.parking
images: ["/images/properties/aa-1024.webp"]
features: ["Área de lazer", "3 quartos"]
featured: false
sample: false                   # true enquanto os dados não forem validados
summary: "Casa de 180 m² em Alto Araguaia."
---

Descrição do imóvel em Markdown.
```

Mapeamento das taxonomias do Directus para o frontmatter: `category.slug` →
`category`, `purpose.slug` → `operation` nos valores aceitos pelo schema
(`Venda`, `Aluguel`, `Venda e locação`), e
`location.neighborhood/city/state` → `neighborhood/city/state`. Os filtros do
site usam os valores já publicados nos arquivos; a Tina não mantém cópia
separada. `property.condominium` entra em `features` quando houver condomínio.

Regras:

- Somente `property.status = published` entra no snapshot.
- Cada imóvel publicado vira um arquivo. O Flow remove os arquivos dos imóveis
  que deixaram de estar publicados, para não manter oferta antiga no build.
- O corpo do arquivo é a descrição; `images` substitui o campo `gallery` do
  Directus e mantém as URLs já validadas pelo lightbox.
- A mensagem de commit inclui `submission_id` ou `property_id` e o autor da
  decisão, para auditoria no Git.
- O Flow é idempotente: se o conteúdo calculado for igual ao último commit, não
  cria novo commit nem novo build.
- O build lê os arquivos do disco; não há chamada ao Directus em runtime.
- **Estado real:** os 8 arquivos atuais são dados migrados/fictícios, ainda não
  validados comercialmente. Hoje não existe checagem que interrompa o build
  quando a coleção estiver vazia; substituí-los por dados aprovados é pendência
  explícita.

## Galeria no frontend

`gallery` é renderizada pelo componente de detalhe do imóvel com o lightbox já
validado: contador "N fotos", miniaturas, setas, navegação por teclado. As URLs
das imagens ficam no campo `images` do frontmatter dos arquivos Markdown; não
há chamada ao Directus no tempo de execução do site.

## Limites operacionais

- Core: 3 assentos, 25 coleções, 5 Flows.
- Grant (o caso desta imobiliária): sem limites; chave por e-mail, renovação
  anual, 5 ativações; telemetria obrigatória, sem suporte pago.
- Não expor o token da service account no frontend. O Worker roda no mesmo
  domínio do site e guarda o segredo no ambiente do Cloudflare.

## Pendências antes de considerar pronto

- Criar instância Directus no Dokploy e aplicar a licença do Grant.
- Aplicar schema, papéis e políticas; testar isolamento entre dois agentes.
- Implantar o Worker do formulário (código e testes prontos) e configurar seus segredos/KV; implementar os Flows de notificação e snapshot.
- Substituir os 8 imóveis fictícios por dados reais aprovados.
- Validar publicação com HTTP 2xx no domínio final.
