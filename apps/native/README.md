# Véxora Suite — Native (Tauri v2)

Shell nativo do Véxora Suite para **Windows, macOS, Linux, Android e iOS**. O app empacota a versão web ao vivo (`https://app.vexorasuite.com.br`) dentro de uma WebView nativa do sistema, o que elimina o desgaste de cache e sessões lenta do Chrome/Safari.

## Estrutura

```
src-tauri/          Rust + config Tauri v2 (desktop + mobile)
  capabilities/     permissões (shell.open habilitado)
  icons/            conjunto de ícones gerados a partir de `scripts/gen-icon.mjs`
  tauri.conf.json   config principal (prod + dev)
  tauri.android.conf.json
  tauri.ios.conf.json
src/                (não usado — frontendDist aponta para a web)
```

## Pré-requisitos

### Desenvolvimento
- Node.js ≥ 22 + pnpm
- Rust (stable)
- Windows, macOS ou Linux com dev toolchain

### Android
- Android Studio + SDK + NDK
- Source JDK 17
- `rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android`
- `cargo mobile android` SUBPASTA opcional no futuro

### iOS
- Xcode 15+
- `rustup target add aarch64-apple-ios x86_64-apple-ios`
- Apple Developer account para provisioning (hardware físico ou simulator)

## Como rodar/build

```bash
pnpm install
pnpm --filter @vexorasuite/native tauri dev        # desenvolvimento
pnpm --filter @vexorasuite/native tauri build      # desktop (instalável)
pnpm --filter @vexorasuite/native tauri android build
pnpm --filter @vexorasuite/native tauri ios build --open   # via Xcode
```

## Ícones

Os PNGs em `src-tauri/icons/` foram gerados a partir de `scripts/gen-icon.mjs`:

```bash
node scripts/gen-icon.mjs
```

## Limitações conhecidas

- Apple exige assinatura/provisioning; sem certificados configurados, `.ipa` é descartado.
- Android precisa NDK + Android SDK configurado; `ANDROID_HOME` e `ANDROID_SDK_ROOT` apontando para o SDK.
- `tauri ios build` precisa rodar dentro do Xcode (macOS apenas); Linux e Windows têm suporte apenas a Android e desktop.
- A versão sincronizada com o web não tem suporte offline: as atualizações aparecem ao abrir o app, conforme `frontendDist` aponta para `https://app.vexorasuite.com.br`.

## Release

Merge no `foundation/bootstrap-monorepo` → `sync → main` nativos são acompanhando separadamente. Veja `.github/workflows/tauri-builds.yml`.
