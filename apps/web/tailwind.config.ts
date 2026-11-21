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
      /* Breakpoints da Visão geral. São `raw` porque o legado usava
         max-width; o preset passa a ser a única fonte desses cortes. */
      screens: {
        "ov-laptop": { raw: "(max-width: 900px)" },
        "ov-tablet": { raw: "(max-width: 760px)" },
        "ov-mobile": { raw: "(max-width: 520px)" },
        /* Cortes próprios do Atendimento. */
        "ib-narrow": { raw: "(max-width: 600px)" },
        "ib-mobile": { raw: "(max-width: 520px)" },
        /* Cortes próprios dos Relatórios. */
        "rw-wide": { raw: "(max-width: 1100px)" },
        "rw-laptop": { raw: "(max-width: 900px)" },
        "rw-mobile": { raw: "(max-width: 560px)" },
      },
      colors: {
        /* Paleta documentada do Tailwind. Cada tom aponta para um token dos
           três temas — a classe é oficial, a cor continua vinda do tema. */
        blue: {
          50: "var(--primary-soft)",
          100: "var(--vx-core-selection)",
          600: "var(--primary)",
          700: "var(--primary-strong)",
          800: "var(--primary-ink)",
          900: "var(--primary-contrast)",
        },
        zinc: {
          50: "var(--bg)",
          100: "var(--s1)",
          200: "var(--s2)",
          300: "var(--s3)",
          400: "var(--hover)",
        },
        slate: {
          400: "var(--text-muted)",
          600: "var(--tx2)",
          /* --tx é uma cor completa: o placeholder padrão do Tailwind gera
             o modificador de opacidade (bg-slate-950/60 do ::backdrop). */
          950: "rgb(from var(--tx) r g b / <alpha-value>)",
        },
        gray: {
          100: "var(--vx-core-line-soft)",
          200: "var(--ln)",
          300: "var(--ln2)",
          400: "var(--vx-core-line-footer)",
          500: "var(--vx-core-line-hover)",
        },
        indigo: {
          50: "var(--sb-tx)",
          400: "var(--sb-mut)",
          700: "var(--sb-surface, var(--sb-bg))",
          800: "var(--sb-ln)",
          900: "var(--sb-on)",
          950: "var(--sb-bg)",
        },
        neutral: {
          100: "var(--vx-core-topbar-bg)",
        },
        emerald: {
          100: "var(--vx-ok-soft)",
          600: "var(--ok)",
        },
        amber: {
          100: "var(--vx-warn-soft)",
          600: "var(--warn)",
        },
        red: { 100: "var(--vx-bad-soft)", 600: "var(--bad)" },
        sky: { 100: "var(--vx-accent-soft)", 600: "var(--accent2)" },

        /* Alias semânticos usados pelo piloto Ficha Cliente (#903), já
           mergeado. O core migra para as classes oficiais acima; os aliases
           serão removidos quando aquela tela entrar na migração. */
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
          soft: "var(--vx-core-line-soft)",
          footer: "var(--vx-core-line-footer)",
          hover: "var(--vx-core-line-hover)",
        },
        topbar: "var(--vx-core-topbar-bg)",
        hover: "var(--hover)",
        success: {
          DEFAULT: "var(--ok)",
          soft: "var(--vx-ok-soft)",
        },
        warning: {
          DEFAULT: "var(--warn)",
          soft: "var(--vx-warn-soft)",
        },
        sidebar: {
          DEFAULT: "var(--sb-bg)",
          on: "var(--sb-on)",
          line: "var(--sb-ln)",
          muted: "var(--sb-mut)",
          text: "var(--sb-tx)",
          thumb: "var(--sb-thumb)",
        },
        danger: "var(--bad)",
        accent: "var(--accent2)",
        focus: "var(--focus)",
        selection: "var(--vx-core-selection)",
        overlay: {
          DEFAULT: "var(--vx-overlay)",
          soft: "var(--vx-overlay-soft)",
        },
      },
      backgroundImage: {
        /** Wash da página: o ajuste "mais frio e sutil" vive no tema, não no JSX. */
        "vx-page": "var(--vx-core-page-wash)",
        "vx-brand-mark": "var(--vx-core-brand-mark)",
        "vx-nav-active": "var(--vx-core-nav-active)",
        "vx-control": "var(--vx-core-control-bg)",
        /** Shimmer dos skeletons de Relatórios. */
        "rw-shimmer": "linear-gradient(100deg,var(--s3) 20%,var(--hover) 40%,var(--s3) 60%)",
      },
      backgroundSize: {
        "rw-shimmer-size": "200% 100%",
      },
      keyframes: {
        "rw-shimmer": {
          "0%": { backgroundPosition: "120% 0" },
          "100%": { backgroundPosition: "-80% 0" },
        },
      },
      animation: {
        "rw-shimmer": "rw-shimmer 1.4s ease-in-out infinite",
      },
      strokeWidth: {
        ov: "5.5",
      },
      backdropBlur: {
        topbar: "18px",
      },
      backdropSaturate: {
        topbar: "1.12",
      },
      borderRadius: {
        token: "var(--r)",
        "token-sm": "var(--r-sm)",
        "token-lg": "var(--r-lg)",
        "token-xl": "var(--r-xl)",
        brand: "13px",
        square: "6px",
        /* Medidas fixas dos diálogos do Atendimento. */
        "ib-modal": "16px",
        "ib-entry": "9px",
        "ib-article": "10px",
        "ib-panel": "12px",
      },
      borderWidth: {
        /* Borda superior das colunas do Kanban. */
        "crm-stage": "3px",
        /* Filete de destaque das notas de escopo dos Relatórios. */
        "rw-accent": "3px",
      },
      boxShadow: {
        token: "var(--shadow)",
        "token-sm": "var(--shadow-sm)",
        "token-lg": "var(--shadow-lg)",
        "vx-nav-active": "var(--vx-core-shadow-nav-active)",
        "vx-brand": "var(--vx-core-shadow-brand)",
        "vx-topbar": "var(--vx-core-shadow-topbar)",
        "vx-popover": "var(--vx-core-shadow-popover)",
        "vx-submenu": "var(--vx-core-shadow-submenu)",
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
        nav: "13px",
        "nav-section": "10px",
        breadcrumb: "12px",
        "brand-title": ["20px", { lineHeight: "1", letterSpacing: "-.03em" }],
        "brand-mark": "17px",
        "brand-badge": "9px",
        /* Escalas da Visão geral. */
        "ov-hero": ["clamp(19px, 1.7vw, 23px)", { lineHeight: "1.25", letterSpacing: "-0.02em" }],
        "ov-hero-sm": ["19px", { lineHeight: "1.3", letterSpacing: "-0.02em" }],
        "ov-kpi": ["clamp(18px, 1.5vw, 21px)", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
        "ov-clock": ["clamp(40px, 4.2vw, 54px)", { lineHeight: "1", letterSpacing: "-0.04em" }],
        "ov-weather": ["clamp(38px, 4vw, 52px)", { lineHeight: "1", letterSpacing: "-0.04em" }],
        "ov-micro": "12px",
        "ov-label": "12px",
        "ov-sub": ["15px", { lineHeight: "1.5" }],
        "ov-copy": ["13.5px", { lineHeight: "1.45" }],
        "ov-onboarding": ["16px", { lineHeight: "1.35" }],
        /* Títulos dos diálogos do Atendimento. */
        "ib-title": ["1.2rem", { lineHeight: "1.3" }],
        /* Escalas dos Relatórios. */
        "rw-title": ["clamp(26px, 2.4vw, 34px)", { lineHeight: "1.05", letterSpacing: "-.03em" }],
        "rw-value": ["clamp(21px, 1.9vw, 29px)", { lineHeight: "1.15", letterSpacing: "-.03em" }],
        "rw-card-title": ["15px", { lineHeight: "1.35", letterSpacing: "-.015em" }],
        "rw-hint": "11.5px",
        "rw-kpi-label": "10.5px",
        "rw-donut-total": ["22px", { letterSpacing: "-.02em" }],
      },
      fontWeight: {
        heading: "750",
        ov: "650",
        ib: "650",
      },
      letterSpacing: {
        "nav-section": ".13em",
        "brand-badge": ".22em",
        "ov-tight": "-0.045em",
        "ov-wide": ".08em",
        "ov-wider": ".12em",
      },
      spacing: {
        sidebar: "var(--sb)",
        "sidebar-compact": "76px",
        topbar: "var(--top)",
        control: "var(--ctl)",
        token: "var(--gap)",
        pad: "var(--pad)",
        "brand-pad": "18px",
        "nav-gap": "11px",
        "nav-pad": "13px",
        "nav-height": "42px",
        "subitem-height": "34px",
        "submenu-indent": "26px",
        "content-pad-y": "22px",
        search: "250px",
        "tabs-pad-x": "34px",
        /* Medidas dos componentes da Visão geral. */
        "ov-ring": "88px",
        "ov-ring-sm": "76px",
        "ov-ring-photo": "66px",
        "ov-ring-photo-sm": "58px",
        "ov-avatar": "38px",
        "ov-ring-tile": "118px",
        "ov-dock-btn": "58px",
        "ov-dock-gap": "max(24px, 8vw)",
        "ov-dock-pb": "calc(6px + env(safe-area-inset-bottom))",
        "ov-section": "20px",
        /* Espaçamentos dos painéis do Atendimento. */
        "ib-pad": "18px",
        "ib-gap": "9px",
        "ib-block": "10px",
        /* Estado de carregamento do Kanban. */
        "crm-loading-y": "60px",
      },
      gridTemplateColumns: {
        "ov-overview": "minmax(0, 1.62fr) minmax(0, 1fr)",
        "ov-primary": "minmax(0, 1.58fr) minmax(0, 1fr)",
        "ov-main": "minmax(0, 1.55fr) minmax(0, 1fr)",
        "ov-hero-body": "minmax(0, 0.78fr) minmax(0, 1.22fr)",
        "ov-team-row": "auto minmax(0, 1fr) 64px auto",
        "ov-kpi": "repeat(auto-fit, minmax(150px, 1fr))",
        "ov-step": "auto minmax(0, 1fr) auto",
        "ov-topics": "repeat(2, minmax(0, 1fr))",
        "ov-widgets": "minmax(0, 1.15fr) minmax(0, 1.15fr) minmax(0, 1fr)",
        "ov-onboarding-steps": "repeat(auto-fit, minmax(220px, 1fr))",
        "ov-dock": "repeat(auto-fit, minmax(84px, 120px))",
        "ov-calendar": "repeat(7, minmax(0, 1fr))",
        "ov-activity-row": "auto minmax(0, 1fr) auto",
        /* Grades dos diálogos do Atendimento. */
        "ib-track": "minmax(0, 1fr) minmax(0, 1.4fr)",
        "ib-field": "minmax(0, 1fr) minmax(0, 1.4fr) auto",
        /* Grades dos relatórios. */
        "rw-kpi": "repeat(auto-fit, minmax(158px, 1fr))",
        "rw-2": "minmax(0, 1.08fr) minmax(0, 1fr)",
        "rw-hbar": "minmax(88px, 180px) minmax(0, 1fr) 52px",
        "rw-compare": "minmax(0, 1fr) auto auto",
      },
      gridAutoColumns: {
        "crm-stage": "minmax(272px, 1fr)",
      },
      height: {
        /* Skeleton dos Relatórios. */
        "rw-skel-card": "118px",
        "rw-skel-chart": "190px",
        "rw-skel-chart-short": "150px",
        "rw-donut": "132px",
      },
      minHeight: {
        ov: "150px",
        /* Medidas das colunas e cartões do Kanban do CRM. */
        "crm-column": "280px",
        "crm-card": "152px",
        "crm-heading": "62px",
      },
      maxHeight: {
        ficha: "92vh",
        wizard: "80vh",
        logo: "36px",
        "ib-track": "85dvh",
        "ib-support": "min(82dvh, 780px)",
        "crm-column": "calc(100dvh - var(--top) - 235px)",
      },
      maxWidth: {
        content: "1520px",
        tabs: "1500px",
        logo: "46px",
        "ov-heading": "22ch",
        "ov-sub": "42ch",
        /* Medidas do cabeçalho do CRM, migradas do legado para o preset. */
        "crm-copy": "560px",
        "crm-select": "340px",
        "crm-search": "360px",
        /* Texto de apoio dos Relatórios. */
        "rw-sub": "560px",
        "rw-empty": "420px",
      },
      width: {
        "profile-popover": "248px",
        "submenu-compact": "220px",
        "ib-track": "min(760px, calc(100vw - 24px))",
        "ib-support": "min(620px, calc(100vw - 24px))",
        /* Filete de tom à esquerda dos cartões do Kanban. */
        "crm-accent": "3px",
        /* Medidas dos gráficos dos Relatórios. */
        "rw-donut": "132px",
        "rw-dot": "11px",
      },
      minWidth: {
        "submenu-compact": "220px",
        "crm-select": "220px",
        "rw-legend": "170px",
      },
      zIndex: {
        sidebar: "40",
        dock: "45",
        topbar: "30",
        popover: "70",
        wizard: "60",
      },
      transitionProperty: {
        shell: "width, margin-left",
        control: "background-color, border-color, transform",
        stroke: "stroke-dashoffset",
        fill: "width",
      },
      transitionDuration: {
        control: "160ms",
        ring: "600ms",
        bar: "300ms",
      },
      transitionTimingFunction: {
        token: "var(--ease)",
      },
    },
  },
  plugins: [],
};

export default config;
