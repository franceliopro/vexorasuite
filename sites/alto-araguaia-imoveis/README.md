# Alto Araguaia Imóveis

Site público em **Astro estático**, criado a partir de `sites/_template` e alinhado
à interface publicada em `https://altoaraguaiaimoveis.com.br/` em 24/11/2026.

O CSS usa **Tailwind CSS 4.3.5** via `@tailwindcss/vite`, com os tokens do site
expostos em `@theme` (`bg-navy`, `text-yellow`, `font-display`, `rounded-card`, etc.).
O CSS componentizado permanece em `src/styles/global.css` para compatibilidade com
o layout já validado.

## Rotas

| Tela | Rota | Arquivo |
|---|---|---|
| Home com busca, categorias, destaques, rural, benefícios e depoimentos | `/` | `src/pages/index.astro` |
| Busca geral | `/imoveis/` | `src/pages/imoveis/index.astro` |
| Imóveis urbanos | `/imoveis-urbanos/` | `src/pages/imoveis-urbanos/index.astro` |
| Imóveis rurais | `/imoveis-rurais/` | `src/pages/imoveis-rurais/index.astro` |
| Detalhe do imóvel | `/imovel/<slug>/` | `src/pages/imovel/[slug].astro` |
| Compatibilidade com URLs antigas | `/imoveis/<slug>/` | `src/pages/imoveis/[slug].astro` |
| Sobre | `/sobre/` | `src/pages/sobre.astro` |
| Contato | `/contato/` | `src/pages/contato.astro` |
| Anuncie seu imóvel | `/anuncie-seu-imovel/` | `src/pages/anuncie-seu-imovel.astro` |
| Política de Privacidade | `/p/politica-de-privacidade/` | `src/pages/p/politica-de-privacidade.astro` |
| Termos de Uso | `/p/termos-de-uso/` | `src/pages/p/termos-de-uso.astro` |
| 404 | `/404.html` | `src/pages/404.astro` |
| Sitemap e robots | `/sitemap.xml`, `/robots.txt` | `src/pages/` |

## Busca e filtros

O painel de busca segue os campos do site publicado:

- Busca por palavra-chave (`q`), Localização (`city_id`), Pretensão (`purpose`) e Faixa de Preço (`price_range`).
- “Mais filtros” abre Categoria, Tipo de Imóvel, Condomínio, Região, Bairro, Quartos, Banheiros, Vagas, Área mínima (m²), Preço mínimo, Preço Máximo, Ordenado por e Buscar Código.
- A submissão é `GET`; os parâmetros voltam preenchidos na URL e o contador de resultados é atualizado no cliente.
- Trocar `Categoria` atualiza `action` e o parâmetro `p` juntos: `Urbano` leva a `/imoveis-urbanos/`, `Rural` a `/imoveis-rurais/` e `Urbano e rural` a `/imoveis/`. Isso evita filtros contraditórios nas páginas por categoria.
- A ordenação funciona por mais recentes, menor preço, maior preço e maior área.
- Na página de detalhe, o botão “N fotos” e as miniaturas abrem um lightbox com setas, teclado e contador.

## Conteúdo

- Imóveis: `src/content/properties/` — 8 anúncios reais `AA-1024` a `AA-1031`, com `sample: false`.
- Páginas: `src/content/pages/` — conteúdo textual validado por Content Collections.
- Identidade, canais e navegação: `src/data/site.config.ts`.
- Imagens locais: `public/images/` (hero, campo rural, fotos de cards e galeria).

Canais urbanos publicados: `(66) 3481-2792` / `556634812792`.
Canais rurais publicados: `(66) 99999-0000` / `5566999990000`.
O e-mail `contato@altoaraguaiaimoveis.com.br` consta no texto da Política de Privacidade;
o link `mailto:` do site atual está vazio, por isso `site.email` permanece vazio e
nenhum envio é afirmado apenas pela configuração.

## Validação local

```bash
cd sites/alto-araguaia-imoveis
pnpm verify
```

`pnpm verify` executa `astro check`, `astro build` e auditoria determinística de
links/assets em `dist/`. O workflow `.github/workflows/site-alto-araguaia-imoveis.yml`
repete checagem, build e auditoria no GitHub Actions.

## Estado honesto

- ✅ Código, conteúdo, filtros, galeria, SEO, sitemap e auditoria implementados.
- ✅ Build estático validado localmente e no GitHub Actions neste checkout.
- ⏳ Deploy não executado neste repositório: sem `CLOUDFLARE_API_TOKEN`,
  `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_PAGES_PROJECT` e domínio configurado,
  nenhuma publicação é afirmada.
- ⏳ Formulários sem `PUBLIC_CONTACT_ENDPOINT` abrem o WhatsApp para confirmação
  manual; nenhum envio é afirmado sem resposta HTTP 2xx do endpoint final.
- ⚠️ Dados migrados do site público exigem validação comercial antes de qualquer
  republicação.
