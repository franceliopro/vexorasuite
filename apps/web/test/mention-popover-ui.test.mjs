import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/app/mention-popover.tsx", import.meta.url), "utf8");
const avatars = fs.readFileSync(new URL("../src/app/inbox-avatars.tsx", import.meta.url), "utf8");

test("MentionPopover exports the component used by the workspace", () => {
  assert.match(source, /export function MentionPopover\b/);
});

test("InitialsAvatar lives in inbox-avatars and renders initials", () => {
  assert.match(avatars, /export function InitialsAvatar\b/);
  assert.match(avatars, /className="mention-avatar"/);
  assert.match(avatars, /parts\.slice\(0, 2\)/);
});

test("MentionPopover contract props are present in the signature", () => {
  for (const prop of ["mentionQuery", "mentionList", "mentionIndex", "onPick"]) {
    assert.match(source, new RegExp(prop), `${prop} must be a prop`);
  }
});

test("MentionPopover keeps the picker accessible", () => {
  assert.match(source, /role="listbox"/);
  assert.match(source, /aria-label="Mencione um atendente"/);
  assert.match(source, /role="option"/);
  assert.match(source, /aria-selected/);
});

test("MentionPopover uses onMouseDown (not onClick) so the composer keeps focus", () => {
  assert.match(source, /onMouseDown/);
  assert.doesNotMatch(source, /onClick=\{/);
});

test("MentionPopover renders the empty-state copy for no matches", () => {
  assert.match(source, /Nenhum atendente com esse nome/);
  assert.match(source, /className="mention-empty"/);
});

test("MentionPopover stays hidden when mentionQuery is null", () => {
  assert.match(source, /if \(mentionQuery === null\) return null/);
});
