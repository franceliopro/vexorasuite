#!/usr/bin/env node
/**
 * Cria um site novo a partir do template Astro.
 *
 * Uso:
 *   node sites/_template/scripts/scaffold-site.mjs "Nome do Site" \
 *     --slug nome-do-site --url https://www.exemplo.com.br \
 *     --email contato@exemplo.com.br --phone "(64) 3333-4444" \
 *     --whatsapp 5564999999999 --address "Cidade - UF"
 *
 * Também aceita --config arquivo.json para personalizar hero, features,
 * navegação e redes sociais. Veja sites/_template/README.md.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const templateDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const parsed = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token.startsWith("--")) {
      const key = token.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      const next = argv[index + 1];
      if (next === undefined || next.startsWith("--")) {
        parsed[key] = true;
      } else {
        parsed[key] = next;
        index += 1;
      }
    } else {
      parsed._.push(token);
    }
  }
  return parsed;
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const args = parseArgs(process.argv.slice(2));
/** Flags sem valor viram string vazia (nunca "true" em campo de contato). */
const textArg = (key) => (typeof args[key] === "string" ? args[key] : "");
const name = args.name || args._[0];
if (!name) {
  console.error("[scaffold] Informe o nome do site: node scaffold-site.mjs \"Nome\" --slug ...");
  process.exit(1);
}

const slug = String(args.slug || slugify(name));
if (!/^[a-z0-9][a-z0-9-]{1,59}$/.test(slug)) {
  console.error(`[scaffold] Slug inválido: ${slug}. Use letras minúsculas, números e hífens.`);
  process.exit(1);
}

const outDir = resolve(args.out || join(templateDir, "..", slug));
if (existsSync(outDir) && !args.force) {
  console.error(`[scaffold] Destino já existe: ${outDir}. Use --force para sobrescrever.`);
  process.exit(1);
}

const custom = args.config
  ? JSON.parse(readFileSync(resolve(String(args.config)), "utf8"))
  : {};

const base = {
  name,
  title: textArg("title") || name,
  description: textArg("description") || `${name} — informações, conteúdo e contato.`,
  url: textArg("url") || "https://example.com",
  locale: "pt-BR",
  themeColor: "#071329",
  logo: "/logo.svg",
  email: textArg("email"),
  phone: textArg("phone"),
  whatsapp: textArg("whatsapp"),
  whatsappMessage: "Olá! Vim pelo site e gostaria de mais informações.",
  address: textArg("address"),
  hero: {
    eyebrow: `Bem-vindo ao ${name}`,
    title: "Sua presença digital",
    accent: "com propósito",
    description: textArg("description") || `${name} — informações, conteúdo e contato.`,
    primaryLabel: "Fale conosco",
    primaryHref: "",
    secondaryLabel: "Saiba mais",
    secondaryHref: "/sobre/",
  },
  features: [
    { icon: "01", title: "Informação clara", description: "Conteúdo objetivo e fácil de encontrar." },
    { icon: "02", title: "Rápido em qualquer tela", description: "Página leve, estática e responsiva." },
    { icon: "03", title: "Contato simples", description: "Canais oficiais e formulário integrado." },
  ],
  navigation: [
    { label: "Início", href: "/" },
    { label: "Sobre", href: "/sobre/" },
    { label: "Contato", href: "/contato/" },
  ],
  social: [],
};

const config = {
  ...base,
  ...custom,
  name,
  title: textArg("title") || custom.title || name,
  description: textArg("description") || custom.description || base.description,
  url: textArg("url") || custom.url || base.url,
};

mkdirSync(dirname(outDir), { recursive: true });
cpSync(templateDir, outDir, {
  recursive: true,
  filter: (source) => {
    const normalized = source.replace(/\\/g, "/");
    return !/(\/|^)(node_modules|dist|\.astro|\.git)(\/|$)/.test(normalized)
      && !normalized.endsWith("/pnpm-lock.yaml")
      && !normalized.endsWith("/.env");
  },
});

const configFile = `import type { SiteConfig } from "./site.types";

/**
 * Configuração central de ${name}.
 * Valores vazios ou de exemplo não viram links publicados.
 */
export const site: SiteConfig = ${JSON.stringify(config, null, 2)};
`;
writeFileSync(join(outDir, "src", "data", "site.config.ts"), configFile, "utf8");

const packagePath = join(outDir, "package.json");
const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
pkg.name = `@vexorasuite/site-${slug}`;
writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");

const configPath = join(outDir, "astro.config.mjs");
const configSource = readFileSync(configPath, "utf8").replace(
  '|| "https://example.com"',
  `|| "${config.url}"`,
);
writeFileSync(configPath, configSource, "utf8");

const envExample = join(outDir, ".env.example");
writeFileSync(
  envExample,
  readFileSync(envExample, "utf8").replace("https://example.com", config.url),
  "utf8",
);

const readme = `# ${name}

Site público construído com o padrão Astro da Véxora.

## Estado

Build configurado. **Publicação não é afirmada sem evidência HTTP 2xx no domínio final.**

## Desenvolvimento

\`\`\`bash
cd sites/${slug}
pnpm install
pnpm dev
pnpm verify
\`\`\`

- \`pnpm dev\`: servidor local em http://localhost:3200
- \`pnpm verify\`: checagem de tipos, build estático e auditoria de links

## Antes de publicar

1. Confirme em \`src/data/site.config.ts\` os canais oficiais (e-mail, telefone, WhatsApp, endereço).
2. Substitua os textos em \`src/content/pages/\`.
3. Configure \`PUBLIC_SITE_URL\` com a URL final.
4. Se houver endpoint de formulário, defina \`PUBLIC_CONTACT_ENDPOINT\` (HTTPS).
5. No Cloudflare Pages: Root directory \`sites/${slug}\`, build \`pnpm build\`, output \`dist/\`.

## Publicação e Aba Sites

O build gera \`dist/\`. O preview é registrado na Aba Sites com URL HTTPS e \`commitSha\`;
a aprovação é humana; a publicação é feita pelo host/executor; o status \`PUBLISHED\`
só é gravado depois do health-check 2xx do domínio final.
`;
writeFileSync(join(outDir, "README.md"), readme, "utf8");

console.log(`[scaffold] Site criado em ${outDir}`);
console.log("[scaffold] Próximo passo: pnpm install && pnpm verify");
