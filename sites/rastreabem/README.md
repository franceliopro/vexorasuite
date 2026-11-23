# Rastreabem — site em Next.js/MDX

Site institucional da Rastreabem convertido do HTML original para Next.js com conteúdo em MDX.

## Como executar

```bash
pnpm install
pnpm dev        # http://localhost:3105
pnpm build      # gera out/ estático
pnpm start      # serve o build local
```

## Estrutura

- `app/`: esqueleto (layout com cabeçalho/rodapé e rota dinâmica `[slug]`).
- `content/pages/*.mdx`: conteúdo editável de cada página.
- `content/navigation.ts`: único ponto de verdade do menu e dos metadados.
- `components/`: cabeçalho, rodapé e os comportamentos do site original (carrossel, galeria e vídeos).
- `public/images`, `public/fonts`, `public/videos`: assets do site original.
- `app/globals.css`: CSS original com os caminhos dos assets reescritos.

## Decisões

- `output: 'export'` com `trailingSlash: true`: saída estática para Cloudflare Pages.
- Imagens e fontes locais em `public/`; `images.unoptimized: true` para funcionar sem servidor de imagem.
- Links de compra e painel do cliente permanecem apontando para os destinos do HTML original; a validação desses destinos depende de acesso externo e não é afirmada aqui.
- Nenhuma publicação, domínio ativo ou integração é afirmada por este repositório sem evidência no ar.
