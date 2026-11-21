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
        "ib-wide": { raw: "(max-width: 1150px)" },
        "ib-shell": { raw: "(max-width: 980px)" },
        "ib-desktop": { raw: "(min-width: 960px)" },
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
          950: "var(--primary-contrast)",
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
        /* Cores de estado da lista de conversas (dados, não branding). */
        "ib-coral": "#F0645E",
        "ib-amber": "#F2A93B",
        "ib-read": "#25D366",
        /* Tons dos canais na ficha: dados do contato, não branding. */
        "ib-instagram": "#E1306C",
        "ib-facebook": "#1877F2",
        "ib-email": "#EA4335",

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
        "ib-avatar": "linear-gradient(150deg,var(--primary-soft),var(--primary-strong))",
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
        "vx-scrim-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "vx-in": {
          from: { opacity: "0", transform: "translateY(14px) scale(.97)" },
          to: { opacity: "1", transform: "none" },
        },
      },
      animation: {
        "rw-shimmer": "rw-shimmer 1.4s ease-in-out infinite",
        "vx-scrim-in": "vx-scrim-in .18s ease both",
        "vx-in": "vx-in .26s var(--ease) both",
      },
      strokeWidth: {
        ov: "5.5",
      },
      borderWidth: {
        /* Filete dos eventos na grade do Calendário. */
        "calendar-event": "3px",
        /* Borda superior das colunas do Kanban. */
        "crm-stage": "3px",
        /* Filete de destaque das notas de escopo dos Relatórios. */
        "rw-accent": "3px",
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
        "ib-quote-qty": "8px",
        "ib-article": "10px",
        "ib-panel": "12px",
        "ib-channel": "5px",
        "ib-dialog-icon": "11px",
        "ib-mention-item": "7px",
        /* Ficha do contato. */
        "ib-profile-field": "7px",
        "ib-profile-tag": "6px",
        "ib-profile-toggle": "10px",
        "ib-profile-add": "8px",
        "ib-profile-card": "14px",
        "ib-profile-origin": "12px",
        /* Workspace de Atendimento. */
        "ib-queue": "99px",
        "ib-bubble": "15px",
        "ib-option": "14px",
        "ib-popover": "16px",
        "ib-handoff": "20px",
        "ib-option-icon": "11px",
        /* Raios do gerenciador de arquivos e do seletor de imagens. */
        "fm-card": "14px",
        "fm-search": "10px",
        "fm-pill": "99px",
        "fm-lightbox": "16px",
      },
      aspectRatio: {
        /* Prévia quadrada dos arquivos e das imagens do site. */
        "fm-preview": "4 / 3",
      },
      gridTemplateRows: {
        "ib-quick-dialog": "auto minmax(0,1fr)",
        "fm-picker-item": "1fr auto",
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
        /* Realces da lista de conversas. */
        "ib-selected": "inset 3px 0 0 var(--primary),inset 0 0 0 1px var(--vx-core-selection)",
        "ib-newdot": "0 0 0 2px var(--vx-ok-soft)",
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
        /* Escalas da lista de conversas. */
        "ib-time": ["10.5px", { lineHeight: "1.35" }],
        "ib-micro": ["9px", { lineHeight: "1.35" }],
        "ib-tick": ["10px", { lineHeight: "1" }],
        "ib-avatar-fallback": ["15px", { lineHeight: "1" }],
        "ib-caption": ["11px", { lineHeight: "1.5" }],
        "ib-label": ["10px", { lineHeight: "1.4", letterSpacing: ".08em" }],
        "ib-input": ["12.5px", { lineHeight: "1.45" }],
        "ib-mention-hint": ["9.5px", { lineHeight: "1.35" }],
        /* Escalas da ficha do contato. */
        "ib-profile-name": ["13px", { lineHeight: "1.25" }],
        "ib-profile-sub": ["10.5px", { lineHeight: "1.3" }],
        "ib-profile-copy": ["11.5px", { lineHeight: "1.3" }],
        "ib-profile-field": ["11.5px", { lineHeight: "1.45" }],
        "ib-profile-pill": ["9px", { lineHeight: "1.2" }],
        "ib-profile-pill-sm": ["9.5px", { lineHeight: "1.2" }],
        "ib-profile-tag": ["10px", { lineHeight: "1.4" }],
        "ib-profile-tab": ["10.5px", { lineHeight: "1.4" }],
        "ib-profile-action": ["11px", { lineHeight: "1.4" }],
        "ib-profile-section": ["11px", { lineHeight: "1.4" }],
        "ib-profile-label": ["10px", { lineHeight: "1.4" }],
        "ib-profile-body": ["13px", { lineHeight: "1.4" }],
        "ib-profile-icon": ["13px", { lineHeight: "1.4" }],
        "ib-profile-note": ["11px", { lineHeight: "1.4" }],
        /* Escalas dos Relatórios. */
        "rw-title": ["clamp(26px, 2.4vw, 34px)", { lineHeight: "1.05", letterSpacing: "-.03em" }],
        "rw-value": ["clamp(21px, 1.9vw, 29px)", { lineHeight: "1.15", letterSpacing: "-.03em" }],
        "rw-card-title": ["15px", { lineHeight: "1.35", letterSpacing: "-.015em" }],
        "rw-hint": "11.5px",
        "rw-kpi-label": "10.5px",
        "rw-donut-total": ["22px", { letterSpacing: "-.02em" }],
        /* Tipografia do gerenciador de arquivos e do seletor de imagens. */
        "fm-meta": "10.5px",
        "fm-pdf": "10px",
        "fm-caption": "12.5px",
      },
      lineHeight: {
        "ib-quote-error": "1.35",
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
        "ib-wide": ".14em",
      },
      spacing: {
        sidebar: "var(--sb)",
        "sidebar-compact": "76px",
        topbar: "var(--top)",
        control: "var(--ctl)",
        "ctl-sm": "var(--ctl-sm)",
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
        /* Medidas da lista de conversas e dos avatares. */
        "ib-avatar": "44px",
        "ib-avatar-sm": "38px",
        "ib-presence": "11px",
        "ib-newdot": "7px",
        "ib-tag": "16px",
        "ib-mark": "18px",
        "ib-profile-avatar": "46px",
        "ib-profile-icon": "36px",
        "ib-profile-collapsed": "54px",
        "ib-profile-toggle": "30px",
        "ib-profile-add": "26px",
        "ib-profile-pill": "16px",
        "ib-profile-pill-sm": "19px",
        "ib-profile-tag": "18px",
        "ib-profile-field": "28px",
        "ib-profile-tab": "26px",
        "ib-reply-action": "30px",
        "ib-empty-icon": "76px",
        "ib-lightbox-offset": "18px",
        "ib-quote-error-y": "5px",
        "ib-quote-qty-x": "9px",
        "vx-dialog-pad": "18px",
        /* Medidas do gerenciador de arquivos e do seletor de imagens. */
        "fm-search": "220px",
        "fm-new-folder": "120px",
        "fm-move": "108px",
        "fm-check": "26px",
        "fm-filter": "30px",
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
        /* Grades do Calendário. */
        "calendar-layout": "minmax(260px, 320px) minmax(0, 1fr)",
        "calendar-event": "auto auto minmax(0, 1fr) auto auto",
        /* Preferências de lembretes de Tarefas. */
        "tasks-reminders": "repeat(auto-fit, minmax(210px, 1fr))",
        /* Grades da gestão de inbox do Atendimento. */
        "ib-inboxes": "repeat(2, minmax(0, 1fr))",
        "ib-compact-meta": "repeat(3, minmax(0, 1fr))",
        "ib-details": "repeat(auto-fit, minmax(170px, 1fr))",
        "ib-detail-row": "96px minmax(0, 1fr)",
        "ib-emoji": "repeat(auto-fill, minmax(34px, 1fr))",
        /* Grades internas da ficha do contato. */
        "ib-profile-field-row": "minmax(0, 1fr) auto",
        "ib-profile-identity": "minmax(0, 1fr) auto",
        /* Shell do workspace de Atendimento. */
        "ib-workspace": "minmax(260px,340px) minmax(0,1fr) minmax(300px,380px)",
        "ib-workspace-profile": "minmax(240px,280px) minmax(0,1fr) minmax(300px,380px)",
        "ib-supervision": "repeat(4,1fr)",
        /* Grades do gerenciador de arquivos e do seletor de imagens. */
        "fm-items": "repeat(auto-fill,minmax(180px,1fr))",
        "fm-picker": "repeat(auto-fill,minmax(150px,1fr))",
      },
      gridAutoColumns: {
        "crm-stage": "minmax(272px, 1fr)",
      },
      height: {
        /* Shell do workspace de Atendimento. */
        "ib-workspace": "calc(100dvh - var(--top) - 56px)",
        /* Skeleton dos Relatórios. */
        "rw-skel-card": "118px",
        "rw-skel-chart": "190px",
        "rw-skel-chart-short": "150px",
        "rw-donut": "132px",
        /* Prévia do local no mapa do Calendário. */
        "calendar-map": "clamp(180px, 38dvh, 320px)",
      },
      minHeight: {
        ov: "150px",
        "ib-control": "37px",
        "ib-workspace": "520px",
        "ib-quote": "320px",
        "ib-quote-qty": "30px",
        "fm-filter": "30px",
        /* Célula do mês e largura mínima da lista de compromissos. */
        "calendar-day": "104px",
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
        "ib-mention": "240px",
        "ib-note": "min(100%, 520px)",
        "ib-quote-list": "56vh",
        "ib-dialog": "calc(100dvh - 44px)",
        /* Popovers, menus e diálogos do shell de Atendimento. */
        "ib-context-menu": "min(340px, 62vh)",
        "ib-handoff": "min(72dvh, 560px)",
        "ib-emoji-grid": "260px",
        "ib-quick-settings": "380px",
        "ib-quick": "min(640px, 72dvh)",
        /* Diálogos do Calendário. */
        "calendar-modal": "90vh",
        "calendar-event-modal": "calc(100dvh - 24px)",
        "crm-column": "calc(100dvh - var(--top) - 235px)",
        /* Alturas do seletor de imagens e do lightbox do gerenciador. */
        "fm-picker-grid": "420px",
        "fm-lightbox-img": "74vh",
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
        "ib-copy": "42ch",
        "ib-bubble": "min(78%, 560px)",
        "ib-quote-empty": "70%",
        /* Texto de apoio dos Relatórios. */
        "rw-sub": "560px",
        "rw-empty": "420px",
        /* Diálogos e controles do Calendário. */
        "calendar-modal": "520px",
        "calendar-event-modal": "620px",
        "calendar-copy": "44ch",
        "calendar-select": "148px",
        "calendar-chip": "150px",
        /* Larguras dos controles e textos da ficha do contato. */
        "ib-profile-control": "400px",
        "ib-profile-copy": "560px",
        "ib-profile-row": "460px",
        "ib-profile-agenda": "320px",
        /* Larguras do gerenciador de arquivos e do lightbox de imagens. */
        "fm-move": "108px",
        "fm-lightbox": "min(960px,94vw)",
        "fm-picker-body": "min(860px,94vw)",
      },
      width: {
        "profile-popover": "248px",
        "submenu-compact": "220px",
        "ib-track": "min(760px, calc(100vw - 24px))",
        "ib-support": "min(620px, calc(100vw - 24px))",
        "ib-queue-menu": "180px",
        "ib-status-menu": "210px",
        "ib-context-menu": "190px",
        "ib-voice-wave": "3px",
        "ib-voice-button": "34px",
        "ib-dialog": "min(100%, 520px)",
        "ib-dialog-wide": "min(100%, 860px)",
        "ib-mention": "min(100vw - 32px, 360px)",
        /* Filete redimensionável entre grade e lista. */
        "calendar-handle": "6px",
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
        "calendar-event-date": "58px",
        "calendar-month": "118px",
        "ib-queue-menu": "180px",
        "ib-status-menu": "210px",
        "ib-context-menu": "190px",
        "fm-search": "220px",
        "fm-new-folder": "120px",
        "fm-picker-body": "min(860px,94vw)",
      },
      zIndex: {
        sidebar: "40",
        dock: "45",
        topbar: "30",
        popover: "70",
        wizard: "60",
        /* Camadas do shell de Atendimento. */
        "ib-queue-menu": "50",
        "ib-status-menu": "60",
        "ib-context-menu": "80",
        "ib-overlay": "120",
        "ib-fullscreen": "130",
        "ib-handoff": "190",
        "ib-lightbox": "240",
        "ib-dialog": "1000",
        "ib-dialog-inner": "1",
        "ib-mention": "65",
        "fm-lightbox": "60",
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
