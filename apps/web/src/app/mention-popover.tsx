"use client";

import { InitialsAvatar } from "./inbox-avatars";
import type { Agent } from "./inbox-workspace-types";

export interface MentionPopoverProps {
  mentionQuery: string | null;
  mentionList: Agent[];
  mentionIndex: number;
  onPick: (agent: Agent) => void;
}

/* Popover de menções em utilities TW padrão: slate real, azul só de realce. */

export function MentionPopover({ mentionQuery, mentionList, mentionIndex, onPick }: MentionPopoverProps) {
  if (mentionQuery === null) return null;
  return (
    <div className="absolute bottom-full left-2 right-2 z-50 mb-2 grid max-h-60 gap-1 overflow-auto rounded-xl border border-slate-200 bg-white p-2 text-slate-800 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50" role="listbox" aria-label="Mencione um atendente" data-testid="mention-popover">
      <div className="grid gap-px px-1 pb-1.5">
        <strong className="text-2xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Mencionar atendente</strong>
        <small className="text-2xs text-slate-500 dark:text-slate-400">Digite para filtrar</small>
      </div>
      <ul className="m-0 grid list-none gap-0.5 p-0">
        {mentionList.length ? (
          mentionList.map((agent, index) => (
            <li key={agent.id} className="block">
              <button
                type="button"
                className={index === mentionIndex
                  ? "flex w-full items-center gap-2 rounded-lg border-0 bg-slate-200 px-2 py-1.5 text-left text-xs text-slate-900 transition-colors dark:bg-slate-700 dark:text-slate-50"
                  : "flex w-full items-center gap-2 rounded-lg border-0 bg-transparent px-2 py-1.5 text-left text-xs text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"}
                role="option"
                aria-selected={index === mentionIndex}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onPick(agent);
                }}
              >
                <InitialsAvatar name={agent.name} />
                <span className="grid min-w-0 gap-px">
                  <strong className="truncate text-xs text-slate-900 dark:text-slate-50">{agent.name}</strong>
                  <small className="truncate text-2xs text-slate-600 dark:text-slate-300">{agent.email}</small>
                </span>
              </button>
            </li>
          ))
        ) : (
          <li className="px-1.5 py-2 text-xs text-slate-600 dark:text-slate-300" data-testid="mention-empty">Nenhum atendente com esse nome</li>
        )}
      </ul>
    </div>
  );
}
