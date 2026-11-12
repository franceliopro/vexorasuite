"use client";
import { useEffect } from "react";

/** Formata telefones brasileiros: +55 (99) 99999-9999 / (00) 99999-9999 */
export function applyPhoneMask(value: string): string {
  const digits = value.replace(/\D+/g, "");
  if (!digits) return "";
  let working = digits;
  if (working.startsWith("55") && digits.length > 10) working = working.slice(2);
  if (working.length >= 11) {
    const ddd = working.slice(0, 2);
    const first = working.slice(2, 7);
    const last = working.slice(7, 11);
    return `(${ddd}) ${first}-${last}`;
  }
  if (working.length === 10) {
    const ddd = working.slice(0, 2);
    const first = working.slice(2, 6);
    const last = working.slice(6);
    return `(${ddd}) ${first}-${last}`;
  }
  if (working.length > 11) return "+" + working;
  return working;
}

/** Máscara global de telefone para inputs type=tel e inputs com placeholder "55"/"(00)"/"99999". */
export function useGlobalPhoneMask() {
  useEffect(() => {
    function onInput(event: Event) {
      const target = event.target as HTMLInputElement | null;
      if (!target || target.tagName !== "INPUT") return;
      const hint = (target.placeholder || "") + (target.getAttribute("inputmode") || "");
      if (
        target.type !== "tel" &&
        !/55|\(00\)|9\d{4}/.test(hint)
      ) {
        return;
      }
      const next = applyPhoneMask(target.value);
      if (next !== target.value) {
        target.value = next;
        try {
          target.setSelectionRange(next.length, next.length);
        } catch {
          /* ignore */
        }
      }
    }
    document.addEventListener("input", onInput, true);
    return () => document.removeEventListener("input", onInput, true);
  }, []);
}
