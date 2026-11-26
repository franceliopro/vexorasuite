# Shell Tauri v2 — desktop e mobile

## Fronteira de responsabilidade

`apps/web` (Next.js) continua sendo a interface canônica e a única fonte de regras de negócio. `apps/shell` é apenas uma **casca**: uma WebView nativa Tauri v2 que abre a aplicação web já existente. Nenhuma lógica de negócio, autenticação, API, rota ou componente foi reescrito para Rust ou para um frontend novo.

- **Produção:** `build.frontendDist` aponta para `https://app.vexorasuite.com.br`. O binário não incorpora arquivos da interface; ele carrega a URL publicada pelo web app.
- **Desenvolvimento:** `build.devUrl` é `http://localhost:3000` e `beforeDevCommand` inicia `pnpm --filter @vexorasuite/web dev`. O web app continua sendo servido pelo Next.js, com hot reload.
- **Build:** `beforeBuildCommand` executa `pnpm --filter @vexorasuite/web build` para validar o frontend; a URL remota permanece a origem em produção.
- **IPC:** a capacidade `main-local` é `local: true`, então a página remota de produção não recebe permissões Tauri. `withGlobalTauri` é `false` e nenhum comando Rust é registrado.

O CSP da aplicação em produção continua sendo o enviado pelo Next.js; `app.security.csp` do Tauri não altera as respostas HTTP da URL remota.

## Ícone nativo

O ícone é derivado de `sites/institucional/assets/logo-app.svg`, cópia exata do logotipo fornecido pelo proprietário para os apps, com `tauri icon --fit contain` para preservar a arte inteira em um canvas quadrado. Os logos usados no site institucional não foram alterados. O comando versionado é `pnpm shell:icon` (`pnpm --filter @vexorasuite/shell icon`). Ele gera, em `apps/shell/src-tauri/icons/`:

- PNGs para desktop e Windows Store, `icon.ico` e `icon.icns`;
- ícones adaptativos e launcher do Android;
- ícones iOS.

`tauri.conf.json` referencia os PNGs, o ICO e o ICNS. A arte gerada é determinística a partir do SVG; a revisão visual em dispositivos reais ainda deve ser feita antes de qualquer publicação.

## O que está configurado e o que a CI executa

| Alvo | Configuração | Status real |
| --- | --- | --- |
| Windows | `bundle.targets: "all"` + ícones gerados | Job `windows` em `windows-latest` compila um instalador **NSIS** e o anexa como artefato. MSI, assinatura de código e publicação não são executados. |
| macOS | `bundle.targets: "all"`, `tauri.conf.json`, `icon.icns` | Configurado. Requer macOS/Xcode e certificados; não compilado nesta entrega. |
| Linux | `bundle.targets: "all"` | `cargo check` e `tauri build --no-bundle` rodam no Ubuntu na CI. |
| Android | `tauri.android.conf.json` (`minSdkVersion: 24`) + ícones adaptativos | Job `android` em `ubuntu-latest` inicializa o projeto, compila o APK universal, gera uma chave **descartável no runner** e anexa `vexora-shell-android-signed-apk`. O APK não assinado continua disponível para auditoria. AAB, Play Store e chave de produção não são executados. |
| iOS | `tauri.ios.conf.json` (`minimumSystemVersion: "15.0"`) | Configurado, com ícones gerados. Requer macOS/Xcode e provisioning; não compilado nesta entrega. |

Não estão configurados nesta entrega: atualizador, deep links, plugin `shell`, assinatura de código do Windows, `developmentTeam` da Apple, keystore Android de produção e publicação em lojas. A assinatura do Android é apenas de prévia: a chave nasce e morre no runner, então atualizações futuras exigirão outra assinatura. Um `Cargo.lock` não foi gerado neste PR; o primeiro `cargo check`/`tauri build` cria o arquivo.

## Validação e honestidade

A CI em `.github/workflows/tauri-shell.yml`:

1. roda os testes estáticos de `apps/shell/test/config.test.mjs` (config v2, capacidade local, platform overrides, ícones nativos gerados do SVG, scripts e workflow) e `tauri info`;
2. instala as dependências WebKit do Linux, executa `cargo check --manifest-path apps/shell/src-tauri/Cargo.toml` e `tauri build --no-bundle --ci`;
3. compila o instalador NSIS no Windows e anexa `vexora-shell-windows-nsis` como artefato de CI;
4. instala Java 17, Android SDK/NDK e targets Rust, inicializa o projeto Android, compila APKs com `tauri android build --ci --apk`, alinha e assina o universal com `zipalign` + `apksigner` usando uma chave temporária, verifica a assinatura e anexa `vexora-shell-android-signed-apk` como artefato de CI.

Artefato de CI **não** é publicação: o workflow não cria release, não envia para lojas, não notariza, não instala em dispositivo e não testa em aparelho real. A publicação, quando feita, é uma pré-release manual em `https://github.com/franceliopro/vexorasuite/releases/tag/v0.1.0-preview` com os nomes `Vexora-Suite-0.1.0-x64-setup.exe` e `Vexora-Suite-0.1.0-universal.apk`; o botão da sidebar aponta para esses links. **Nenhum binário foi publicado pelo workflow.** A pré-release manual é registrada separadamente e não é resultado automático de merge.

A etapa `build` do pacote é intencionalmente um no-op: `pnpm run build` no monorepo não dispara `tauri build`. Builds reais usam os scripts explícitos abaixo.

Para dev em aparelho físico, `localhost` no webview se refere ao aparelho; seria necessário usar `--host`/`TAURI_DEV_HOST` e ajustar o comando do Next.js. Isso não foi implementado nesta fundação.

## Uso local (pré-requisitos não verificados neste PR)

```bash
pnpm install
pnpm shell:icon              # regera os ícones a partir do SVG institucional
pnpm shell:dev               # Tauri dev + Next.js em localhost:3000
pnpm shell:build:desktop     # build desktop real (requer toolchain nativa)
pnpm shell:build:android     # requer Android Studio/SDK/NDK e targets Rust
pnpm shell:build:ios         # requer macOS, Xcode e provisioning
```

Esses comandos descrevem a configuração; não significam que foram executados com sucesso nesta máquina ou em um dispositivo.

## Relação com `apps/native`

`apps/native` é um scaffold Tauri v2 anterior, mantido aqui sem alterações para não quebrar referências existentes. `apps/shell` permanece como a casca revisável, com validação automatizada e fronteira explícita em relação ao web app. Nenhum dos dois pacotes publicou um binário.
