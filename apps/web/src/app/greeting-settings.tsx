"use client";
import { useEffect, useState } from "react";
const labels = [
  ["dawn", "Madrugada · 0h–5h59"],
  ["morning", "Manhã · 6h–11h59"],
  ["afternoon", "Tarde · 12h–17h59"],
  ["evening", "Noite · 18h–23h59"],
] as const;
const defaults = {
  companyName: "",
  greetings: {
    dawn: "Olá, boa madrugada!",
    morning: "Bom dia!",
    afternoon: "Boa tarde!",
    evening: "Boa noite!",
  },
  farewells: {
    dawn: "Tenha uma ótima madrugada!",
    morning: "Tenha um ótimo dia!",
    afternoon: "Tenha uma ótima tarde!",
    evening: "Tenha uma ótima noite!",
  },
};
export function GreetingSettings() {
  const [value, setValue] = useState(defaults),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/api/backend/conversations/quick-reply-settings")
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((d) =>
        setValue({
          ...defaults,
          ...d,
          greetings: { ...defaults.greetings, ...d.greetings },
          farewells: { ...defaults.farewells, ...d.farewells },
        }),
      )
      .catch(() => setNotice("Não foi possível carregar as saudações."));
  }, []);
  return (
    <details className="workspace-disclosure">
      <summary>Saudações e despedidas por horário</summary>
      <form
        className="ai-admin-fields"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const r = await fetch(
              "/api/backend/conversations/quick-reply-settings",
              {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ settings: value }),
              },
            );
            if (!r.ok) throw Error();
            setNotice("Frases atualizadas.");
          } catch {
            setNotice("Não foi possível salvar.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>
          Usadas por {"{{saudacao}}"} e {"{{despedida}}"} nas respostas rápidas.
          A faixa de horário segue o dispositivo do atendente.
        </p>
        {labels.map(([key, label]) => (
          <fieldset key={key}>
            <legend>{label}</legend>
            <label>
              Saudação
              <input
                maxLength={240}
                required
                value={value.greetings[key]}
                onChange={(e) =>
                  setValue((v) => ({
                    ...v,
                    greetings: { ...v.greetings, [key]: e.target.value },
                  }))
                }
              />
            </label>
            <label>
              Despedida
              <input
                maxLength={240}
                required
                value={value.farewells[key]}
                onChange={(e) =>
                  setValue((v) => ({
                    ...v,
                    farewells: { ...v.farewells, [key]: e.target.value },
                  }))
                }
              />
            </label>
          </fieldset>
        ))}
        <button className="primary-button" disabled={busy}>
          Salvar frases
        </button>
        {notice && <p role="status">{notice}</p>}
      </form>
    </details>
  );
}
