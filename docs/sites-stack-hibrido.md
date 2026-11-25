# Stack híbrida dos sites públicos (decisão de 24/11/2026)

## Decisão

Os sites públicos são **estáticos**, gerados por **Astro + Tailwind CSS 4.3.5**,
versionados no **GitHub** e publicados no **Cloudflare Pages**. A **Véxora**
coordena o processo; ela não constrói nem hospeda o site.

Existe uma diferença entre os sites:

- **Sites institucionais** (Véxora, Rastreabem, Morbeck x Carvalhinho): 100%
  Git-native. Páginas e textos são arquivos no repositório, editáveis na Tina.
- **Alto Araguaia Imóveis**: híbrido. As páginas continuam Git-native; os
  **dados dinâmicos** (imóveis, usuários, permissões, submissões e mídia) ficam
  no **Payload CMS**, instância única self-hosted no Dokploy/VPS, com papéis e usuários ilimitados.

O CMS PHP/MySQL com construtor estilo Elementor foi **descartado**: era
protótipo incompleto, publicava em `/p/<slug>` e nunca substituiu o site em `/`.
Os dados atuais dos imóveis são fictícios.

## Matriz por site

| Site | Natureza | Conteúdo fica em | Publicação |
| --- | --- | --- | --- |
| Site da Véxora | institucional, estático | Git (Tina) | Cloudflare Pages |
| `app.vexorasuite.com.br` | plataforma, dinâmica | banco próprio no Dokploy | Dokploy |
| Rastreabem | institucional, estático | Git (Tina) | Cloudflare Pages |
| Morbeck x Carvalhinho | institucional, estático | Git (Tina) | Cloudflare Pages |
| Alto Araguaia Imóveis | híbrido | Git (páginas) + Payload (dados) | Cloudflare Pages |

A Véxora **plataforma** (`app.vexorasuite.com.br`) não é estática. Ela é o
gerente: pedido, preview, aprovação, publicação, health-check e auditoria.

## Dono único de cada conteúdo

A regra que evita dois bancos disputando a verdade: **cada campo tem um dono**.

| Dono | Conteúdo |
| --- | --- |
| **Tina / Git** | páginas e blocos: Hero, Categorias visuais, Diferenciais, Depoimentos, Chamada para anunciar, textos, SEO, navegação, imagens de marca |
| **Payload CMS** | imóveis, galeria de fotos, `category`, `purpose`, `location`, usuários, permissões, `submission`, aprovação/rejeição |
| **Véxora** | estado do pedido, versões, aprovação, publicação, evidência e auditoria |

As taxonomias (`category`, `purpose`, `location`) moram **no Payload CMS**. O
snapshot publicado em Markdown leva a lista ao Astro para montar os filtros. A
Tina não
mantém cópia; se um bloco precisar de um rótulo, referencia o id.

## Como o build monta o site

```text
GitHub (páginas editadas na Tina)   ─┐
                                    ├─→ astro build → dist/ → Cloudflare Pages
GitHub (snapshot MD do Payload)     ─┘
```

1. A Tina salva páginas como arquivos no repositório.
2. Um hook do Payload grava `src/content/properties/<slug>.md` com os imóveis
   aprovados; o frontmatter replica as taxonomias do Payload.
3. O GitHub Actions roda `check → build → audit`.
4. O Cloudflare Pages builda a branch de produção e publica o `dist/`.
5. A Véxora só marca `PUBLISHED` após **HTTP 2xx** verificado no domínio final.

O build lê arquivos do disco: sem API de conteúdo, sem token de leitura no
Cloudflare, sem runtime. O visitante recebe HTML estático das duas fontes.
O astro não fala com o Payload em tempo de execução.

## Estados gerenciados pela Véxora

```text
DRAFT → PREVIEW_READY → APPROVED → PUBLISH_REQUESTED → PUBLISHED
                     ↘ REJECTED                     ↘ FAILED
```

- `PREVIEW_READY` exige URL HTTPS real e commit SHA registrados.
- `APPROVED` exige decisão humana auditada.
- `PUBLISHED` exige health-check 2xx no domínio final.
- `FAILED` registra motivo e evidência; permite nova tentativa.

As transições e os endpoints já existem em
`apps/api/src/modules/site-hub/site-hub.service.ts` e a interface em
`apps/web/src/app/sites-workspace.tsx`.

## Submissões de anunciantes (Alto Araguaia)

```text
Visitante preenche formulário
  → Cloudflare Worker (validação + rate limit; `workers/form-submissions`)
  → Payload: submission com status pending
  → hook notifica Admin (Resend / WhatsApp)
  → Admin aprova ou rejeita com rejection_reason
  → aprovado: cria/atualiza property com owner do Payload; rejeitado: notifica o anunciante
  → hook gera snapshot no GitHub → Pages → HTTP 2xx
```

Decisão vigente: `docs/payload-substitui-directus.md`. Contrato histórico: `docs/directus-imoveis-contract.md`.

## Isolamento e acesso

Uma instância Payload atende todos os sites. Usuários são ilimitados e
separados por papéis (`admin`, `editor`, `agent`, `service`). O `tenantId` é
registrado em cada documento e verificado pela API da Véxora, que deriva o
tenant da sessão.

A regra antiga de uma instância por cliente foi retirada a pedido do
proprietário. Se algum cliente voltar a exigir separação rígida, ela será
implementada por access control do Payload, não por multiplicação de
instâncias nem por limite de assentos.

## Limites e licenciamento do Payload CMS

- Self-hosted sob licença MIT: **sem cobrança por assento e sem limite de usuários**.
- Postgres próprio, backup e credenciais no cofre; nenhuma telemetria é
  obrigatória para operar.
- Papéis são configurados na instância. A service account existe apenas para o
  Worker e a Véxora; o anunciante não recebe login nem token de escrita.

## Estado real

Esta é a arquitetura decidida, não uma instalação concluída. Em 24/11/2026:

- nenhuma instância Payload foi configurada;
- nenhum hook, snapshot ou notificação foi executado;
- o Worker do formulário está versionado e testado, mas não foi implantado;
- nenhum projeto Cloudflare Pages foi criado por este processo;
- nenhum domínio foi apontado;
- os imóveis no repositório são fictícios.

Publicação só pode ser afirmada após resposta **2xx** verificada na URL final.
