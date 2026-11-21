import type { Config } from "tailwindcss";

/**
 * Preset Véxora — Tailwind é uma camada de utilities sobre os tokens já
 * existentes em vexora.css. Não há preflight: o CSS legado permanece intacto
 * enquanto migrarmos tela a tela.
 *
 * Todas as cores apontam para variáveis CSS, então o modo escuro
 * (`[data-theme="dark"]`) e o tema híbrido são herdados automaticamente.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "var(--primary)",
          soft: "var(--primary-soft)",
          ink: "var(--primary-ink)",
          strong: "var(--primary-strong)",
          contrast: "var(--primary-contrast)",
        },
        surface: {
          DEFAULT: "var(--s1)",
          2: "var(--s2)",
          3: "var(--s3)",
          page: "var(--bg)",
        },
        ink: {
          DEFAULT: "var(--tx)",
          secondary: "var(--tx2)",
          muted: "var(--text-muted)",
        },
        line: {
          DEFAULT: "var(--ln)",
          strong: "var(--ln2)",
        },
        success: {
          DEFAULT: "var(--ok)",
          soft: "var(--vx-ok-soft)",
        },
        warning: {
          DEFAULT: "var(--warn)",
          soft: "var(--vx-warn-soft)",
        },
        danger: "var(--bad)",
        overlay: {
          DEFAULT: "var(--vx-overlay)",
          soft: "var(--vx-overlay-soft)",
        },
      },
      borderRadius: {
        token: "var(--r)",
        "token-sm": "var(--r-sm)",
        "token-lg": "var(--r-lg)",
        "token-xl": "var(--r-xl)",
      },
      boxShadow: {
        token: "var(--shadow)",
        "token-sm": "var(--shadow-sm)",
        "token-lg": "var(--shadow-lg)",
      },
      fontFamily: {
        ui: "var(--font-ui)",
        display: "var(--font-display)",
      },
      fontSize: {
        "2xs": "10px",
      },
      maxHeight: {
        ficha: "92vh",
        wizard: "80vh",
      },
      zIndex: {
        wizard: "60",
      },
      transitionTimingFunction: {
        token: "var(--ease)",
      },
    },
  },
  plugins: [],
};

export default config;
