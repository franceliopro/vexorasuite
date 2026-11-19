import type { SiteDocument } from '@/shared-types/site-document';

// Undo/redo sobre SiteDocument (imutável por snapshot).

export interface HistoryState {
  past: SiteDocument[];
  present: SiteDocument;
  future: SiteDocument[];
}

export function createHistory(initial: SiteDocument): HistoryState {
  return { past: [], present: initial, future: [] };
}

export function pushHistory(state: HistoryState, next: SiteDocument): HistoryState {
  return {
    past: [...state.past, state.present],
    present: next,
    future: [],
  };
}

export function undo(state: HistoryState): HistoryState {
  if (state.past.length === 0) return state;
  const previous = state.past[state.past.length - 1]!;
  return {
    past: state.past.slice(0, -1),
    present: previous,
    future: [state.present, ...state.future],
  };
}

export function redo(state: HistoryState): HistoryState {
  if (state.future.length === 0) return state;
  const next = state.future[0]!;
  return {
    past: [...state.past, state.present],
    present: next,
    future: state.future.slice(1),
  };
}

export function canUndo(state: HistoryState): boolean {
  return state.past.length > 0;
}

export function canRedo(state: HistoryState): boolean {
  return state.future.length > 0;
}





