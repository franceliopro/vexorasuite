import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

const calendar = read("src/app/calendar-workspace.tsx");
const config = read("tailwind.config.ts");

/** Cores de agenda e a divisão redimensionável são dados, não remendos visuais. */
const semDados = calendar
  .replace(/style=\{\{[^}]*\}\}/g, "")
  .replace(/gridTemplateColumns:[^}]+/g, "");
/** Só as classes: data-testid, aria-* e roles não são classes componente. */
const classes = [...calendar.matchAll(/className=(?:"([^"]*)"|\{([\s\S]*?)\})/g)]
  .map((match) => match[1] ?? match[2])
  .join("\n");
/** As utilities com sufixo calendar-* vivem no preset e são aceitas. */
const semTokens = classes.replace(/\b[a-z][a-z0-9-]*-calendar-[a-z-]+/g, "");

test("o Calendário não usa classes componente", () => {
  assert.doesNotMatch(semTokens, /\bcalendar-[a-z][a-z0-9-]*/);
  assert.doesNotMatch(semTokens, /\b(?:ov|vx|ib|content-card|primary-button|secondary-button|icon-button|dialog-close|chip|ai-toggle|sites-field-label|sites-field-hint|text-button)-[a-z][a-z0-9-]*(?=[\s"'+]|$)/);
  assert.doesNotMatch(semTokens, /\b(?:content-card|primary-button|secondary-button|icon-button|dialog-close|chip|ai-toggle)\b/);
});

test("o Calendário usa só utilities do preset, sem remendos", () => {
  for (const forbidden of [
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /#[0-9a-fA-F]{3,8}\b/,
    /!important/,
    /@apply/,
  ]) {
    const match = semDados.match(forbidden);
    assert.equal(match, null, `remendo visual encontrado: ${match?.[0]}`);
  }
  for (const utility of [
    'data-testid="calendar-workspace"',
    "grid-cols-calendar-layout",
    "min-h-calendar-day",
    "grid-cols-calendar-event",
    "min-w-calendar-event-date",
    "w-calendar-handle",
    "h-calendar-map",
    "max-w-calendar-modal",
    "max-h-calendar-event-modal",
    "bg-slate-950/60",
    "z-wizard",
    "accent-blue-600",
  ]) {
    assert.ok(calendar.includes(utility), `falta a utility ${utility}`);
  }
  for (const token of [
    '"calendar-layout": "minmax(260px, 320px) minmax(0, 1fr)"',
    '"calendar-event": "auto auto minmax(0, 1fr) auto auto"',
    '"calendar-day": "104px"',
    '"calendar-modal": "90vh"',
    '"calendar-event-modal": "calc(100dvh - 24px)"',
    '"calendar-modal": "520px"',
    '"calendar-event-modal": "620px"',
    '"calendar-handle": "6px"',
    '"calendar-map": "clamp(180px, 38dvh, 320px)"',
    '"calendar-event": "3px"',
    '"calendar-copy": "44ch"',
    '"calendar-select": "148px"',
    '"calendar-chip": "150px"',
    '"calendar-month": "118px"',
  ]) {
    assert.ok(config.includes(token), `o preset deve expor ${token}`);
  }
});

test("a acessibilidade e os contratos do Calendário continuam intactos", () => {
  assert.ok(calendar.includes('role="separator"'));
  assert.ok(calendar.includes('aria-label="Ajustar largura do calendário"'));
  assert.ok(calendar.includes('aria-orientation="vertical"'));
  assert.ok(calendar.includes("e.key===\"ArrowLeft\"||e.key===\"ArrowRight\""));
  assert.ok(calendar.includes("window.localStorage.setItem(\"vexora-calendar-split\",String(n))"));
  assert.ok(calendar.includes("window.localStorage.setItem(\"vexora-calendar-columns\",String(v))"));
  assert.ok(calendar.includes("vexora-calendar-columns"));
  assert.ok(calendar.includes("vexora-calendar-split"));
  assert.ok(calendar.includes("gridTemplateColumns:calendarColumns===3?`minmax(0,${calendarSplit}fr) 6px minmax(250px,${100-calendarSplit}fr)`:\"minmax(0,1fr)\""));

  assert.ok(calendar.includes('role="tablist" aria-label="Visualização"'));
  assert.equal((calendar.match(/role="tab"/g) ?? []).length, 3);
  assert.ok(calendar.includes('role="listbox" aria-label="Sugestões de endereços"'));
  assert.ok(calendar.includes('role="option" aria-selected={false}'));

  assert.ok(calendar.includes('role="dialog"'));
  assert.ok(calendar.includes('aria-modal="true"'));
  assert.ok(calendar.includes('aria-label="Compromisso"'));
  assert.ok(calendar.includes('aria-label="Gerenciar agendas"'));
  assert.equal((calendar.match(/aria-label="Fechar"/g) ?? []).length, 2);
  assert.equal((calendar.match(/tabIndex={-1}/g) ?? []).length, 2);
  assert.ok(calendar.includes("useModalDialog(formOpen,modalRef,"));
  assert.ok(calendar.includes("useModalDialog(calendarManage,calendarManageRef,"));

  for (const label of [
    'aria-label="Mês anterior"',
    'aria-label="Mês seguinte"',
    'aria-label="Anterior"',
    'aria-label="Próximo"',
    'aria-label="Colunas do calendário"',
    'aria-label="Conta Google"',
    'aria-label="Calendário"',
    'aria-label="Atualizar compromissos"',
  ]) {
    assert.ok(calendar.includes(label), `perdeu ${label}`);
  }
  assert.equal((calendar.match(/role="alert"/g) ?? []).length, 3);
  assert.equal((calendar.match(/role="status"/g) ?? []).length, 3);
});

test("mini-calendário e lista de compromissos mantêm linhas divisórias", () => {
  assert.ok(calendar.includes('className="border-b border-gray-200 py-0.5 text-center text-2xs font-extrabold uppercase tracking-widest text-slate-600"'));
  assert.ok(calendar.includes('place-items-center rounded-xl border-b border-gray-100 text-2xs'));
  assert.ok(calendar.includes('rounded-xl border-b border-gray-200 px-3 py-2.5 text-left'));
});

test("as integrações e os modais do Calendário continuam intactos", () => {
  for (const endpoint of [
    '"/api/backend/integrations/google/calendar/"',
    'fetch("/api/backend/reminders/agendas"',
    'fetch("/api/backend/integrations/google/calendar/places?q="',
    'request<Account[]>("accounts")',
    'encodeURIComponent(account)+"/calendars"',
    'encodeURIComponent(account)+"/events?"+params',
    'request("assignments",{method:"POST"',
    'request("assignments/"+id,{method:"DELETE"})',
  ]) {
    assert.ok(calendar.includes(endpoint), `perdeu ${endpoint}`);
  }
  assert.ok(calendar.includes("onDoubleClick={()=>openForm(undefined,day)}"));
  assert.ok(calendar.includes("onDoubleClick={ev=>{ev.stopPropagation();openForm(e);}}"));
  assert.ok(calendar.includes('iframe title="Prévia do local no mapa"'));
  assert.ok(calendar.includes("allow-scripts allow-same-origin"));
});
