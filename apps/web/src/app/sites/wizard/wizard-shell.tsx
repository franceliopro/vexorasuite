'use client';

/**
 * Véxora Sites — Wizard base: janela não-modal em tela cheia com minimizar/restaurar/fechar.
 * Etapas: Origem → Tipo → Tema → Domínio → Publicar.
 * Minimizar reduz a um dock flutuante inferior sem perder o estado.
 * Leigos veem poucos botões; opções avançadas ficam no editor.
 * Utilities do preset Tailwind; ícones lucide-react. Cores vêm dos tokens
 * de tema (o escuro é slate real), sem hex direto ou valores arbitrários.
 *
 * Pontos de integração com o programador:
 *  - onComplete: chamado ao concluir com { title, type, domain? }
 *  - Domínio: etapa reutiliza a configuração de domínio (endpoint TODO do backend)
 */

import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import './../editor/editor.css';
import { LAYOUT_IMAGE_INPUT_ID } from '../editor/contracts';
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

/**
 * Classes completas do preset. Estados usam mapas `Record` com a string final
 * (nada de concatenar fragmentos), para o guard conseguir verificar cada variante.
 */
const WIZARD_FULLSCREEN_TW = 'fixed inset-0 flex min-h-0 flex-col bg-zinc-50 font-ui text-slate-950';
const WIZARD_WINDOW_TW = 'fixed left-1/2 top-1/2 flex min-h-0 -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-token border border-gray-200 bg-zinc-50 font-ui text-slate-950 shadow-token-lg';
const DOCK_TW = 'fixed bottom-6 left-1/2 flex -translate-x-1/2 gap-2';
const DOCK_BUTTON_TW = 'inline-flex items-center gap-1.5 rounded-token bg-blue-600 px-4 py-2 text-sm font-bold text-blue-950 transition-colors hover:bg-blue-700';
const DOCK_CLOSE_TW = 'inline-flex size-9 items-center justify-center rounded-token border border-gray-200 bg-zinc-100 text-slate-950 transition-colors hover:bg-hover';
const HEADER_TW = 'flex shrink-0 items-center justify-between border-b border-gray-200 bg-zinc-100 px-4 py-3';
const HEADER_LEFT_TW = 'flex items-center gap-2';
const HEADER_CENTER_TW = 'min-w-0';
const TITLE_TW = 'm-0 text-lg font-bold text-slate-950';
const SUB_TW = 'm-0 text-sm text-slate-600';
const ICON_BUTTON_TW = 'inline-flex size-9 shrink-0 items-center justify-center rounded-token-sm border border-gray-200 bg-zinc-100 text-slate-600 transition-colors hover:bg-hover hover:text-slate-950';
const ICON_BUTTON_CLOSE_TW = 'inline-flex size-9 shrink-0 items-center justify-center rounded-token-sm border border-gray-200 bg-zinc-100 text-slate-600 transition-colors hover:border-red-600 hover:bg-red-600 hover:text-blue-950';
const PROGRESS_TW = 'flex shrink-0 gap-1.5 overflow-x-auto border-b border-gray-200 bg-zinc-100 px-4 py-3';
const STEP_ITEM_TW = 'flex items-center gap-1.5';
const STEP_LABEL_TW = 'inline-flex items-center gap-1.5';
const BODY_TW = 'min-h-0 flex-1 overflow-y-auto overscroll-contain bg-zinc-50 px-4 pb-8 pt-7 sm:px-6 md:px-10 lg:px-12';
const PANEL_TW = 'mx-auto w-full';
const FOOTER_TW = 'flex shrink-0 items-center justify-between border-t border-gray-200 bg-zinc-100 px-4 py-3';

type StepState = 'current' | 'done' | 'pending';

const STEP_STATE_TW: Record<StepState, string> = {
  current: 'inline-flex items-center gap-1.5 rounded-token-sm bg-blue-600 px-2.5 py-1 text-sm font-semibold text-blue-950 transition-colors disabled:cursor-not-allowed disabled:opacity-50',
  done: 'inline-flex items-center gap-1.5 rounded-token-sm bg-emerald-100 px-2.5 py-1 text-sm font-semibold text-emerald-600 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50',
  pending: 'inline-flex items-center gap-1.5 rounded-token-sm bg-transparent px-2.5 py-1 text-sm font-semibold text-slate-600 transition-colors disabled:cursor-not-allowed disabled:opacity-50',
};

const STEP_BADGE_STATE_TW: Record<StepState, string> = {
  current: 'inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-blue-600 bg-blue-950 text-xs font-bold text-blue-600',
  done: 'inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-emerald-600 bg-emerald-600 text-xs font-bold text-blue-950',
  pending: 'inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-zinc-100 text-xs font-bold text-slate-600',
};

const CONNECTOR_STATE_TW: Record<'done' | 'pending', string> = {
  done: 'size-1.5 shrink-0 rounded-full bg-emerald-600',
  pending: 'size-1.5 shrink-0 rounded-full bg-gray-200',
};

const PRIMARY_TW = 'inline-flex min-h-control items-center justify-center gap-1.5 rounded-token bg-blue-600 px-5 py-2 text-sm font-bold text-blue-950 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60';
const PRIMARY_DISABLED_TW = 'inline-flex min-h-control cursor-not-allowed items-center justify-center gap-1.5 rounded-token bg-gray-200 px-5 py-2 text-sm font-bold text-slate-600 opacity-60';
const SECONDARY_TW = 'inline-flex min-h-control items-center justify-center gap-1.5 rounded-token border border-gray-200 bg-zinc-100 px-4 py-2 text-sm font-bold text-slate-950 transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60';

const STEP_HEAD_TW = 'mb-6';
const STEP_TITLE_TW = 'mb-2 text-2xl font-heading leading-tight text-slate-950';
const STEP_SUB_TW = 'max-w-xl text-base leading-normal text-slate-600';
const OPTIONS_TW = 'grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3';
const OPTION_TEXT_TW = 'flex min-w-0 flex-col gap-0.5';
const OPTION_LABEL_TW = 'block text-base font-bold text-slate-950';
const OPTION_DESC_TW = 'text-sm leading-snug text-slate-600';
const FIELD_LABEL_TW = 'mb-1.5 block text-sm font-bold text-slate-950';
const INLINE_FIELD_LABEL_TW = 'mb-1.5 flex items-center gap-1.5 text-sm font-bold text-slate-950';
const FIELD_HINT_TW = 'mt-1.5 text-xs text-slate-600';
const INPUT_TW = 'w-full rounded-token-sm border border-gray-200 bg-zinc-100 px-3.5 py-2.5 text-sm text-slate-950 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:opacity-50';
const TEXTAREA_TW = 'w-full resize-y rounded-token-sm border border-gray-200 bg-zinc-100 px-3.5 py-2.5 text-sm text-slate-950 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:opacity-50';
const CODE_TEXTAREA_TW = 'w-full resize-y rounded-token-sm border border-gray-200 bg-zinc-100 px-3.5 py-2.5 font-mono text-sm text-slate-950 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:opacity-50';
const FILE_INPUT_TW = 'w-full rounded-token-sm border border-gray-200 bg-zinc-100 p-2 text-sm text-slate-950 disabled:cursor-not-allowed disabled:opacity-50';
const CLONE_FIELD_TW = 'mt-4';
const LAYOUT_UPLOAD_TW = 'mt-3.5 rounded-token-sm border border-gray-200 bg-zinc-200 p-3.5';
const LAYOUT_PREVIEW_TW = 'mt-2.5 flex items-center gap-2.5 rounded-token-sm border border-gray-200 bg-zinc-100 p-2';
const LAYOUT_PREVIEW_IMG_TW = 'h-14 w-20 rounded-md border border-gray-200 bg-zinc-200 object-cover';
const LAYOUT_PREVIEW_META_TW = 'flex min-w-0 flex-1 flex-col gap-0.5';
const LAYOUT_PREVIEW_NAME_TW = 'truncate text-xs text-slate-950';
const LAYOUT_PREVIEW_SIZE_TW = 'text-xs text-slate-600';
const NAMED_LABEL_TW = 'mt-3 block';
const NAMED_LABEL_HINT_TW = 'mb-1 block text-xs text-slate-600';
const NAMED_INPUT_TW = 'w-full rounded-token-sm border border-gray-200 bg-zinc-100 px-3 py-2.5 text-sm text-slate-950 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:opacity-50';
const NAMED_HELP_TW = 'mt-1 block text-xs text-slate-600';
const THEMES_TW = 'grid grid-cols-2 gap-3.5 md:grid-cols-3 lg:grid-cols-5';
const THEME_COLOR_TW = 'size-8 rounded-lg border border-gray-200';
const THEME_LABEL_TW = 'text-sm font-semibold text-slate-950';
const THEME_CHECK_TW = 'text-emerald-600';
const DOMAIN_ROW_TW = 'flex items-center gap-2.5';
const DOMAIN_INPUT_TW = 'min-w-0 flex-1 rounded-token-sm border border-gray-200 bg-zinc-100 px-3.5 py-2.5 text-sm text-slate-950 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:opacity-50';
const DOMAIN_HINT_TW = 'mt-2.5 text-xs text-slate-600';
const PUBLISH_SUMMARY_TW = 'flex flex-col gap-2.5';
const PUBLISH_ITEM_TW = 'flex items-center justify-between rounded-token-sm border border-gray-200 bg-zinc-100 p-3';
const PUBLISH_LABEL_TW = 'text-sm text-slate-600';
const PUBLISH_VALUE_TW = 'text-sm font-semibold text-slate-950';
const PUBLISH_NOTICE_TW = 'mt-4 flex items-start gap-2.5 rounded-token-sm border border-emerald-600 bg-emerald-100 p-4';
const PUBLISH_NOTICE_ICON_TW = 'mt-0.5 shrink-0 text-emerald-600';
const PUBLISH_NOTICE_TEXT_TW = 'text-sm leading-normal text-slate-950';
const FORM_ERROR_TW = 'mt-3 text-sm text-red-600';
const IMAGE_ERROR_TW = 'mt-1.5 text-xs text-red-600';

type OptionState = 'active' | 'idle' | 'disabled';

const OPTION_STATE_TW: Record<OptionState, string> = {
  active: 'flex min-h-20 items-center gap-3.5 rounded-token-sm border border-blue-600 bg-blue-50 p-5 text-left text-base text-slate-950 transition-colors',
  idle: 'flex min-h-20 items-center gap-3.5 rounded-token-sm border border-gray-200 bg-zinc-100 p-5 text-left text-base text-slate-950 transition-colors hover:border-blue-600 hover:bg-blue-50',
  disabled: 'flex min-h-20 cursor-not-allowed items-center gap-3.5 rounded-token-sm border border-gray-200 bg-zinc-100 p-5 text-left text-base text-slate-950 opacity-50',
};

const OPTION_ICON_STATE_TW: Record<OptionState, string> = {
  active: 'inline-flex size-11 shrink-0 items-center justify-center rounded-token-sm border border-blue-600 bg-blue-600 text-blue-950',
  idle: 'inline-flex size-11 shrink-0 items-center justify-center rounded-token-sm border border-gray-200 bg-zinc-100 text-slate-600',
  disabled: 'inline-flex size-11 shrink-0 items-center justify-center rounded-token-sm border border-gray-200 bg-zinc-100 text-slate-600 opacity-50',
};

const THEME_STATE_TW: Record<OptionState, string> = {
  active: 'flex flex-col items-center gap-2 rounded-token-sm border-2 bg-blue-50 p-3 text-slate-950 transition-colors',
  idle: 'flex flex-col items-center gap-2 rounded-token-sm border border-gray-200 bg-zinc-100 p-3 text-slate-950 transition-colors hover:border-blue-600',
  disabled: 'flex cursor-not-allowed flex-col items-center gap-2 rounded-token-sm border border-gray-200 bg-zinc-100 p-3 text-slate-950 opacity-50 transition-colors',
};

/** A camada do wizard não tem utility no preset: vem do token legado de z-index. */
const WIZARD_FRAME_STYLE: React.CSSProperties = { zIndex: 'var(--z-fullscreen-window, 10000)' };
const WIZARD_WINDOW_STYLE: React.CSSProperties = {
  width: 'min(1080px, calc(100vw - 48px))',
  height: 'min(760px, calc(100dvh - 48px))',
};
const DOCK_STYLE: React.CSSProperties = { zIndex: 'var(--z-fullscreen-dock, 10001)' };
const PANEL_STYLE: React.CSSProperties = { maxWidth: 1040 };

function stepStateTw(isDone: boolean, isCurrent: boolean): string {
  return isCurrent ? STEP_STATE_TW.current : isDone ? STEP_STATE_TW.done : STEP_STATE_TW.pending;
}

function badgeStateTw(isDone: boolean, isCurrent: boolean): string {
  return isCurrent ? STEP_BADGE_STATE_TW.current : isDone ? STEP_BADGE_STATE_TW.done : STEP_BADGE_STATE_TW.pending;
}

function connectorStateTw(isDone: boolean): string {
  return isDone ? CONNECTOR_STATE_TW.done : CONNECTOR_STATE_TW.pending;
}

function optionStateTw(active: boolean, disabled: boolean): string {
  return disabled ? OPTION_STATE_TW.disabled : active ? OPTION_STATE_TW.active : OPTION_STATE_TW.idle;
}

function optionIconStateTw(active: boolean, disabled: boolean): string {
  return disabled ? OPTION_ICON_STATE_TW.disabled : active ? OPTION_ICON_STATE_TW.active : OPTION_ICON_STATE_TW.idle;
}

function themeStateTw(active: boolean, disabled: boolean): string {
  return disabled ? THEME_STATE_TW.disabled : active ? THEME_STATE_TW.active : THEME_STATE_TW.idle;
}

function primaryButtonTw(disabled: boolean): string {
  return disabled ? PRIMARY_DISABLED_TW : PRIMARY_TW;
}

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
   * Portal para `document.body`: o workspace anima a entrada dos filhos de
   * `.page-content`, e o `transform` resultante vira containing block de
   * `position: fixed`. Sem o portal o wizard fica preso ao cartão do workspace
   * (784x307 em vez do viewport inteiro) e a área das opções tem só ~94px.
   */
  const content = isMinimized ? (
    <div className={DOCK_TW} style={DOCK_STYLE} role="region" aria-label="Assistente de criação de site minimizado">
      <button
        type="button"
        className={DOCK_BUTTON_TW}
        onClick={() => setMode('fullscreen')}
        title="Restaurar assistente em tela cheia"
      >
        <Globe size={16} aria-hidden="true" />
        <span>Criar site — {STEP_LABELS[step]}</span>
      </button>
      <button
        type="button"
        className={DOCK_CLOSE_TW}
        onClick={onClose}
        aria-label="Fechar assistente"
        title="Fechar assistente"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  ) : (
    <div
      className={isFullscreen ? WIZARD_FULLSCREEN_TW : WIZARD_WINDOW_TW}
      style={isFullscreen ? WIZARD_FRAME_STYLE : { ...WIZARD_FRAME_STYLE, ...WIZARD_WINDOW_STYLE }}
      role="dialog"
      aria-modal="true"
      aria-label="Assistente de criação de site"
    >
      <header className={HEADER_TW}>
        <div className={HEADER_LEFT_TW}>
          <button
            type="button"
            className={ICON_BUTTON_TW}
            aria-label="Minimizar assistente"
            title="Minimizar"
            onClick={handleMinimize}
          >
            <Minimize size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={ICON_BUTTON_TW}
            aria-label={isFullscreen ? 'Restaurar janela' : 'Tela cheia'}
            title={isFullscreen ? 'Restaurar janela' : 'Tela cheia'}
            onClick={handleToggleFullscreen}
          >
            {isFullscreen ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize size={16} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className={ICON_BUTTON_CLOSE_TW}
            aria-label="Fechar assistente"
            title="Fechar assistente"
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className={HEADER_CENTER_TW}>
          <h2 className={TITLE_TW}>
            Criar site
          </h2>
          <p className={SUB_TW}>
            {STEP_LABELS[step]}
          </p>
        </div>
      </header>

      <ol
        className={PROGRESS_TW}
        aria-label="Etapas do assistente"
      >
        {STEP_ORDER.map((s, i) => {
          const isDone = i < currentIndex;
          const isCurrent = i === currentIndex;
          const StepIcon = STEP_ICONS[s];
          return (
            <li
              key={s}
              className={STEP_ITEM_TW}
            >
              <button
                type="button"
                className={stepStateTw(isDone, isCurrent)}
                disabled={!isDone && !isCurrent}
                onClick={() => (isDone ? setStep(s) : undefined)}
                aria-current={isCurrent ? 'step' : undefined}
              >
                <span
                  className={badgeStateTw(isDone, isCurrent)}
                >
                  {isDone ? <CheckCircle2 size={12} aria-hidden="true" /> : i + 1}
                </span>
                <span className={STEP_LABEL_TW}>
                  <StepIcon size={13} aria-hidden="true" />
                  {STEP_LABELS[s]}
                </span>
              </button>
              {i < STEP_ORDER.length - 1 && (
                <span
                  className={connectorStateTw(isDone)}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>

      <div className={BODY_TW}>
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
        {origemError ? <p role="alert" className={FORM_ERROR_TW}>{origemError}</p> : null}
      </div>

      <footer
        className={FOOTER_TW}
      >
        {!isFirst && (
          <button
            type="button"
            className={SECONDARY_TW}
            disabled={disabled || busy}
            onClick={handleBack}
          >
            <ChevronLeft size={14} aria-hidden="true" />
            Voltar
          </button>
        )}
        {isLast ? (
          <button
            type="button"
            className={primaryButtonTw(disabled || busy)}
            disabled={disabled || busy}
            onClick={() => void handleFinish()}
          >
            {busy ? (
              <>
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                Criando…
              </>
            ) : (
              <>
                <Rocket size={15} aria-hidden="true" />
                Criar site
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            className={primaryButtonTw(disabled || busy || !canNext)}
            disabled={disabled || busy || !canNext}
            onClick={handleNext}
          >
            Próximo
            <ChevronRight size={14} aria-hidden="true" />
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
  const usesLayoutImage = value === 'ia' || value === 'image';

  return (
    <section className={PANEL_TW} style={PANEL_STYLE}>
      <header className={STEP_HEAD_TW}>
        <h3 className={STEP_TITLE_TW}>Como você quer começar?</h3>
        <p className={STEP_SUB_TW}>
          Escolha a origem do site. Você poderá editar tudo no editor depois.
        </p>
      </header>
      <div className={OPTIONS_TW}>
        {options.map((opt) => {
          const active = value === opt.id;
          const Icon = opt.icon;
          return (
            <button
              key={opt.id}
              type="button"
              className={optionStateTw(active, disabled)}
              aria-pressed={active}
              onClick={() => !disabled && onChange(opt.id)}
            >
              <div className={optionIconStateTw(active, disabled)}>
                <Icon size={18} aria-hidden="true" />
              </div>
              <div className={OPTION_TEXT_TW}>
                <strong className={OPTION_LABEL_TW}>{opt.label}</strong>
                <span className={OPTION_DESC_TW}>{opt.desc}</span>
              </div>
            </button>
          );
        })}
      </div>
      {value !== 'zero' && (
        <div className={CLONE_FIELD_TW}>
          {value === 'clone' && (
            <>
              <label className={FIELD_LABEL_TW}>URL do site para clonar</label>
              <input
                type="url"
                className={INPUT_TW}
                value={cloneUrl}
                onChange={(e) => onCloneUrlChange(e.target.value)}
                placeholder="https://exemplo.com"
                disabled={disabled}
              />
              <p className={FIELD_HINT_TW}>
                Buscamos o HTML público e convertemos títulos, textos, imagens, links e vídeos em blocos editáveis.
              </p>
            </>
          )}
          {value === 'html' && (
            <>
              <label className={FIELD_LABEL_TW}>Cole o HTML da página</label>
              <textarea
                className={CODE_TEXTAREA_TW}
                value={htmlInput}
                onChange={(e) => onHtmlInputChange(e.target.value)}
                placeholder={'<h1>Minha empresa</h1>\n<p>Conteúdo da página...</p>'}
                rows={7}
                disabled={disabled}
              />
              <p className={FIELD_HINT_TW}>
                Scripts, eventos e links não seguros são descartados. Revise os blocos no editor depois.
              </p>
            </>
          )}
          {value === 'zip' && (
            <>
              <label className={FIELD_LABEL_TW}>Arquivo ZIP (até 15 MB)</label>
              <input
                type="file"
                accept=".zip,application/zip"
                onChange={(e) => onZipFileChange(e.target.files?.[0] ?? null)}
                disabled={disabled}
                className={FILE_INPUT_TW}
              />
              <p className={FIELD_HINT_TW}>
                Lemos HTML e JSON de Elementor, Divi, Beaver Builder e Crocoblock. CSS/JS não são executados e imagens locais precisam de URL pública.
              </p>
            </>
          )}
          {usesLayoutImage && (
            <>
              <label className={FIELD_LABEL_TW}>
                {value === 'image' ? 'Descreva o site (opcional)' : 'Descreva a ideia (opcional se houver imagem)'}
              </label>
              <textarea
                className={TEXTAREA_TW}
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
                placeholder="Ex.: site para uma clínica veterinária com contato e horários"
                rows={4}
                disabled={disabled}
              />
              <div className={LAYOUT_UPLOAD_TW}>
                <label className={INLINE_FIELD_LABEL_TW} htmlFor={LAYOUT_IMAGE_INPUT_ID}>
                  <ImageIcon size={14} aria-hidden="true" />
                  {value === 'image' ? 'Imagem do layout (obrigatória)' : 'Imagem de layout (opcional)'}
                </label>
                <input
                  id={LAYOUT_IMAGE_INPUT_ID}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  aria-required={value === 'image'}
                  onChange={(e) => {
                    onLayoutImageChange(e.target.files?.[0] ?? null);
                    e.target.value = '';
                  }}
                  disabled={disabled || readingLayoutImage}
                  className={FILE_INPUT_TW}
                />
                {readingLayoutImage ? (
                  <p className={FIELD_HINT_TW}>Preparando a imagem…</p>
                ) : null}
                {layoutImageError ? (
                  <p role="alert" className={IMAGE_ERROR_TW}>{layoutImageError}</p>
                ) : null}
                {layoutImage ? (
                  <div className={LAYOUT_PREVIEW_TW}>
                    <img src={layoutImage.dataUrl} alt="Prévia da imagem de layout enviada" className={LAYOUT_PREVIEW_IMG_TW} />
                    <div className={LAYOUT_PREVIEW_META_TW}>
                      <strong className={LAYOUT_PREVIEW_NAME_TW}>{layoutImage.fileName}</strong>
                      <span className={LAYOUT_PREVIEW_SIZE_TW}>{layoutImage.width} × {layoutImage.height} px</span>
                    </div>
                    <button
                      type="button"
                      className={ICON_BUTTON_TW}
                      aria-label="Remover imagem de layout"
                      title="Remover imagem de layout"
                      disabled={disabled}
                      onClick={() => onLayoutImageChange(null)}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                ) : null}
                <p className={FIELD_HINT_TW}>
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
    <section className={PANEL_TW} style={PANEL_STYLE}>
      <header className={STEP_HEAD_TW}>
        <h3 className={STEP_TITLE_TW}>Que tipo de site?</h3>
        <p className={STEP_SUB_TW}>
          Dê um nome ao site e escolha o tipo. O nome aparece no painel e no editor.
        </p>
        <label className={NAMED_LABEL_TW}>
          <span className={NAMED_LABEL_HINT_TW}>
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
            className={NAMED_INPUT_TW}
          />
        </label>
        <label className={NAMED_LABEL_TW}>
          <span className={NAMED_LABEL_HINT_TW}>
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
            className={NAMED_INPUT_TW}
          />
          <small className={NAMED_HELP_TW}>
            Se deixar em branco, criamos um logotipo provisório. O wizard também gera ilustrações editáveis, marcadas como rascunho, para você trocar por fotos reais antes de publicar.
          </small>
        </label>
      </header>
      <div className={OPTIONS_TW}>
        {types.map((t) => {
          const active = value === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              className={optionStateTw(active, disabled)}
              aria-pressed={active}
              onClick={() => !disabled && onChange(t.id)}
            >
              <div className={optionIconStateTw(active, disabled)}>
                <Icon size={18} aria-hidden="true" />
              </div>
              <div className={OPTION_TEXT_TW}>
                <strong className={OPTION_LABEL_TW}>{t.label}</strong>
                <span className={OPTION_DESC_TW}>{t.desc}</span>
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
    { id: 'default', label: 'Padrão (marca da empresa)', color: 'var(--primary)' },
    { id: 'azul', label: 'Azul', color: 'var(--theme-azul, var(--primary))' },
    { id: 'amber', label: 'Âmbar', color: 'var(--theme-amber, var(--warn))' },
    { id: 'coral', label: 'Coral', color: 'var(--theme-coral, var(--bad))' },
    { id: 'mint', label: 'Menta', color: 'var(--theme-mint, var(--ok))' },
  ];

  return (
    <section className={PANEL_TW} style={PANEL_STYLE}>
      <header className={STEP_HEAD_TW}>
        <h3 className={STEP_TITLE_TW}>Escolha o tema</h3>
        <p className={STEP_SUB_TW}>
          A cor da marca vem da empresa; aqui você escolhe a variação visual.
        </p>
      </header>
      <div className={THEMES_TW}>
        {themes.map((t) => {
          const active = value === t.id;
          return (
            <button
              key={t.id}
              type="button"
              className={themeStateTw(active, disabled)}
              aria-pressed={active}
              style={active ? { borderColor: t.color } : undefined}
              onClick={() => !disabled && onChange(t.id)}
            >
              <span className={THEME_COLOR_TW} style={{ backgroundColor: t.color }} aria-hidden="true" />
              <span className={THEME_LABEL_TW}>{t.label}</span>
              {active && <CheckCircle2 size={14} className={THEME_CHECK_TW} aria-hidden="true" />}
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
    <section className={PANEL_TW} style={PANEL_STYLE}>
      <header className={STEP_HEAD_TW}>
        <h3 className={STEP_TITLE_TW}>Domínio próprio</h3>
        <p className={STEP_SUB_TW}>
          Informe o domínio que pretende usar. Você poderá vinculá-lo e validá-lo no editor antes de publicar.
        </p>
      </header>
      <div className={DOMAIN_ROW_TW}>
        <input
          type="text"
          className={DOMAIN_INPUT_TW}
          value={domain}
          onChange={(e) => onChange(e.target.value)}
          placeholder="seusite.com.br"
          disabled={disabled}
        />
        <button
          type="button"
          className={primaryButtonTw(disabled || !domain.trim())}
          disabled={disabled || !domain.trim()}
          onClick={() => {
            onDomainValidated();
          }}
        >
          Validar
        </button>
      </div>
      <p className={DOMAIN_HINT_TW}>
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
    <section className={PANEL_TW} style={PANEL_STYLE}>
      <div className={PUBLISH_SUMMARY_TW}>
        <div className={PUBLISH_ITEM_TW}>
          <span className={PUBLISH_LABEL_TW}>Título do site</span>
          <span className={PUBLISH_VALUE_TW}>{siteTitle || '—'}</span>
        </div>
        <div className={PUBLISH_ITEM_TW}>
          <span className={PUBLISH_LABEL_TW}>Tipo</span>
          <span className={PUBLISH_VALUE_TW}>{TYPE_LABEL[siteType]}</span>
        </div>
        <div className={PUBLISH_ITEM_TW}>
          <span className={PUBLISH_LABEL_TW}>Referência de layout</span>
          <span className={PUBLISH_VALUE_TW}>
            {layoutImage ? `Imagem enviada (${layoutImage.width}×${layoutImage.height})` : '— (somente descrição)'}
          </span>
        </div>
        <div className={PUBLISH_ITEM_TW}>
          <span className={PUBLISH_LABEL_TW}>Domínio</span>
          <span className={PUBLISH_VALUE_TW}>{domain || '— (subdomínio Véxora)'}</span>
        </div>
      </div>
      <div className={PUBLISH_NOTICE_TW}>
        <AlertCircle size={16} className={PUBLISH_NOTICE_ICON_TW} aria-hidden="true" />
        <span className={PUBLISH_NOTICE_TEXT_TW}>
          O site será criado como rascunho. No editor você ajusta as páginas, vincula o domínio e publica.
        </span>
      </div>
    </section>
  );
}
