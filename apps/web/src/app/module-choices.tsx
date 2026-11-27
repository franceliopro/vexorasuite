"use client";
const fieldsetTw = "mt-5 grid grid-cols-modules content-start gap-1.5";
const labelTw = "inline-flex cursor-pointer items-center gap-2 font-medium text-modules-label";
const checkboxTw = "size-4 flex-none accent-blue-600";

export const moduleLabels: Record<string, string> = {
  INBOX: "Atendimento",
  CRM: "CRM",
  CALENDAR: "Calendários",
  TASKS: "Tarefas",
  AUTOMATION: "Automação e agentes de IA",
  MARKETING: "Marketing e Drive",
  FINANCE: "Financeiro",
  CHANNELS: "Conexões",
  SCHOOL: "Gestão escolar",
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
    <fieldset className={fieldsetTw}>
      <legend>Módulos permitidos</legend>
      {Object.entries(moduleLabels).map(([id, label]) => (
        <label className={labelTw} key={id}>
          <input
            type="checkbox"
            className={checkboxTw}
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
