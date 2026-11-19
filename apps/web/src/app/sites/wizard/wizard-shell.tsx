'use client';

/**
 * Véxora Sites — Wizard base: janela não-modal em tela cheia com minimizar/restaurar/fechar.
 * Etapas: Origem → Tipo → Tema → Domínio → Publicar.
 * Minimizar reduz a um dock flutuante inferior sem perder o estado.
 * Leigos veem poucos botões; opções avançadas ficam no editor.
 * Tokens Véxora (var(--...)) sem hex direto; ícones lucide-react.
 *
 * Pontos de integração com o programador:
 *  - onComplete: chamado ao concluir com { title, type, domain? }
 *  - Domínio: etapa reutiliza a configuração de domínio (endpoint TODO do backend)
 */

import { useCallback, useState } from 'react';
import {
  X,
  Maximize,
  Minimize,
  ChevronRight,
  ChevronLeft,
  Globe,
  Palette,
  Rocket,
  Cloud,
  Link,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';

type WizardStep = 'origem' | 'tipo' | 'tema' | 'dominio' | 'publicar';

type OrigemKind = 'zero' | 'clone' | 'zip' | 'ia';

type SiteType = 'static' | 'blog' | 'real-estate' | 'ecommerce';

const STEP_ORDER: WizardStep[] = ['origem', 'tipo', 'tema', 'dominio', 'publicar'];

const STEP_LABELS: Record<WizardStep, string> = {
  origem: 'Origem',
  tipo: 'Tipo',
  tema: 'Tema',
  dominio: 'Domínio',
  publicar: 'Publicar',
};

const STEP_ICONS: Record<WizardStep, React.ElementType> = {
  origem: Link,
  tipo: Palette,
  tema: Globe,
  dominio: Cloud,
  publicar: Rocket,
};

interface WizardShellProps {
  open: boolean;
  onClose: () => void;
  onComplete: (site: { title: string; type: SiteType; domain?: string }) => void;
  disabled?: boolean;
}

const TOKENS = {
  primary: 'var(--primary, #2563eb)',
  surface: 'var(--surface, #ffffff)',
  background: 'var(--background, #f9fafb)',
  text: 'var(--text, #111827)',
  textSecondary: 'var(--text-secondary, #6b7280)',
  border: 'var(--border, #e5e7eb)',
  ok: 'var(--ok, #059669)',
  bad: 'var(--bad, #dc2626)',
  radius: 'var(--r, 12px)',
};

export default function WizardShell({
  open,
  onClose,
  onComplete,
  disabled = false,
}: WizardShellProps) {
  const [step, setStep] = useState<WizardStep>('origem');
  const [minimized, setMinimized] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [domainValidated, setDomainValidated] = useState(false);

  const [origem, setOrigem] = useState<OrigemKind>('zero');
  const [cloneUrl, setCloneUrl] = useState('');
  const [siteType, setSiteType] = useState<SiteType>('static');
  const [theme, setTheme] = useState('default');
  const [domain, setDomain] = useState('');
  const [siteTitle, setSiteTitle] = useState('');

  const currentIndex = STEP_ORDER.indexOf(step);
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === STEP_ORDER.length - 1;
  const canNext =
    currentIndex < STEP_ORDER.length - 1 &&
    (step !== 'dominio' || domainValidated);

  const handleNext = useCallback(() => {
    if (!canNext) return;
    const next = STEP_ORDER[currentIndex + 1];
    if (next) setStep(next);
  }, [canNext, currentIndex]);

  const handleBack = useCallback(() => {
    if (isFirst) return;
    const prev = STEP_ORDER[currentIndex - 1];
    if (prev) setStep(prev);
  }, [isFirst, currentIndex]);

  const handleMinimize = useCallback(() => {
    setMinimized((p) => !p);
  }, []);

  const handleFinish = useCallback(async () => {
    setBusy(true);
    try {
      // TODO: programador persiste o site e dispara deploy via endpoints de domínio
      await new Promise((r) => setTimeout(r, 800));
      onComplete({ title: siteTitle, type: siteType, domain: domain || undefined });
    } finally {
      setBusy(false);
    }
  }, [siteTitle, siteType, domain, onComplete]);

  if (minimized) {
    return (
      <div
        className="vx-wizard-dock"
        role="region"
        aria-label="Assistente de criação de site minimizado"
        style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 8,
          zIndex: 9999,
        }}
      >
        <button
          type="button"
          className="vx-wizard-dock-btn"
          onClick={handleMinimize}
          title="Restaurar assistente"
          style={{
            padding: '0.5rem 1rem',
            borderRadius: TOKENS.radius,
            background: TOKENS.primary,
            color: 'var(--on-primary, var(--surface))',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Globe size={16} aria-hidden="true" />
          <span>Criar site — {STEP_LABELS[step]}</span>
        </button>
        <button
          type="button"
          className="vx-wizard-dock-close"
          onClick={onClose}
          aria-label="Fechar assistente"
          style={{
            padding: '0.5rem',
            borderRadius: TOKENS.radius,
            background: TOKENS.surface,
            color: TOKENS.text,
            border: `1px solid ${TOKENS.border}`,
            cursor: 'pointer',
          }}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    );
  }

  if (!open) return null;

  return (
    <div
      className="vx-wizard"
      role="dialog"
      aria-modal="true"
      aria-label="Assistente de criação de site"
      style={{
        position: 'fixed',
        inset: 0,
        background: TOKENS.background,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <header
        className="vx-wizard-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          background: TOKENS.surface,
          borderBottom: `1px solid ${TOKENS.border}`,
        }}
      >
        <div className="vx-wizard-header-left" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            className="vx-wizard-btn"
            aria-label={minimized ? 'Restaurar' : 'Minimizar'}
            onClick={handleMinimize}
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '8px',
              border: `1px solid ${TOKENS.border}`,
              background: TOKENS.surface,
              color: TOKENS.text,
              cursor: 'pointer',
            }}
          >
            {minimized ? <Maximize size={16} aria-hidden="true" /> : <Minimize size={16} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="vx-wizard-btn"
            aria-label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            onClick={() => setFullscreen((p) => !p)}
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '8px',
              border: `1px solid ${TOKENS.border}`,
              background: TOKENS.surface,
              color: TOKENS.text,
              cursor: 'pointer',
            }}
          >
            {fullscreen ? <Minimize size={16} aria-hidden="true" /> : <Maximize size={16} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="vx-wizard-btn"
            aria-label="Fechar assistente"
            onClick={onClose}
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '8px',
              border: `1px solid ${TOKENS.border}`,
              background: TOKENS.surface,
              color: TOKENS.text,
              cursor: 'pointer',
            }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="vx-wizard-header-center">
          <h2
            className="vx-wizard-title"
            style={{
              margin: 0,
              fontSize: '1.125rem',
              color: TOKENS.text,
              fontWeight: 700,
            }}
          >
            Criar site
          </h2>
          <p
            className="vx-wizard-sub"
            style={{
              margin: 0,
              fontSize: '0.875rem',
              color: TOKENS.textSecondary,
            }}
          >
            {STEP_LABELS[step]}
          </p>
        </div>
      </header>

      <ol
        className="vx-wizard-progress"
        aria-label="Etapas do assistente"
        style={{
          display: 'flex',
          gap: 8,
          padding: '0.75rem 1rem',
          background: TOKENS.surface,
          borderBottom: `1px solid ${TOKENS.border}`,
          overflowX: 'auto',
        }}
      >
        {STEP_ORDER.map((s, i) => {
          const isDone = i < currentIndex;
          const isCurrent = i === currentIndex;
          return (
            <li
              key={s}
              className={`vx-wizard-step ${isDone ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <button
                type="button"
                className="vx-wizard-step-btn"
                disabled={!isDone && !isCurrent}
                onClick={() => (isDone ? setStep(s) : undefined)}
                aria-current={isCurrent ? 'step' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '0.25rem 0.6rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: isCurrent
                    ? TOKENS.primary
                    : isDone
                    ? `color-mix(in srgb, ${TOKENS.ok} 12%, transparent)`
                    : 'transparent',
                  color: isCurrent ? 'var(--on-primary, var(--surface))' : isDone ? TOKENS.ok : TOKENS.textSecondary,
                  cursor: (isDone || isCurrent) ? 'pointer' : 'default',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                }}
              >
                <span
                  className="vx-wizard-step-badge"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: isCurrent
                      ? 'var(--on-primary, var(--surface))'
                      : isDone
                      ? TOKENS.ok
                      : TOKENS.surface,
                    color: isCurrent ? TOKENS.primary : isDone ? 'var(--on-primary, var(--surface))' : TOKENS.textSecondary,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    border: `1px solid ${TOKENS.border}`,
                  }}
                >
                  {isDone ? <CheckCircle2 size={12} aria-hidden="true" /> : i + 1}
                </span>
                <span className="vx-wizard-step-label">{STEP_LABELS[s]}</span>
              </button>
              {i < STEP_ORDER.length - 1 && (
                <span
                  className="vx-wizard-step-connector"
                  aria-hidden="true"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: isDone ? TOKENS.ok : TOKENS.border,
                  }}
                />
              )}
            </li>
          );
        })}
      </ol>

      <div className="vx-wizard-body" style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
        {step === 'origem' && <OrigemStep value={origem} onChange={setOrigem} cloneUrl={cloneUrl} onCloneUrlChange={setCloneUrl} disabled={disabled} />}
        {step === 'tipo' && <TipoStep value={siteType} onChange={setSiteType} disabled={disabled} />}
        {step === 'tema' && <TemaStep value={theme} onChange={setTheme} disabled={disabled} />}
        {step === 'dominio' && (
          <DominioStep
            domain={domain}
            onChange={setDomain}
            onDomainValidated={() => setDomainValidated(true)}
            siteSlug={siteTitle.toLowerCase().replace(/\s+/g, '-')}
            disabled={disabled}
          />
        )}
        {step === 'publicar' && (
          <PublicarStep
            siteTitle={siteTitle}
            siteType={siteType}
            domain={domain}
            onFinish={handleFinish}
            busy={busy}
            disabled={disabled}
          />
        )}
      </div>

      <footer
        className="vx-wizard-footer"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          background: TOKENS.surface,
          borderTop: `1px solid ${TOKENS.border}`,
        }}
      >
        {!isFirst && (
          <button
            type="button"
            className="vx-wizard-btn-secondary"
            disabled={disabled || busy}
            onClick={handleBack}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: TOKENS.radius,
              border: `1px solid ${TOKENS.border}`,
              background: TOKENS.surface,
              color: TOKENS.text,
              cursor: (disabled || busy) ? 'not-allowed' : 'pointer',
              fontWeight: 600,
            }}
          >
            <ChevronLeft size={14} aria-hidden="true" style={{ marginRight: 6 }} />
            Voltar
          </button>
        )}
        {isLast ? (
          <button
            type="button"
            className="vx-wizard-btn-primary"
            disabled={disabled || busy || !domain}
            onClick={handleFinish}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: TOKENS.radius,
              border: 'none',
              background: (disabled || busy || !domain) ? TOKENS.border : TOKENS.primary,
              color: (disabled || busy || !domain) ? TOKENS.textSecondary : 'var(--on-primary, var(--surface))',
              cursor: (disabled || busy || !domain) ? 'not-allowed' : 'pointer',
              fontWeight: 600,
            }}
          >
            {busy ? (
              <>
                <Loader2 size={15} className="vx-spin" aria-hidden="true" style={{ marginRight: 6 }} />
                Publicando…
              </>
            ) : (
              <>
                <Rocket size={15} aria-hidden="true" style={{ marginRight: 6 }} />
                Publicar site
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            className="vx-wizard-btn-primary"
            disabled={disabled || busy}
            onClick={handleNext}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: TOKENS.radius,
              border: 'none',
              background: TOKENS.primary,
              color: 'var(--on-primary, var(--surface))',
              cursor: (disabled || busy) ? 'not-allowed' : 'pointer',
              fontWeight: 600,
            }}
          >
            Próximo
            <ChevronRight size={14} aria-hidden="true" style={{ marginLeft: 6 }} />
          </button>
        )}
      </footer>
    </div>
  );
}

/* ---------- Etapa: Origem ---------- */

interface OrigemStepProps {
  value: OrigemKind;
  onChange: (v: OrigemKind) => void;
  cloneUrl: string;
  onCloneUrlChange: (v: string) => void;
  disabled: boolean;
}

function OrigemStep({ value, onChange, cloneUrl, onCloneUrlChange, disabled }: OrigemStepProps) {
  const options: Array<{ id: OrigemKind; label: string; desc: string; icon: React.ElementType }> = [
    { id: 'zero', label: 'Do zero', desc: 'Comece com uma página em branco.', icon: Palette },
    { id: 'clone', label: 'Clonar link', desc: 'Importe a estrutura de um site existente.', icon: Link },
    { id: 'zip', label: 'Importar ZIP', desc: 'Importe um pacote Elementor/Divi/Crocoblock.', icon: Cloud },
    { id: 'ia', label: 'Gerar por IA', desc: 'Descreva o negócio e a IA monta o site.', icon: Rocket },
  ];

  return (
    <section className="vx-wizard-step-panel" style={{ padding: '1rem 0' }}>
      <header className="vx-wizard-step-head">
        <h3 className="vx-wizard-step-title">Como você quer começar?</h3>
        <p className="vx-wizard-step-sub">
          Escolha a origem do site. Você poderá editar tudo no editor depois.
        </p>
      </header>
      <div className="vx-wizard-options" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {options.map((opt) => {
          const active = value === opt.id;
          const Icon = opt.icon;
          return (
            <button
              key={opt.id}
              type="button"
              className={`vx-wizard-option ${active ? 'is-active' : ''} ${disabled ? 'is-disabled' : ''}`}
              aria-pressed={active}
              onClick={() => !disabled && onChange(opt.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '0.75rem 1rem',
                borderRadius: TOKENS.radius,
                border: active ? `1px solid ${TOKENS.primary}` : `1px solid ${TOKENS.border}`,
                background: active ? `color-mix(in srgb, ${TOKENS.primary} 10%, transparent)` : TOKENS.surface,
                color: TOKENS.text,
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div className="vx-wizard-option-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '8px', background: active ? TOKENS.primary : TOKENS.surface, border: `1px solid ${active ? TOKENS.primary : TOKENS.border}` }}>
                <Icon size={16} aria-hidden="true" style={{ color: active ? 'var(--on-primary, var(--surface))' : TOKENS.textSecondary }} />
              </div>
              <div>
                <strong className="vx-wizard-option-label" style={{ display: 'block', fontSize: '0.9375rem', fontWeight: 700, color: TOKENS.text }}>{opt.label}</strong>
                <span className="vx-wizard-option-desc" style={{ fontSize: '0.8125rem', color: TOKENS.textSecondary }}>{opt.desc}</span>
              </div>
            </button>
          );
        })}
      </div>
      {value === 'clone' && (
        <div className="vx-wizard-clone-field" style={{ marginTop: 16 }}>
          <label className="vx-wizard-field-label" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: TOKENS.text, marginBottom: 6 }}>URL do site para clonar</label>
          <input
            type="text"
            className="vx-wizard-input"
            value={cloneUrl}
            onChange={(e) => onCloneUrlChange(e.target.value)}
            placeholder="https://exemplo.com"
            disabled={disabled}
            style={{
              width: '100%',
              padding: '0.625rem 0.875rem',
              borderRadius: TOKENS.radius,
              border: `1px solid ${TOKENS.border}`,
              background: TOKENS.surface,
              color: TOKENS.text,
              fontSize: '0.9375rem',
            }}
          />
          <p className="vx-wizard-field-hint" style={{ marginTop: 6, fontSize: '0.8125rem', color: TOKENS.textSecondary }}>
            A estrutura será importada e convertida em blocos editáveis no editor.
          </p>
        </div>
      )}
    </section>
  );
}

/* ---------- Etapa: Tipo ---------- */

interface TipoStepProps {
  value: SiteType;
  onChange: (v: SiteType) => void;
  disabled: boolean;
}

function TipoStep({ value, onChange, disabled }: TipoStepProps) {
  const types: Array<{ id: SiteType; label: string; desc: string; icon: React.ElementType }> = [
    { id: 'static', label: 'Estático', desc: 'Site institucional simples.', icon: Globe },
    { id: 'blog', label: 'Blog / Portal', desc: 'Posts automáticos e busca.', icon: Palette },
    { id: 'real-estate', label: 'Imobiliária', desc: 'Imóveis com filtros e visitas.', icon: Link },
    { id: 'ecommerce', label: 'E-commerce', desc: 'Loja completa com checkout.', icon: Rocket },
  ];

  return (
    <section className="vx-wizard-step-panel" style={{ padding: '1rem 0' }}>
      <header className="vx-wizard-step-head">
        <h3 className="vx-wizard-step-title">Que tipo de site?</h3>
        <p className="vx-wizard-step-sub">
          O tipo define os blocos e layouts disponíveis no editor.
        </p>
      </header>
      <div className="vx-wizard-options" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {types.map((t) => {
          const active = value === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              className={`vx-wizard-option ${active ? 'is-active' : ''} ${disabled ? 'is-disabled' : ''}`}
              aria-pressed={active}
              onClick={() => !disabled && onChange(t.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '0.75rem 1rem',
                borderRadius: TOKENS.radius,
                border: active ? `1px solid ${TOKENS.primary}` : `1px solid ${TOKENS.border}`,
                background: active ? `color-mix(in srgb, ${TOKENS.primary} 10%, transparent)` : TOKENS.surface,
                color: TOKENS.text,
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              <div className="vx-wizard-option-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '8px', background: active ? TOKENS.primary : TOKENS.surface, border: `1px solid ${active ? TOKENS.primary : TOKENS.border}` }}>
                <Icon size={16} aria-hidden="true" style={{ color: active ? 'var(--on-primary, var(--surface))' : TOKENS.textSecondary }} />
              </div>
              <div>
                <strong className="vx-wizard-option-label" style={{ display: 'block', fontSize: '0.9375rem', fontWeight: 700, color: TOKENS.text }}>{t.label}</strong>
                <span className="vx-wizard-option-desc" style={{ fontSize: '0.8125rem', color: TOKENS.textSecondary }}>{t.desc}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- Etapa: Tema ---------- */

interface TemaStepProps {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}

function TemaStep({ value, onChange, disabled }: TemaStepProps) {
  const themes: Array<{ id: string; label: string; color: string }> = [
    { id: 'default', label: 'Padrão (marca da empresa)', color: TOKENS.primary },
    { id: 'azul', label: 'Azul', color: 'var(--theme-azul, var(--primary))' },
    { id: 'amber', label: 'Âmbar', color: 'var(--theme-amber, var(--warn))' },
    { id: 'coral', label: 'Coral', color: 'var(--theme-coral, var(--bad))' },
    { id: 'mint', label: 'Menta', color: 'var(--theme-mint, var(--ok))' },
  ];

  return (
    <section className="vx-wizard-step-panel" style={{ padding: '1rem 0' }}>
      <header className="vx-wizard-step-head">
        <h3 className="vx-wizard-step-title">Escolha o tema</h3>
        <p className="vx-wizard-step-sub">
          A cor da marca vem da empresa; aqui você escolhe a variação visual.
        </p>
      </header>
      <div className="vx-wizard-themes" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
        {themes.map((t) => {
          const active = value === t.id;
          return (
            <button
              key={t.id}
              type="button"
              className={`vx-wizard-theme ${active ? 'is-active' : ''} ${disabled ? 'is-disabled' : ''}`}
              aria-pressed={active}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: '0.75rem',
                borderRadius: TOKENS.radius,
                border: active ? `2px solid ${t.color}` : `1px solid ${TOKENS.border}`,
                background: active ? `color-mix(in srgb, ${t.color} 10%, transparent)` : TOKENS.surface,
                color: TOKENS.text,
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
              onClick={() => !disabled && onChange(t.id)}
            >
              <span className="vx-wizard-theme-color" style={{ width: 32, height: 32, borderRadius: '8px', background: t.color, border: `1px solid ${TOKENS.border}` }} aria-hidden="true" />
              <span className="vx-wizard-theme-label" style={{ fontSize: '0.875rem', fontWeight: 600, color: TOKENS.text }}>{t.label}</span>
              {active && <CheckCircle2 size={14} style={{ color: TOKENS.ok }} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- Etapa: Domínio ---------- */

interface DominioStepProps {
  domain: string;
  onChange: (v: string) => void;
  onDomainValidated: () => void;
  disabled: boolean;
  siteSlug: string;
}

function DominioStep({ domain, onChange, onDomainValidated, disabled, siteSlug }: DominioStepProps) {
  return (
    <section className="vx-wizard-step-panel vx-wizard-step-dominio" style={{ padding: '1rem 0' }}>
      <header className="vx-wizard-step-head">
        <h3 className="vx-wizard-step-title">Domínio próprio</h3>
        <p className="vx-wizard-step-sub">
          Conecte o domínio do seu site. Deploy via Cloudflare (SSL incluso).
        </p>
      </header>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          type="text"
          className="vx-wizard-input"
          value={domain}
          onChange={(e) => onChange(e.target.value)}
          placeholder="seusite.com.br"
          disabled={disabled}
          style={{
            flex: 1,
            padding: '0.625rem 0.875rem',
            borderRadius: TOKENS.radius,
            border: `1px solid ${TOKENS.border}`,
            background: TOKENS.surface,
            color: TOKENS.text,
            fontSize: '0.9375rem',
          }}
        />
        <button
          type="button"
          className="vx-wizard-btn-primary"
          disabled={disabled || !domain.trim()}
          onClick={() => {
            onDomainValidated();
          }}
          style={{
            padding: '0.625rem 1.25rem',
            borderRadius: TOKENS.radius,
            border: 'none',
            background: TOKENS.primary,
            color: 'var(--on-primary, var(--surface))',
            cursor: (disabled || !domain.trim()) ? 'not-allowed' : 'pointer',
            fontWeight: 600,
          }}
        >
          Validar
        </button>
      </div>
      <p className="vx-wizard-field-hint" style={{ marginTop: 10, fontSize: '0.8125rem', color: TOKENS.textSecondary }}>
        Exemplo: {siteSlug || 'suaempresa'}.com.br. O deploy via Cloudflare será configurado no próximo passo.
      </p>
    </section>
  );
}

/* ---------- Etapa: Publicar ---------- */

interface PublicarStepProps {
  siteTitle: string;
  siteType: SiteType;
  domain: string;
  onFinish: () => void;
  busy: boolean;
  disabled: boolean;
}

function PublicarStep({ siteTitle, siteType, domain, onFinish, busy, disabled }: PublicarStepProps) {
  return (
    <section className="vx-wizard-step-panel vx-wizard-step-publicar" style={{ padding: '1rem 0' }}>
      <div className="vx-wizard-publicar-summary" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="vx-wizard-publicar-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: TOKENS.surface, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radius }}>
          <span className="vx-wizard-publicar-label" style={{ fontSize: '0.875rem', color: TOKENS.textSecondary }}>Título do site</span>
          <span className="vx-wizard-publicar-value" style={{ fontSize: '0.9375rem', fontWeight: 600, color: TOKENS.text }}>{siteTitle || '—'}</span>
        </div>
        <div className="vx-wizard-publicar-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: TOKENS.surface, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radius }}>
          <span className="vx-wizard-publicar-label" style={{ fontSize: '0.875rem', color: TOKENS.textSecondary }}>Tipo</span>
          <span className="vx-wizard-publicar-value" style={{ fontSize: '0.9375rem', fontWeight: 600, color: TOKENS.text }}>{siteType}</span>
        </div>
        <div className="vx-wizard-publicar-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: TOKENS.surface, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radius }}>
          <span className="vx-wizard-publicar-label" style={{ fontSize: '0.875rem', color: TOKENS.textSecondary }}>Domínio</span>
          <span className="vx-wizard-publicar-value" style={{ fontSize: '0.9375rem', fontWeight: 600, color: TOKENS.text }}>{domain || '— (subdomínio Véxora)'}</span>
        </div>
      </div>
      <div className="vx-wizard-publicar-notice" style={{ marginTop: 16, display: 'flex', alignItems: 'flex-start', gap: 10, padding: '1rem', background: `color-mix(in srgb, ${TOKENS.ok} 8%, transparent)`, border: `1px solid ${TOKENS.ok}`, borderRadius: TOKENS.radius }}>
        <AlertCircle size={16} style={{ color: TOKENS.ok, flexShrink: 0 }} aria-hidden="true" />
        <span style={{ fontSize: '0.875rem', color: TOKENS.text, lineHeight: 1.5 }}>
          O deploy será disparado via Cloudflare. O site estará acessível em alguns minutos.
        </span>
      </div>
    </section>
  );
}
