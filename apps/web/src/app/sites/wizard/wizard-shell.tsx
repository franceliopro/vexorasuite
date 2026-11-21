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
import { createPortal } from 'react-dom';
import './../editor/editor.css';
import {
  X,
  Maximize,
  Minimize,
  Minimize2,
  ChevronRight,
  ChevronLeft,
  Globe,
  Palette,
  Rocket,
  Cloud,
  Link,
  Code2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  Trash2,
} from 'lucide-react';

type WizardStep = 'origem' | 'tipo' | 'tema' | 'dominio' | 'publicar';

/**
 * O wizard abre em tela cheia. `window` é o modo reduzido (restaurar) e
 * `minimized` vira um dock; os três são controlados pelos botões do cabeçalho.
 */
type WizardMode = 'fullscreen' | 'window' | 'minimized';

type OrigemKind = 'zero' | 'clone' | 'html' | 'zip' | 'ia' | 'image';

type SiteType = 'static' | 'landing' | 'blog' | 'real-estate' | 'ecommerce';

const TYPE_LABEL: Record<SiteType, string> = {
  static: 'Site institucional',
  landing: 'Landing page',
  blog: 'Blog / portal',
  'real-estate': 'Imobiliária',
  ecommerce: 'E-commerce',
};

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
  onComplete: (site: { title: string; type: SiteType; domain?: string; logoUrl?: string; source: WizardSource }) => void;
  disabled?: boolean;
}

/** Origem informada ao chamador: ele decide qual endpoint de criação/importação usar. */
export type LayoutImageReference = {
  dataUrl: string;
  mimeType: string;
  fileName: string;
  width: number;
  height: number;
};

export type WizardSource =
  | { kind: 'zero' }
  | { kind: 'clone'; url: string }
  | { kind: 'html'; html: string }
  | { kind: 'zip'; fileName: string; contentBase64: string }
  | { kind: 'ia'; prompt: string; layoutImage?: LayoutImageReference }
  | { kind: 'image'; layoutImage: LayoutImageReference; prompt?: string };

const LAYOUT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const LAYOUT_IMAGE_MAX_SIDE = 1600;
const LAYOUT_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/** Reduz a captura no navegador para não enviar uma imagem grande sem necessidade. */
async function fileToLayoutImage(file: File): Promise<LayoutImageReference> {
  if (!LAYOUT_IMAGE_TYPES.includes(file.type)) throw new Error('Use uma imagem PNG, JPG ou WebP.');
  if (file.size > LAYOUT_IMAGE_MAX_BYTES) throw new Error('A imagem de layout deve ter até 8 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Não foi possível abrir a imagem de layout.'));
      image.src = url;
    });
    const sourceSide = Math.max(image.naturalWidth, image.naturalHeight);
    if (image.naturalWidth < 64 || image.naturalHeight < 64 || !sourceSide) {
      throw new Error('A imagem de layout deve ter pelo menos 64x64 pixels.');
    }
    const scale = Math.min(1, LAYOUT_IMAGE_MAX_SIDE / sourceSide);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Seu navegador não pôde preparar a imagem de layout.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return {
      dataUrl: canvas.toDataURL('image/jpeg', 0.82),
      mimeType: 'image/jpeg',
      fileName: file.name,
      width,
      height,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
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
  const [mode, setMode] = useState<WizardMode>('fullscreen');
  const [busy, setBusy] = useState(false);
  const [domainValidated, setDomainValidated] = useState(false);

  const [origem, setOrigem] = useState<OrigemKind>('zero');
  const [cloneUrl, setCloneUrl] = useState('');
  const [htmlInput, setHtmlInput] = useState('');
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState('');
  const [origemError, setOrigemError] = useState('');
  const [siteType, setSiteType] = useState<SiteType>('static');
  const [theme, setTheme] = useState('default');
  const [domain, setDomain] = useState('');
  const [siteTitle, setSiteTitle] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [layoutImage, setLayoutImage] = useState<LayoutImageReference | null>(null);
  const [layoutImageError, setLayoutImageError] = useState('');
  const [readingLayoutImage, setReadingLayoutImage] = useState(false);

  const currentIndex = STEP_ORDER.indexOf(step);
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === STEP_ORDER.length - 1;
  const cloneLooksValid = /^https?:\/\/[^\s/]+\.[^\s/]+/i.test(cloneUrl.trim());
  const canNext =
    currentIndex < STEP_ORDER.length - 1 &&
    (step !== 'origem' ||
      origem === 'zero' ||
      (origem === 'ia' && (prompt.trim().length >= 3 || layoutImage !== null)) ||
      (origem === 'image' && layoutImage !== null) ||
      (origem === 'clone' && cloneLooksValid) ||
      (origem === 'html' && htmlInput.trim().length >= 10) ||
      (origem === 'zip' && zipFile !== null)) &&
    (step !== 'tipo' || siteTitle.trim().length >= 2) &&
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

  const handleLayoutImageChange = useCallback(async (file: File | null) => {
    setLayoutImageError('');
    if (!file) {
      setLayoutImage(null);
      return;
    }
    setReadingLayoutImage(true);
    try {
      setLayoutImage(await fileToLayoutImage(file));
    } catch (cause) {
      setLayoutImage(null);
      setLayoutImageError(cause instanceof Error ? cause.message : 'Não foi possível preparar a imagem de layout.');
    } finally {
      setReadingLayoutImage(false);
    }
  }, []);

  const handleMinimize = useCallback(() => {
    setMode('minimized');
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    setMode((current) => (current === 'fullscreen' ? 'window' : 'fullscreen'));
  }, []);

  const handleFinish = useCallback(async () => {
    if (siteTitle.trim().length < 2) return;
    if (origem === 'ia' && prompt.trim().length < 3 && !layoutImage) {
      setStep('origem');
      setOrigemError('Descreva a ideia ou envie uma imagem de layout para continuar.');
      return;
    }
    if (origem === 'image' && !layoutImage) {
      setStep('origem');
      setOrigemError('Envie a imagem do layout para recriar a estrutura do site.');
      return;
    }
    setBusy(true);
    setOrigemError('');
    try {
      let source: WizardSource = { kind: 'zero' };
      if (origem === 'clone') source = { kind: 'clone', url: cloneUrl.trim() };
      if (origem === 'html') source = { kind: 'html', html: htmlInput.trim() };
      if (origem === 'ia') source = { kind: 'ia', prompt: prompt.trim(), layoutImage: layoutImage ?? undefined };
      if (origem === 'image' && layoutImage) {
        source = { kind: 'image', layoutImage, ...(prompt.trim() ? { prompt: prompt.trim() } : {}) };
      }
      if (origem === 'zip') {
        if (!zipFile) throw new Error('Selecione o arquivo ZIP para continuar.');
        source = { kind: 'zip', fileName: zipFile.name, contentBase64: await fileToBase64(zipFile) };
      }
      onComplete({
        title: siteTitle.trim(),
        type: siteType,
        domain: domain || undefined,
        logoUrl: logoUrl.trim() || undefined,
        source,
      });
    } catch (cause) {
      setOrigemError(cause instanceof Error ? cause.message : 'Não foi possível preparar a importação.');
    } finally {
      setBusy(false);
    }
  }, [siteTitle, siteType, domain, logoUrl, onComplete, origem, cloneUrl, htmlInput, zipFile, prompt, layoutImage]);

  if (!open) return null;

  const isMinimized = mode === 'minimized';
  const isFullscreen = mode === 'fullscreen';

  /**
   * Portal para `document.body`: o workspace aplica `animation: vx-page-in ... both`
   * em `.page-content > *`, e o `transform` resultante vira containing block de
   * `position: fixed`. Sem o portal o wizard fica preso ao cartão do workspace
   * (784x307 em vez do viewport inteiro) e a área das opções tem só ~94px.
   */
  const content = isMinimized ? (
    <div className="vx-wizard-dock" role="region" aria-label="Assistente de criação de site minimizado">
      <button
        type="button"
        className="vx-wizard-dock-btn"
        onClick={() => setMode('fullscreen')}
        title="Restaurar assistente em tela cheia"
      >
        <Globe size={16} aria-hidden="true" />
        <span>Criar site — {STEP_LABELS[step]}</span>
      </button>
      <button
        type="button"
        className="vx-wizard-dock-close"
        onClick={onClose}
        aria-label="Fechar assistente"
        title="Fechar assistente"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  ) : (
    <div
      className={`vx-wizard vx-wizard--${mode}`}
      role="dialog"
      aria-modal="true"
      aria-label="Assistente de criação de site"
    >
      <header className="vx-wizard-header">
        <div className="vx-wizard-header-left">
          <button
            type="button"
            className="vx-wizard-btn"
            aria-label="Minimizar assistente"
            title="Minimizar"
            onClick={handleMinimize}
          >
            <Minimize size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="vx-wizard-btn"
            aria-label={isFullscreen ? 'Restaurar janela' : 'Tela cheia'}
            title={isFullscreen ? 'Restaurar janela' : 'Tela cheia'}
            onClick={handleToggleFullscreen}
          >
            {isFullscreen ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize size={16} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="vx-wizard-btn vx-wizard-btn--close"
            aria-label="Fechar assistente"
            title="Fechar assistente"
            onClick={onClose}
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
          const StepIcon = STEP_ICONS[s];
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
                <span className="vx-wizard-step-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <StepIcon size={13} aria-hidden="true" />
                  {STEP_LABELS[s]}
                </span>
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

      <div className="vx-wizard-body">
        {step === 'origem' && (
          <OrigemStep
            value={origem}
            onChange={setOrigem}
            cloneUrl={cloneUrl}
            onCloneUrlChange={setCloneUrl}
            htmlInput={htmlInput}
            onHtmlInputChange={setHtmlInput}
            onZipFileChange={setZipFile}
            prompt={prompt}
            onPromptChange={setPrompt}
            layoutImage={layoutImage}
            onLayoutImageChange={(file) => void handleLayoutImageChange(file)}
            layoutImageError={layoutImageError}
            readingLayoutImage={readingLayoutImage}
            disabled={disabled}
          />
        )}
        {step === 'tipo' && (
          <TipoStep
            value={siteType}
            onChange={setSiteType}
            title={siteTitle}
            onTitleChange={setSiteTitle}
            logoUrl={logoUrl}
            onLogoUrlChange={setLogoUrl}
            disabled={disabled}
          />
        )}
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
          <PublicarStep siteTitle={siteTitle} siteType={siteType} domain={domain} layoutImage={layoutImage} />
        )}
        {origemError ? <p role="alert" style={{ color: TOKENS.bad, fontSize: '0.875rem', marginTop: 12 }}>{origemError}</p> : null}
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
            disabled={disabled || busy}
            onClick={() => void handleFinish()}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: TOKENS.radius,
              border: 'none',
              background: (disabled || busy) ? TOKENS.border : TOKENS.primary,
              color: (disabled || busy) ? TOKENS.textSecondary : 'var(--on-primary, var(--surface))',
              cursor: (disabled || busy) ? 'not-allowed' : 'pointer',
              fontWeight: 600,
            }}
          >
            {busy ? (
              <>
                <Loader2 size={15} className="animate-spin" aria-hidden="true" style={{ marginRight: 6 }} />
                Criando…
              </>
            ) : (
              <>
                <Rocket size={15} aria-hidden="true" style={{ marginRight: 6 }} />
                Criar site
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            className="vx-wizard-btn-primary"
            disabled={disabled || busy || !canNext}
            onClick={handleNext}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: TOKENS.radius,
              border: 'none',
              background: (disabled || busy || !canNext) ? TOKENS.border : TOKENS.primary,
              color: (disabled || busy || !canNext) ? TOKENS.textSecondary : 'var(--on-primary, var(--surface))',
              cursor: (disabled || busy || !canNext) ? 'not-allowed' : 'pointer',
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

  return typeof document === 'undefined' ? null : createPortal(content, document.body);
}

/* ---------- Etapa: Origem ---------- */

interface OrigemStepProps {
  value: OrigemKind;
  onChange: (v: OrigemKind) => void;
  cloneUrl: string;
  onCloneUrlChange: (v: string) => void;
  htmlInput: string;
  onHtmlInputChange: (v: string) => void;
  onZipFileChange: (v: File | null) => void;
  prompt: string;
  onPromptChange: (v: string) => void;
  layoutImage: LayoutImageReference | null;
  onLayoutImageChange: (file: File | null) => void;
  layoutImageError: string;
  readingLayoutImage: boolean;
  disabled: boolean;
}

function OrigemStep({
  value,
  onChange,
  cloneUrl,
  onCloneUrlChange,
  htmlInput,
  onHtmlInputChange,
  onZipFileChange,
  prompt,
  onPromptChange,
  layoutImage,
  onLayoutImageChange,
  layoutImageError,
  readingLayoutImage,
  disabled,
}: OrigemStepProps) {
  const options: Array<{ id: OrigemKind; label: string; desc: string; icon: React.ElementType }> = [
    { id: 'zero', label: 'Do zero', desc: 'Comece com uma página em branco.', icon: Palette },
    { id: 'image', label: 'Upload de imagem', desc: 'Envie uma captura do layout e recrie a estrutura do site.', icon: ImageIcon },
    { id: 'clone', label: 'Clonar link', desc: 'Importe a estrutura de um site público.', icon: Link },
    { id: 'html', label: 'Colar HTML', desc: 'Traga o código de uma página existente.', icon: Code2 },
    { id: 'zip', label: 'Importar ZIP', desc: 'Pacote Elementor, Divi, Beaver ou Crocoblock.', icon: Cloud },
    { id: 'ia', label: 'Criar com IA', desc: 'Descreva a ideia e/ou envie uma imagem de layout como referência.', icon: Rocket },
  ];
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: 600, color: TOKENS.text, marginBottom: 6 };
  const fieldStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.625rem 0.875rem',
    borderRadius: TOKENS.radius,
    border: `1px solid ${TOKENS.border}`,
    background: TOKENS.surface,
    color: TOKENS.text,
    fontSize: '0.9375rem',
  };
  const hintStyle: React.CSSProperties = { marginTop: 6, fontSize: '0.8125rem', color: TOKENS.textSecondary };
  const usesLayoutImage = value === 'ia' || value === 'image';

  return (
    <section className="vx-wizard-step-panel">
      <header className="vx-wizard-step-head">
        <h3 className="vx-wizard-step-title">Como você quer começar?</h3>
        <p className="vx-wizard-step-sub">
          Escolha a origem do site. Você poderá editar tudo no editor depois.
        </p>
      </header>
      <div className="vx-wizard-options">
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
            >
              <div className="vx-wizard-option-icon">
                <Icon size={18} aria-hidden="true" />
              </div>
              <div className="vx-wizard-option-text">
                <strong className="vx-wizard-option-label">{opt.label}</strong>
                <span className="vx-wizard-option-desc">{opt.desc}</span>
              </div>
            </button>
          );
        })}
      </div>
      {value !== 'zero' && (
        <div className="vx-wizard-clone-field" style={{ marginTop: 16 }}>
          {value === 'clone' && (
            <>
              <label className="vx-wizard-field-label" style={labelStyle}>URL do site para clonar</label>
              <input
                type="url"
                className="vx-wizard-input"
                value={cloneUrl}
                onChange={(e) => onCloneUrlChange(e.target.value)}
                placeholder="https://exemplo.com"
                disabled={disabled}
                style={fieldStyle}
              />
              <p className="vx-wizard-field-hint" style={hintStyle}>
                Buscamos o HTML público e convertemos títulos, textos, imagens, links e vídeos em blocos editáveis.
              </p>
            </>
          )}
          {value === 'html' && (
            <>
              <label className="vx-wizard-field-label" style={labelStyle}>Cole o HTML da página</label>
              <textarea
                className="vx-wizard-input"
                value={htmlInput}
                onChange={(e) => onHtmlInputChange(e.target.value)}
                placeholder={'<h1>Minha empresa</h1>\n<p>Conteúdo da página...</p>'}
                rows={7}
                disabled={disabled}
                style={{ ...fieldStyle, fontFamily: 'ui-monospace, monospace', resize: 'vertical' }}
              />
              <p className="vx-wizard-field-hint" style={hintStyle}>
                Scripts, eventos e links não seguros são descartados. Revise os blocos no editor depois.
              </p>
            </>
          )}
          {value === 'zip' && (
            <>
              <label className="vx-wizard-field-label" style={labelStyle}>Arquivo ZIP (até 15 MB)</label>
              <input
                type="file"
                accept=".zip,application/zip"
                onChange={(e) => onZipFileChange(e.target.files?.[0] ?? null)}
                disabled={disabled}
                style={{ ...fieldStyle, padding: '0.5rem' }}
              />
              <p className="vx-wizard-field-hint" style={hintStyle}>
                Lemos HTML e JSON de Elementor, Divi, Beaver Builder e Crocoblock. CSS/JS não são executados e imagens locais precisam de URL pública.
              </p>
            </>
          )}
          {usesLayoutImage && (
            <>
              <label className="vx-wizard-field-label" style={labelStyle}>
                {value === 'image' ? 'Descreva o site (opcional)' : 'Descreva a ideia (opcional se houver imagem)'}
              </label>
              <textarea
                className="vx-wizard-input"
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
                placeholder="Ex.: site para uma clínica veterinária com contato e horários"
                rows={4}
                disabled={disabled}
                style={{ ...fieldStyle, resize: 'vertical' }}
              />
              <div className="vx-wizard-layout-upload" style={{ marginTop: 14 }}>
                <label className="vx-wizard-field-label" htmlFor="vx-wizard-layout-image" style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ImageIcon size={14} aria-hidden="true" />
                  {value === 'image' ? 'Imagem do layout (obrigatória)' : 'Imagem de layout (opcional)'}
                </label>
                <input
                  id="vx-wizard-layout-image"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  aria-required={value === 'image'}
                  onChange={(e) => {
                    onLayoutImageChange(e.target.files?.[0] ?? null);
                    e.target.value = '';
                  }}
                  disabled={disabled || readingLayoutImage}
                  style={{ ...fieldStyle, padding: '0.5rem' }}
                />
                {readingLayoutImage ? (
                  <p className="vx-wizard-field-hint" style={hintStyle}>Preparando a imagem…</p>
                ) : null}
                {layoutImageError ? (
                  <p role="alert" style={{ color: TOKENS.bad, fontSize: '0.8125rem', marginTop: 6 }}>{layoutImageError}</p>
                ) : null}
                {layoutImage ? (
                  <div className="vx-wizard-layout-preview">
                    <img src={layoutImage.dataUrl} alt="Prévia da imagem de layout enviada" />
                    <div className="vx-wizard-layout-preview-meta">
                      <strong>{layoutImage.fileName}</strong>
                      <span>{layoutImage.width} × {layoutImage.height} px</span>
                    </div>
                    <button
                      type="button"
                      className="vx-wizard-btn"
                      aria-label="Remover imagem de layout"
                      title="Remover imagem de layout"
                      disabled={disabled}
                      onClick={() => onLayoutImageChange(null)}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                ) : null}
                <p className="vx-wizard-field-hint" style={hintStyle}>
                  {value === 'image'
                    ? 'A imagem recria a estrutura do rascunho: ordem das seções, hierarquia, densidade e paleta. Textos, marca, fotos e dados da captura não são copiados. Sem modelo de visão configurado, usamos regras determinísticas e avisamos.'
                    : 'Envie uma captura do layout que você gosta. A IA usa a imagem para sugerir a estrutura (seções, hierarquia e densidade); textos, marca e ativos não são copiados. Se não houver modelo com visão configurado, criamos o rascunho com o template padrão e avisamos.'}
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

/* ---------- Etapa: Tipo ---------- */

interface TipoStepProps {
  value: SiteType;
  onChange: (v: SiteType) => void;
  title: string;
  onTitleChange: (v: string) => void;
  logoUrl: string;
  onLogoUrlChange: (v: string) => void;
  disabled: boolean;
}

function TipoStep({ value, onChange, title, onTitleChange, logoUrl, onLogoUrlChange, disabled }: TipoStepProps) {
  const types: Array<{ id: SiteType; label: string; desc: string; icon: React.ElementType }> = [
    { id: 'static', label: 'Estático', desc: 'Site institucional simples.', icon: Globe },
    { id: 'landing', label: 'Landing page', desc: 'Uma página focada em converter visitantes em contatos.', icon: CheckCircle2 },
    { id: 'blog', label: 'Blog / Portal', desc: 'Posts automáticos e busca.', icon: Palette },
    { id: 'real-estate', label: 'Imobiliária', desc: 'Imóveis com filtros e visitas.', icon: Link },
    { id: 'ecommerce', label: 'E-commerce', desc: 'Loja completa com checkout.', icon: Rocket },
  ];

  return (
    <section className="vx-wizard-step-panel">
      <header className="vx-wizard-step-head">
        <h3 className="vx-wizard-step-title">Que tipo de site?</h3>
        <p className="vx-wizard-step-sub">
          Dê um nome ao site e escolha o tipo. O nome aparece no painel e no editor.
        </p>
        <label style={{ display: 'block', marginTop: 12 }}>
          <span style={{ display: 'block', fontSize: '0.8125rem', color: TOKENS.textSecondary, marginBottom: 4 }}>
            Nome do site
          </span>
          <input
            type="text"
            value={title}
            maxLength={100}
            disabled={disabled}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="Ex.: Site da Minha Empresa"
            aria-label="Nome do site"
            style={{
              width: '100%',
              padding: '0.65rem 0.75rem',
              borderRadius: TOKENS.radius,
              border: `1px solid ${TOKENS.border}`,
              background: TOKENS.surface,
              color: TOKENS.text,
              fontSize: '0.9375rem',
            }}
          />
        </label>
        <label style={{ display: 'block', marginTop: 12 }}>
          <span style={{ display: 'block', fontSize: '0.8125rem', color: TOKENS.textSecondary, marginBottom: 4 }}>
            URL do logotipo (opcional)
          </span>
          <input
            type="url"
            value={logoUrl}
            maxLength={500}
            disabled={disabled}
            onChange={(event) => onLogoUrlChange(event.target.value)}
            placeholder="https://seusite.com.br/logo.png"
            aria-label="URL do logotipo"
            style={{
              width: '100%',
              padding: '0.65rem 0.75rem',
              borderRadius: TOKENS.radius,
              border: `1px solid ${TOKENS.border}`,
              background: TOKENS.surface,
              color: TOKENS.text,
              fontSize: '0.9375rem',
            }}
          />
          <small style={{ display: 'block', marginTop: 4, color: TOKENS.textSecondary, fontSize: '0.75rem' }}>
            Se deixar em branco, criamos um logotipo provisório. O wizard também gera ilustrações editáveis, marcadas como rascunho, para você trocar por fotos reais antes de publicar.
          </small>
        </label>
      </header>
      <div className="vx-wizard-options">
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
            >
              <div className="vx-wizard-option-icon">
                <Icon size={18} aria-hidden="true" />
              </div>
              <div className="vx-wizard-option-text">
                <strong className="vx-wizard-option-label">{t.label}</strong>
                <span className="vx-wizard-option-desc">{t.desc}</span>
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
    <section className="vx-wizard-step-panel">
      <header className="vx-wizard-step-head">
        <h3 className="vx-wizard-step-title">Escolha o tema</h3>
        <p className="vx-wizard-step-sub">
          A cor da marca vem da empresa; aqui você escolhe a variação visual.
        </p>
      </header>
      <div className="vx-wizard-themes">
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
    <section className="vx-wizard-step-panel vx-wizard-step-dominio">
      <header className="vx-wizard-step-head">
        <h3 className="vx-wizard-step-title">Domínio próprio</h3>
        <p className="vx-wizard-step-sub">
          Informe o domínio que pretende usar. Você poderá vinculá-lo e validá-lo no editor antes de publicar.
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
        Exemplo: {siteSlug || 'suaempresa'}.com.br. A vinculação e a validação acontecem no editor.
      </p>
    </section>
  );
}

/* ---------- Etapa: Publicar ---------- */

interface PublicarStepProps {
  siteTitle: string;
  siteType: SiteType;
  domain: string;
  layoutImage: LayoutImageReference | null;
}

function PublicarStep({ siteTitle, siteType, domain, layoutImage }: PublicarStepProps) {
  return (
    <section className="vx-wizard-step-panel vx-wizard-step-publicar">
      <div className="vx-wizard-publicar-summary" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="vx-wizard-publicar-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: TOKENS.surface, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radius }}>
          <span className="vx-wizard-publicar-label" style={{ fontSize: '0.875rem', color: TOKENS.textSecondary }}>Título do site</span>
          <span className="vx-wizard-publicar-value" style={{ fontSize: '0.9375rem', fontWeight: 600, color: TOKENS.text }}>{siteTitle || '—'}</span>
        </div>
        <div className="vx-wizard-publicar-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: TOKENS.surface, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radius }}>
          <span className="vx-wizard-publicar-label" style={{ fontSize: '0.875rem', color: TOKENS.textSecondary }}>Tipo</span>
          <span className="vx-wizard-publicar-value" style={{ fontSize: '0.9375rem', fontWeight: 600, color: TOKENS.text }}>{TYPE_LABEL[siteType]}</span>
        </div>
        <div className="vx-wizard-publicar-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: TOKENS.surface, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radius }}>
          <span className="vx-wizard-publicar-label" style={{ fontSize: '0.875rem', color: TOKENS.textSecondary }}>Referência de layout</span>
          <span className="vx-wizard-publicar-value" style={{ fontSize: '0.9375rem', fontWeight: 600, color: TOKENS.text }}>
            {layoutImage ? `Imagem enviada (${layoutImage.width}×${layoutImage.height})` : '— (somente descrição)'}
          </span>
        </div>
        <div className="vx-wizard-publicar-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: TOKENS.surface, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radius }}>
          <span className="vx-wizard-publicar-label" style={{ fontSize: '0.875rem', color: TOKENS.textSecondary }}>Domínio</span>
          <span className="vx-wizard-publicar-value" style={{ fontSize: '0.9375rem', fontWeight: 600, color: TOKENS.text }}>{domain || '— (subdomínio Véxora)'}</span>
        </div>
      </div>
      <div className="vx-wizard-publicar-notice" style={{ marginTop: 16, display: 'flex', alignItems: 'flex-start', gap: 10, padding: '1rem', background: `color-mix(in srgb, ${TOKENS.ok} 8%, transparent)`, border: `1px solid ${TOKENS.ok}`, borderRadius: TOKENS.radius }}>
        <AlertCircle size={16} style={{ color: TOKENS.ok, flexShrink: 0 }} aria-hidden="true" />
        <span style={{ fontSize: '0.875rem', color: TOKENS.text, lineHeight: 1.5 }}>
          O site será criado como rascunho. No editor você ajusta as páginas, vincula o domínio e publica.
        </span>
      </div>
    </section>
  );
}
