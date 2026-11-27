import { defineConfig } from "astro/config";

const site = process.env.PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://catalogo.example.com";

export default defineConfig({
  site,
  output: "static",
  trailingSlash: "always",
  compressHTML: true,
  build: {
    format: "directory",
  },
  vite: {
    build: {
      cssMinify: true,
    },
  },
});
