"use client";

import { InitialsAvatar } from "./inbox-avatars";
import type { Agent } from "./inbox-workspace-types";

export interface MentionPopoverProps {
  mentionQuery: string | null;
  mentionList: Agent[];
  mentionIndex: number;
  onPick: (agent: Agent) => void;
}

/* Popover de menções em utilities TW. O azul vem dos tokens --primary do preset. */
const itemBase = "flex w-full items-center gap-2 rounded-ib-mention-item border-0 bg-transparent px-2 py-1.5 text-left text-ib-caption text-ink transition-colors";

export function MentionPopover({ mentionQuery, mentionList, mentionIndex, onPick }: MentionPopoverProps) {
  if (mentionQuery === null) return null;
  return (
    <div className="absolute bottom-full left-2 right-2 z-50 mb-2 grid max-h-ib-mention gap-1 overflow-auto rounded-ib-panel border border-line bg-surface p-2 shadow-token-lg" role="listbox" aria-label="Mencione um atendente" data-testid="mention-popover">
      <div className="grid gap-px px-1 pb-1.5">
        <strong className="text-ib-tick font-bold uppercase tracking-wide text-ink-secondary">Mencionar atendente</strong>
        <small className="text-ib-mention-hint text-ink-secondary">Digite para filtrar</small>
      </div>
      <ul className="m-0 grid list-none gap-0.5 p-0">
        {mentionList.length ? (
          mentionList.map((agent, index) => (
            <li key={agent.id} className="block">
              <button
                type="button"
                className={itemBase + (index === mentionIndex ? " bg-blue-50" : " hover:bg-blue-50")}
                role="option"
                aria-selected={index === mentionIndex}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onPick(agent);
                }}
              >
                <InitialsAvatar name={agent.name} />
                <span className="grid min-w-0 gap-px">
                  <strong className="truncate text-ib-caption text-ink">{agent.name}</strong>
                  <small className="truncate text-ib-micro text-ink-secondary">{agent.email}</small>
                </span>
              </button>
            </li>
          ))
        ) : (
          <li className="px-1.5 py-2 text-ib-time text-ink-secondary" data-testid="mention-empty">Nenhum atendente com esse nome</li>
        )}
      </ul>
    </div>
  );
}
