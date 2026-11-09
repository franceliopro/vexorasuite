"use client";

import type { Agent } from "./inbox-workspace-types";

export interface MentionPopoverProps {
  mentionQuery: string | null;
  mentionList: Agent[];
  mentionIndex: number;
  onPick: (agent: Agent) => void;
}

/** Avatar pequeno com iniciais do nome (até 2 letras). */
export function InitialsAvatar({ name }: { name: string }) {
  const trimmed = name.trim();
  if (!trimmed) return <span className="mention-avatar">?</span>;
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "?";
  return <span className="mention-avatar">{initials}</span>;
}

export function MentionPopover({ mentionQuery, mentionList, mentionIndex, onPick }: MentionPopoverProps) {
  if (mentionQuery === null) return null;
  return (
    <div className="mention-popover" role="listbox" aria-label="Mencione um atendente">
      <div className="mention-head">
        <strong>Mencionar atendente</strong>
        <small>Digite para filtrar</small>
      </div>
      <ul>
        {mentionList.length ? (
          mentionList.map((agent, index) => (
            <li key={agent.id}>
              <button
                type="button"
                className={index === mentionIndex ? "selected" : ""}
                role="option"
                aria-selected={index === mentionIndex}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onPick(agent);
                }}
              >
                <InitialsAvatar name={agent.name} />
                <span className="mention-copy">
                  <strong>{agent.name}</strong>
                  <small>{agent.email}</small>
                </span>
              </button>
            </li>
          ))
        ) : (
          <li className="mention-empty">Nenhum atendente com esse nome</li>
        )}
      </ul>
    </div>
  );
}
