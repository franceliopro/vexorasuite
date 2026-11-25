# Morbeck x Carvalhinho — site estático

Site estático sem WordPress em runtime. Espelho limpo do site original, com
CSS/JS/imagens/fontes organizados em `src/assets/`.

## Desenvolvimento local

```powershell
cd sites\morbeckxcarvalhinho
npm run build
python -m http.server 3108 --bind 127.0.0.1 --directory out
```

Acesse `http://127.0.0.1:3108/`.

## Cloudflare Pages via Git

Configure um projeto Cloudflare Pages apontando para este mesmo repositório:

- **Repository**: `franceliopro/vexorasuite`
- **Branch**: `main`
- **Root directory**: `/` (deixe em branco)
- **Build command**:
  ```text
  cd sites/morbeckxcarvalhinho && npm install && npm run build
  ```
- **Build output directory**:
  ```text
  sites/morbeckxcarvalhinho/out
  ```
- **Node version**: `20` (ou `22`)

Não use Direct Upload para este site. Cada push em `main` dispara um novo deploy.

## Conteúdo

- `src/`: fonte (HTML + assets)
- `scripts/build.cjs`: copia `src/` para `out/`
- `out/`: gerado no build; não editar à mão
