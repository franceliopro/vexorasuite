# Shell Tauri v2 — desktop e mobile

## Fronteira de responsabilidade

`apps/web` (Next.js) continua sendo a interface canônica e a única fonte de regras de negócio. `apps/shell` é apenas uma **casca**: uma WebView nativa Tauri v2 que abre a aplicação web já existente. Nenhuma lógica de negócio, autenticação, API, rota ou componente foi reescrito para Rust ou para um frontend novo.

- **Produção:** `build.frontendDist` aponta para `https://app.vexorasuite.com.br`. O binário não incorpora arquivos da interface; ele carrega a URL publicada pelo web app.
- **Desenvolvimento:** `build.devUrl` é `http://localhost:3000` e `beforeDevCommand` inicia `pnpm --filter @vexorasuite/web dev`. O web app continua sendo servido pelo Next.js, com hot reload.
- **Build:** `beforeBuildCommand` executa `pnpm --filter @vexorasuite/web build` para validar o frontend; a URL remota permanece a origem em produção.
- **IPC:** a capacidade `main-local` é `local: true`, então a página remota de produção não recebe permissões Tauri. `withGlobalTauri` é `false` e nenhum comando Rust é registrado.

O CSP da aplicação em produção continua sendo o enviado pelo Next.js; `app.security.csp` do Tauri não altera as respostas HTTP da URL remota.

## O que está configurado

| Alvo | Configuração | Status real |
| --- | --- | --- |
| Windows | `bundle.targets: "all"` + ícones PNG em `src-tauri/icons/` | Configurado. Não compilado nem assinado nesta entrega. |
| macOS | `bundle.targets: "all"` e `tauri.conf.json` | Configurado. Requer Xcode/certificados; não compilado nesta entrega. |
| Linux | `bundle.targets: "all"` | Configurado. `cargo check` e `tauri build --no-bundle` rodam no Ubuntu na CI. |
| Android | `tauri.android.conf.json` (`minSdkVersion: 24`) | Configurado. Não compilado na CI (sem Android SDK/NDK). |
| iOS | `tauri.ios.conf.json` (`minimumSystemVersion: "15.0"`) | Configurado. Não compilado na CI (sem macOS/Xcode). |

Ícones: os PNGs em `src-tauri/icons/` foram copiados do scaffold anterior em `apps/native/src-tauri/icons/`. Formatos nativos (`.ico`, `.icns`, ícones Android) não foram gerados nesta entrega; antes de gerar instaladores reais, execute `pnpm --filter @vexorasuite/shell tauri icon` com um ícone-fonte e revise os arquivos resultantes.

Não estão configurados nesta fundação: atualizador, deep links, plugin `shell`, assinatura de código, `developmentTeam` da Apple, keystore Android e publicação em lojas. Um `Cargo.lock` não foi gerado neste PR; o primeiro `cargo check`/`tauri build` cria o arquivo.

## Validação e honestidade

A CI em `.github/workflows/tauri-shell.yml`:

1. roda os testes estáticos de `apps/shell/test/config.test.mjs` (config v2, capacidade local, platform overrides, ícones PNG válidos, scripts e workflow);
2. roda `tauri info` para conferir a configuração com o CLI;
3. instala as dependências WebKit do Linux, executa `cargo check --manifest-path apps/shell/src-tauri/Cargo.toml` e `tauri build --no-bundle --ci`.

A etapa `build` do pacote é intencionalmente um no-op: `pnpm run build` no monorepo não dispara `tauri build`. Builds reais usam os scripts explícitos abaixo.

Para dev em aparelho físico, `localhost` no webview se refere ao aparelho; seria necessário usar `--host`/`TAURI_DEV_HOST` e ajustar o comando do Next.js. Isso não foi implementado nesta fundação.

O workflow **não** instala Android SDK/NDK nem roda em macOS; portanto não afirma que Android ou iOS foram compilados. Não há etapa de assinatura, upload de artefato, publicação, instalação em dispositivo ou teste em aparelho real. **Nenhum binário foi publicado.**

## Uso local (pré-requisitos não verificados neste PR)

```bash
pnpm install
pnpm shell:dev                 # Tauri dev + Next.js em localhost:3000
pnpm shell:build:desktop       # build desktop real (requer toolchain nativa)
pnpm shell:build:android       # requer Android Studio/SDK/NDK e targets Rust
pnpm shell:build:ios           # requer macOS, Xcode e provisioning
```

Esses comandos descrevem a configuração; não significam que foram executados com sucesso nesta máquina ou em um dispositivo.

## Relação com `apps/native`

`apps/native` é um scaffold Tauri v2 anterior, mantido aqui sem alterações para não quebrar referências existentes. Este PR introduz `apps/shell` como a fundação revisável, com validação automatizada e fronteira explícita em relação ao web app. Nenhum dos dois pacotes publicou um binário.
