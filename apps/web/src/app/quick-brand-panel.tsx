"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { Palette, Upload, X } from "lucide-react";
import {
  applyBrandAll,
  brandIsReadable,
  sanitizeHex,
  type BrandAssets,
} from "../lib/brand-theme";
import { brandTextColor } from "../lib/tenant-cache";
import { TailwindColorPicker } from "./tailwind-color-picker";

const panelTw = "fixed z-50 grid max-h-screen w-80 gap-3 overflow-auto rounded-xl border border-gray-200 bg-zinc-100 p-3.5 text-slate-950 shadow-lg";
const headerTw = "flex items-start justify-between gap-2.5";
const titleTw = "m-0 font-sans text-sm font-extrabold tracking-normal";
const copyTw = "mb-0 mt-0.5 text-xs leading-relaxed text-slate-600";
const closeTw = "grid h-6 w-6 flex-none place-items-center rounded-token-sm transition-colors hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus";
const sectionTw = "grid gap-1.5 text-xs font-bold text-slate-600";
const uploadTw = "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-zinc-200 px-3 text-xs font-bold text-slate-950 transition-colors hover:bg-zinc-300";
const previewTw = "flex flex-wrap items-center gap-2 rounded-token-sm border border-gray-200 bg-zinc-200 px-2.5 py-2";
const buttonPreviewTw = "rounded-token-sm px-2.5 py-1.5 text-xs font-bold";
const logoPreviewTw = "max-h-10 max-w-40 object-contain";
const fallbackLogoTw = "grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-sm font-extrabold text-white";
const okTw = "inline-flex self-start rounded-full border border-emerald-600 bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-600";
const warnTw = "inline-flex self-start rounded-full border border-amber-600 bg-amber-100 px-3 py-1 text-xs font-bold text-amber-600";
const errorTw = "m-0 text-xs font-bold text-red-700";
const footerTw = "flex items-center justify-between gap-2 border-t border-gray-200 pt-2.5";
const actionsTw = "flex items-center gap-2";
const textButtonTw = "inline-flex min-h-8 items-center justify-center px-1.5 text-xs font-bold text-blue-700";
const mutedButtonTw = "inline-flex min-h-8 items-center justify-center px-1.5 text-xs font-bold text-slate-600";
const saveTw = "inline-flex min-h-9 items-center justify-center rounded-lg bg-blue-600 px-3 text-xs font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";

const DEFAULT_PRIMARY = "#1D4ED8";

export function QuickBrandPanel({
  anchor,
  brand,
  theme,
  onClose,
  onSaved,
  onAdvanced,
}: {
  anchor: { x: number; y: number };
  brand: BrandAssets;
  theme: string;
  onClose: () => void;
  onSaved: (saved: BrandAssets) => void;
  onAdvanced: () => void;
}) {
  const [draft, setDraft] = useState<BrandAssets>(brand);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft({ ...brand });
    setError("");
  }, [brand]);

  /** Esc, clique fora e fechar devolvem o tema ao estado salvo. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        applyBrandAll(brand, theme);
        onClose();
      }
    };
    const onDown = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest('[data-testid="quick-brand-panel"]')) return;
      applyBrandAll(brand, theme);
      onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  });

  const changeColor = (hex: string) => {
    const next = { ...draft, primaryColor: hex };
    setDraft(next);
    applyBrandAll(next, theme);
  };

  const restore = () => {
    const next = { ...draft, primaryColor: DEFAULT_PRIMARY, logoLight: "", logoDark: "" };
    setDraft(next);
    applyBrandAll(next, theme);
  };

  const loadLogo = async (file?: File) => {
    if (!file) return;
    setError("");
    if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type)) {
      setError("Use PNG, JPG, WebP ou SVG.");
      return;
    }
    if (file.size > 19 * 1024) {
      setError("Imagem grande demais. Use um arquivo menor ou abra Mais opções.");
      return;
    }
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Não foi possível abrir a imagem."));
        reader.readAsDataURL(file);
      });
      if (data.length > 26000) throw new Error("Imagem grande demais. Use Mais opções para otimizar.");
      const next = { ...draft, logoLight: data, logoDark: data };
      setDraft(next);
      applyBrandAll(next, theme);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível abrir a imagem.");
    }
  };

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    void loadLogo(file);
  };

  const save = async () => {
    const primaryColor = sanitizeHex(draft.primaryColor);
    if (!primaryColor) {
      setError("Escolha uma cor.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload: BrandAssets = {
        ...draft,
        primaryColor,
        logoLight: draft.logoLight || "",
        logoDark: draft.logoDark || "",
      };
      const response = await fetch("/api/backend/contacts/brand-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          result && typeof result.message === "string"
            ? result.message
            : "Não foi possível salvar. Tente de novo.",
        );
      }
      const saved = { ...draft, ...(result ?? {}) } as BrandAssets;
      applyBrandAll(saved, theme);
      window.dispatchEvent(new CustomEvent("vexora:brand-updated", { detail: saved }));
      onSaved(saved);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar. Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  const clean = sanitizeHex(draft.primaryColor);
  const readable = brandIsReadable(draft.primaryColor);
  const textColor = brandTextColor(clean || "#000000");

  return (
    <div
      data-testid="quick-brand-panel"
      className={panelTw}
      role="dialog"
      aria-labelledby="quick-brand-title"
      style={{ left: anchor.x, top: anchor.y }}
    >
      <header className={headerTw}>
        <div>
          <h3 id="quick-brand-title" className={titleTw}>Aparência da empresa</h3>
          <p className={copyTw}>Só esta empresa. Veja o resultado antes de salvar.</p>
        </div>
        <button type="button" className={closeTw} onClick={() => { applyBrandAll(brand, theme); onClose(); }} aria-label="Fechar">
          <X size={16} aria-hidden="true" />
        </button>
      </header>

      <TailwindColorPicker
        value={draft.primaryColor}
        label="da empresa"
        ariaLabel="Cor da empresa"
        swatchAriaLabel="Escolher cor da empresa"
        onChange={changeColor}
      />

      <div className={sectionTw}>
        <span>Logo</span>
        <label className={uploadTw}>
          <Upload size={15} aria-hidden="true" /> Enviar imagem
          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg,.webp" className="sr-only" onChange={onFile} />
        </label>
        {draft.logoLight ? (
          <button type="button" className={textButtonTw} onClick={restore}>Restaurar padrão</button>
        ) : null}
      </div>

      <div className={previewTw} aria-label="Prévia da aparência">
        <span className={buttonPreviewTw} style={{ backgroundColor: draft.primaryColor, color: textColor }}>
          Botão
        </span>
        {draft.logoLight
          ? <img src={draft.logoLight} alt="Prévia do logo" className={logoPreviewTw} />
          : <span className={fallbackLogoTw} aria-hidden="true"><Palette size={18} /></span>}
      </div>

      <p className={readable ? okTw : warnTw} role="status">
        {readable ? "Texto legível ✓" : "Escolha um tom mais escuro para o texto."}
      </p>
      {!clean || error ? <p className={errorTw} role="alert">{error || "Escolha uma cor válida."}</p> : null}

      <footer className={footerTw}>
        <button
          type="button"
          className={textButtonTw}
          onClick={() => { applyBrandAll(brand, theme); onClose(); onAdvanced(); }}
        >
          Mais opções
        </button>
        <span className={actionsTw}>
          <button type="button" className={mutedButtonTw} onClick={() => { applyBrandAll(brand, theme); onClose(); }}>
            Cancelar
          </button>
          <button type="button" className={saveTw} onClick={() => void save()} disabled={busy}>
            {busy ? "Salvando…" : "Salvar"}
          </button>
        </span>
      </footer>
    </div>
  );
}
