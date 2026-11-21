"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";

export interface AnchoredPopoverProps {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  className: string;
  testId?: string;
  id?: string;
  role?: string;
  ariaLabel?: string;
  align?: "start" | "end";
  side?: "bottom" | "top";
  offset?: number;
  onClick?: () => void;
}

/**
 * Painel ancorado no controle que o abriu.
 *
 * Usa `position: fixed` com coordenadas medidas do âncora: o painel escapa do
 * `overflow-hidden` do cabeçalho/ficha, não depende de portal (os e2e localizam
 * os itens dentro do `<details>`) e a camada `z-ib-anchored` o mantém acima das
 * janelas do Atendimento, abaixo apenas dos diálogos modais.
 */
export function AnchoredPopover({ open, anchorRef, children, className, testId, id, role, ariaLabel, align = "start", side = "bottom", offset = 8, onClick }: AnchoredPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<CSSProperties>({ left: 0, top: 0 });

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const rect = anchor.getBoundingClientRect();
    const size = panel.getBoundingClientRect();
    const margin = 8;
    const limitLeft = Math.max(margin, window.innerWidth - size.width - margin);
    const left = Math.max(margin, Math.min(align === "end" ? rect.right - size.width : rect.left, limitLeft));
    const below = rect.bottom + offset;
    const above = rect.top - size.height - offset;
    const top = side === "top" || below + size.height > window.innerHeight - margin || above < margin ? above : below;
    setPosition({ left, top: Math.max(margin, Math.min(top, Math.max(margin, window.innerHeight - size.height - margin))) });
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

  return <div ref={panelRef} data-testid={testId} id={id} role={role} aria-label={ariaLabel} className={"fixed z-ib-anchored " + className} style={position} onClick={onClick}>{children}</div>;
}
