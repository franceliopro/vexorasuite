"use client";
import { useEffect, useState } from "react";
export function CommunicationConnections() {
  const [status, setStatus] = useState<any>(null);
  useEffect(() => {
    fetch("/api/backend/communications/gateways")
      .then((r) => (r.ok ? r.json() : null))
      .then(setStatus)
      .catch(() => {});
  }, []);
  return (
    <section className="content-card ai-admin-fields" style={{ padding: 20 }}>
      <h2>E-mail, SMS e telefonia</h2>
      <p>Conecte os canais de relacionamento da sua empresa.</p>
      <a className="secondary-button" href="/?module=E-mails">
        Configurar IMAP e SMTP
      </a>
      {[
        ["sms", "SMS · Jasmin"],
        ["voice", "Telefonia · Asterisk"],
        ["whatsappCalls", "Chamadas WhatsApp"],
        ["aiCalls", "Chamadas por IA"],
      ].map(([key, label]) => (
        <div key={key}>
          <strong>{label}</strong>
          <span className="status-pill">
            {status?.[key!]?.configured
              ? "Rota configurada"
              : "Não configurado"}
          </span>
          <p>
            {status?.[key!]?.description || "Carregando estado da integração…"}
          </p>
        </div>
      ))}
      <details>
        <summary>Como habilitar SMS e telefonia</summary>
        <p>
          A instalação do gateway e a rota da operadora precisam ser
          configuradas para sua empresa. Depois disso, os controles aparecem na
          ficha do contato. Nenhuma chamada ou cobrança é iniciada ao abrir esta
          tela.
        </p>
      </details>
    </section>
  );
}
