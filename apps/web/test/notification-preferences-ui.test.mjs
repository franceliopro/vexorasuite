import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const team = fs.readFileSync(new URL("../src/app/team-workspace.tsx", import.meta.url), "utf8");

test("the team form offers one accessible checkbox per real notification event", () => {
  const start = team.indexOf("<fieldset className={notificationFieldsetTw}>");
  const fieldset = team.slice(start, team.indexOf("</fieldset>", start));
  assert.match(fieldset, /<legend>Notificações<\/legend>/);
  assert.equal((fieldset.match(/type="checkbox"/g) || []).length, 1);
  const catalog = team.slice(team.indexOf("const NOTIFICATION_PREFERENCES"), team.indexOf("type NotificationEvent"));
  assert.equal((catalog.match(/event: "/g) || []).length, 5);
  for (const label of [
    "Atendimento atribuído a mim",
    "Atendimento atribuído ao meu setor",
    "Menção em nota interna",
    "Tarefa próxima do prazo",
    "Nova mensagem no meu atendimento",
  ]) assert.match(catalog, new RegExp(label));
  assert.match(fieldset, /checked=\{form\.notificationEvents\.includes\(event\)\}/);
  assert.match(fieldset, /className=\{toggleTw\} key=\{event\}/);
});

test("the editor loads and saves preferences through the authenticated API", () => {
  assert.match(team, /\/api\/backend\/notification-preferences\?userId=" \+ encodeURIComponent\(member\.id\)/);
  assert.match(team, /method: "PATCH"/);
  assert.match(team, /JSON\.stringify\(\{ userId: memberId, events: form\.notificationEvents \}\)/);
  assert.match(team, /notificationEventsFrom\(data\.events\)/);
  assert.match(team, /DEFAULT_NOTIFICATION_EVENTS/);
});

test("the UI describes preference storage without claiming notification delivery", () => {
  assert.match(team, /Salvar a preferência não envia nem confirma a entrega de uma notificação/);
  assert.match(team, /Preferência de notificação salva/);
  assert.doesNotMatch(team, /notificação enviada com sucesso/i);
  assert.doesNotMatch(team, /entrega confirmada/i);
});

test("the toggle styling reuses the existing Tailwind tokens and keeps sr-only as the only literal class", () => {
  const literais = [...team.matchAll(/className="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(literais, ["sr-only"]);
  assert.match(team, /const notificationFieldsetTw = "mt-5 grid gap-2 rounded-token border border-line bg-surface p-3"/);
});
