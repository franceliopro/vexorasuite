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
  no **Directus**, self-hosted no Dokploy/VPS.

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
| Alto Araguaia Imóveis | híbrido | Git (páginas) + Directus (dados) | Cloudflare Pages |

A Véxora **plataforma** (`app.vexorasuite.com.br`) não é estática. Ela é o
gerente: pedido, preview, aprovação, publicação, health-check e auditoria.

## Dono único de cada conteúdo

A regra que evita dois bancos disputando a verdade: **cada campo tem um dono**.

| Dono | Conteúdo |
| --- | --- |
| **Tina / Git** | páginas e blocos: Hero, Categorias visuais, Diferenciais, Depoimentos, Chamada para anunciar, textos, SEO, navegação, imagens de marca |
| **Directus** | imóveis, galeria de fotos, `category`, `purpose`, `location`, usuários, permissões, `submission`, aprovação/rejeição |
| **Véxora** | estado do pedido, versões, aprovação, publicação, evidência e auditoria |

As taxonomias (`category`, `purpose`, `location`) moram **no Directus**. O
snapshot publicado leva a lista ao Astro para montar os filtros. A Tina não
mantém cópia; se um bloco precisar de um rótulo, referencia o id.

## Como o build monta o site

```text
GitHub (páginas editadas na Tina)   ─┐
                                    ├─→ astro build → dist/ → Cloudflare Pages
GitHub (snapshot JSON do Directus)  ─┘
```

1. A Tina salva páginas como arquivos no repositório.
2. Um Flow do Directus commita `src/content/data/properties.json` com imóveis
   e taxonomias aprovados.
3. O GitHub Actions roda `check → build → audit`.
4. O Cloudflare Pages builda a branch de produção e publica o `dist/`.
5. A Véxora só marca `PUBLISHED` após **HTTP 2xx** verificado no domínio final.

O build lê arquivos do disco: sem API de conteúdo, sem token de leitura no
Cloudflare, sem runtime. O visitante recebe HTML estático das duas fontes.
O astro não fala com o Directus em tempo de execução.

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
  → Directus: submission com status pending
  → Flow notifica Admin (Resend / WhatsApp)
  → Admin aprova ou rejeita com rejection_reason
  → aprovado: cria/atualiza property com owner_id; rejeitado: notifica o anunciante
  → Flow gera snapshot no GitHub → Pages → HTTP 2xx
```

Contrato detalhado: `docs/directus-imoveis-contract.md`.

## Isolamento entre empresas

Cada cliente tem projeto Pages, banco Directus, domínio e credenciais próprios.
Um cliente nunca herda dados, contatos ou sessões de outro. Se o HUB da Véxora
chamar o Directus, usa service account por tenant, com token próprio.

## Limites e licenciamento do Directus

- Core self-hosted: gratuito, **3 assentos (limite fixo)**, 25 coleções, 5 Flows.
- Open Innovation Grant: gratuito para organizações com receita anual abaixo de
  US$ 5M e menos de 50 funcionários; assentos, coleções e Flows ilimitados,
  self-host sem custo; exige telemetria, não permite modo offline nem suporte pago.
- Team self-hosted: US$ 499/mês no plano anual ou US$ 599/mês avulso;
  10 assentos SSO, adicionais a US$ 50/assento/mês. Na Cloud, US$ 588/698
  (licença + hospedagem).

Um assento é consumido por usuário do Data Studio. Usuários de API (service
accounts, tokens estáticos) e o público que preenche o formulário **não**
consomem assento.

Com 5–7 usuários, a imobiliária se enquadra no Grant e o Directus self-hosted
custa R$ 0 em software.

## Estado real

Esta é a arquitetura decidida, não uma instalação concluída. Em 24/11/2026:

- nenhuma instância Directus foi configurada;
- nenhum Flow, snapshot ou notificação foi executado;
- o Worker do formulário está versionado e testado, mas não foi implantado;
- nenhum projeto Cloudflare Pages foi criado por este processo;
- nenhum domínio foi apontado;
- os imóveis no repositório são fictícios.

Publicação só pode ser afirmada após resposta **2xx** verificada na URL final.
