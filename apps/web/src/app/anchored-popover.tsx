"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

export interface AnchoredPopoverProps {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  className: string;
  testId?: string;
  id?: string;
  role?: string;
  ariaLabel?: string;
  align?: "start" | "center" | "end";
  side?: "bottom" | "top";
  offset?: number;
  portal?: boolean;
  onClick?: () => void;
}

/**
 * Painel ancorado no controle que o abriu.
 *
 * Usa `position: fixed` com coordenadas medidas do âncora: o painel escapa do
 * `overflow-hidden` do cabeçalho/ficha. Por padrão continua na árvore (os e2e
 * localizam itens dentro do `<details>`); `portal` move somente este painel
 * para `document.body` quando ele precisa escapar de stacking contexts. A
 * camada 260 o mantém acima das janelas do Atendimento, abaixo dos diálogos.
 */
export function AnchoredPopover({
  open,
  anchorRef,
  children,
  className,
  testId,
  id,
  role,
  ariaLabel,
  align = "start",
  side = "bottom",
  offset = 8,
  portal = false,
  onClick,
}: AnchoredPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<CSSProperties>({ left: 0, top: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const rect = anchor.getBoundingClientRect();
    const size = panel.getBoundingClientRect();
    const margin = 8;
    const limitLeft = Math.max(margin, window.innerWidth - size.width - margin);
    const rawLeft = align === "center"
      ? rect.left + rect.width / 2 - size.width / 2
      : align === "end"
        ? rect.right - size.width
        : rect.left;
    const left = Math.max(margin, Math.min(rawLeft, limitLeft));
    const below = rect.bottom + offset;
    const above = rect.top - size.height - offset;
    const fitsBelow = below + size.height <= window.innerHeight - margin;
    const fitsAbove = above >= margin;
    const top = side === "top"
      ? (fitsAbove || !fitsBelow ? above : below)
      : (fitsBelow || !fitsAbove ? below : above);
    setPosition({
      left,
      top: Math.max(margin, Math.min(top, Math.max(margin, window.innerHeight - size.height - margin))),
    });
  }, [anchorRef, align, side, offset]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  const panel = (
    <div
      ref={panelRef}
      data-testid={testId}
      id={id}
      role={role}
      aria-label={ariaLabel}
      className={"fixed " + className}
      style={{
        ...position,
        maxWidth: "calc(100vw - 16px)",
        maxHeight: "calc(100vh - 16px)",
        overflowY: "auto",
        zIndex: 260,
      }}
      onClick={onClick}
    >
      {children}
    </div>
  );

  return portal && mounted ? createPortal(panel, document.body) : panel;
}
