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
        accent: "var(--accent2)",
        focus: "var(--focus)",
        selection: "color-mix(in srgb, var(--primary) 22%, transparent)",
        overlay: {
          DEFAULT: "var(--vx-overlay)",
          soft: "var(--vx-overlay-soft)",
        },
      },
      backgroundImage: {
        /** Wash da página: o ajuste "mais frio e sutil" vive aqui, não no JSX. */
        "vx-page":
          "radial-gradient(72rem 40rem at 100% -12%, color-mix(in srgb, var(--primary) 5%, transparent), transparent 62%)",
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
        inherit: "inherit",
        ui: 'var(--font-ui),"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",system-ui,sans-serif',
        display: "var(--font-display)",
      },
      fontSize: {
        "2xs": "10px",
        body: ["13px", { lineHeight: "1.55", letterSpacing: "-0.005em" }],
        h1: ["clamp(28px, 2.7vw, 38px)", { lineHeight: "1.08", letterSpacing: "-0.035em" }],
        h2: ["17px", { lineHeight: "1.3", letterSpacing: "-0.015em" }],
        h3: ["14.5px", { lineHeight: "1.35", letterSpacing: "-0.01em" }],
        h4: ["14px", { lineHeight: "1.4", letterSpacing: "-0.01em" }],
        h5: ["13px", { lineHeight: "1.45", letterSpacing: "-0.005em" }],
        h6: ["12px", { lineHeight: "1.5", letterSpacing: "0" }],
        small: ["12px", { lineHeight: "1.5" }],
      },
      fontWeight: {
        heading: "750",
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
