"use client";
export const moduleLabels: Record<string, string> = {
  INBOX: "Atendimento",
  CRM: "CRM",
  CALENDAR: "Agenda",
  TASKS: "Tarefas",
  AUTOMATION: "Automação e agentes de IA",
  MARKETING: "Marketing e Drive",
  FINANCE: "Financeiro",
  CHANNELS: "Canais e integrações",
  SETTINGS: "Configurações",
};
export function ModuleChoices({
  value,
  onChange,
  allowed,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  allowed?: string[];
}) {
  return (
    <fieldset className="module-permissions">
      <legend>Módulos permitidos</legend>
      {Object.entries(moduleLabels).map(([id, label]) => (
        <label className="ai-toggle" key={id}>
          <input
            type="checkbox"
            disabled={allowed !== undefined && !allowed.includes(id)}
            checked={value.includes(id)}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? [...value, id]
                  : value.filter((x) => x !== id),
              )
            }
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}
