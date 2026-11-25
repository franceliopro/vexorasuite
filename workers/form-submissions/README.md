# Worker do formulário de anúncios

Entrada pública do fluxo do Alto Araguaia Imóveis. Recebe `POST /api/forms/anunciar`, valida e grava uma submissão `pending` no CMS configurado para posterior decisão humana. `SUBMISSIONS_PROVIDER=payload` aponta para o Payload CMS; o padrão `directus` preserva o destino atual até a instância Payload ser validada.

**Estado real:** código e testes versionados. Nenhum deploy, rota, segredo, binding KV ou domínio foi configurado por este processo.

## Contrato

Requisição: `POST` com `Content-Type: application/json` e corpo enviado pelo `ContactForm.astro`:

```json
{
  "name": "Ana Souza",
  "email": "ana@example.com",
  "phone": "(66) 9 9999-9999",
  "propertyType": "Casa",
  "city": "Alto Araguaia - MT",
  "message": "Casa de 3 quartos, área de 300m², valor R$ 480.000.",
  "consent": true,
  "source": "Anúncio de imóvel",
  "website": ""
}
```

Respostas:

| Situação | HTTP | Corpo |
| --- | --- | --- |
| Submissão criada | 200 | `{ "ok": true, "submissionKey": "AA-…", "duplicate": false, "status": "pending" }` |
| Mesmo conteúdo no mesmo período | 200 | `{ "ok": true, "submissionKey": "AA-…", "duplicate": true }` |
| Honeypot preenchido | 200 | `{ "ok": true, "submissionKey": null }` (nada é gravado) |
| Configuração ausente/inválida | 503 | `{ "error": "…" }` |
| Limite de 5 envios por IP/hora | 429 | `{ "error": "…" }` + `Retry-After` |
| Campos inválidos | 400 | `{ "error": "…", "fields": [...] }` |
| CMS indisponível | 502 | `{ "error": "…" }` |

`200` significa **recebido e registrado como pendente**. Não significa imóvel criado, anúncio publicado nem mensagem enviada ao anunciante.

## Segredos e binding

- `SUBMISSIONS_PROVIDER`: `directus` (padrão) ou `payload`. A troca é por configuração, sem migração automática de dados.
- Legado: `DIRECTUS_URL` e `DIRECTUS_TOKEN` — service account API-only no cofre do Cloudflare.
- Payload: `PAYLOAD_URL`, `PAYLOAD_TOKEN` e `PAYLOAD_TENANT_ID` no cofre. O tenant identifica o site na instância única; **não** é limite de usuário nem regra de isolamento por cliente.
- Nenhum segredo fica no repositório, no navegador ou no site estático.
- `RATE_LIMIT_KV`: namespace KV com binding no Worker; sem ele o Worker responde `503` em vez de liberar envios sem limite.
- `ALLOWED_ORIGIN`: origem do site, configurada em `wrangler.toml`; requisições com `Origin` diferente são recusadas.

## Testes

```sh
node --check index.mjs
node --test test/*.test.mjs
```

Os testes injetam `fetch`, relógio e KV: não chamam CMS real, não enviam mensagens e não precisam de segredos reais. Cobrem os dois provedores, incluindo filtro por tenant e cabeçalho de API key do Payload.
