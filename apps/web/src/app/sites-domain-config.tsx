"use client";

/**
 * Véxora Sites — etapa de configuração de domínio próprio (deploy via Cloudflare for SaaS).
 *
 * Padrão visual: tokens de design (`docs/design-tokens.md`), classes de botão/dialog
 * de `vexora.css` e ícones `lucide-react`. O componente é um painel/card que cabe
 * dentro do assistente de criação de sites (ou como diálogo via VexoraDialog).
 *
 * Integração: os endpoints de domínio ainda não existem neste checkout (backend em
 * paralelo pelo VexoraProgramador). Os caminhos abaixo são placeholders de contrato
 * e devem ser ajustados à assinatura real quando o backend estiver pronto.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./sites-shared";
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  RefreshCw,
  Shield,
  Zap,
} from "lucide-react";

type DnsSslStatus = "idle" | "pending" | "verified" | "error";
type FlowStep = "domain" | "dns" | "ssl" | "deploy" | "done" | "error";

interface SiteDomainConfigProps {
  siteId: string;
  siteSlug: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** Somente usuários com permissão podem configurar domínio. */
  canConfigureDomain?: boolean;
}

const DOMAIN_PLACEHOLDER = "seusite.com.br";
const CNAME_TARGET = "static.vexorasuite.com.br";

export function SiteDomainConfig({
  siteId,
  siteSlug,
  open,
  onClose,
  onSuccess,
  canConfigureDomain = true,
}: SiteDomainConfigProps) {
  const [domain, setDomain] = useState("");
  const [domainError, setDomainError] = useState("");
  const [dnsStatus, setDnsStatus] = useState<DnsSslStatus>("idle");
  const [sslStatus, setSslStatus] = useState<DnsSslStatus>("idle");
  const [deployProgress, setDeployProgress] = useState(0);
  const [flowStep, setFlowStep] = useState<FlowStep>("domain");
  const [notice, setNotice] = useState("");
  const [noticeKind, setNoticeKind] = useState<"info" | "ok" | "bad">("info");
  const [busy, setBusy] = useState(false);
  const [dnsRecords, setDnsRecords] = useState<Array<{ type: string; name: string; value: string }>>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearNotice = useCallback(() => setNotice(""), []);

  // Limpa polling ao desmontar/fechar
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  /* ---------- validação do domínio ---------- */
  const domainIsValid = useCallback(() => {
    const value = domain.trim().toLowerCase();
    if (!value) {
      setDomainError("Informe o domínio próprio.");
      return false;
    }
    const re = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/;
    if (!re.test(value)) {
      setDomainError("Digite um domínio válido (ex.: seusite.com.br).");
      return false;
    }
    if (value.includes(" vexorasuite.com.br")) {
      setDomainError("Use um domínio externo próprio, não um subdomínio da Véxora.");
      return false;
    }
    setDomainError("");
    return true;
  }, [domain]);

  const handleDomainChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setDomain(e.target.value);
      if (domainError) setDomainError("");
      if (noticeKind === "bad") clearNotice();
    },
    [domainError, noticeKind, clearNotice]
  );

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // placeholder de simulação (remover quando o backend estiver pronto)
  const simulateDnsSsl = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 1200));
    const dns: DnsSslStatus =
      Math.random() > 0.15 ? "verified" : "error";
    const ssl: DnsSslStatus = dns === "verified" ? "verified" : "pending";
    return {
      dns,
      ssl,
      records: [
        { type: "CNAME", name: `@ / www`, value: CNAME_TARGET },
        { type: "ANAME", name: `@`, value: CNAME_TARGET },
      ],
    };
  }, []);

  /* ---------- ações ---------- */
  const pollDnsSsl = useCallback(async () => {
    try {
      // TODO: substituir pelo endpoint real (ex.: GET /api/backend/sites/:id/domain/verify)
      // const data = await api<{ dns: DnsSslStatus; ssl: DnsSslStatus; records: [...] }>(`/sites/${siteId}/domain/verify`);
      // placeholder: simula progresso até verificar
      const simulated = await simulateDnsSsl();
      setDnsStatus(simulated.dns);
      setSslStatus(simulated.ssl);
      setDnsRecords(simulated.records);
      if (simulated.dns === "verified" && simulated.ssl === "verified") {
        stopPoll();
        setFlowStep("ssl");
        setNotice("DNS e SSL verificados. Pronto para publicar.");
        setNoticeKind("ok");
      } else if (simulated.dns === "error" || simulated.ssl === "error") {
        stopPoll();
        setFlowStep("error");
        setNotice("Falha na verificação de DNS/SSL. Confira os registros e tente novamente.");
        setNoticeKind("bad");
      }
    } catch {
      stopPoll();
      setFlowStep("error");
      setNoticeKind("bad");
      setNotice("Não foi possível consultar o status de DNS/SSL.");
    }
  }, [siteId, stopPoll, simulateDnsSsl]);

  const startDnsPoll = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => void pollDnsSsl(), 4000);
    void pollDnsSsl();
  }, [pollDnsSsl]);

  const checkAndSetDomain = useCallback(async () => {
    if (!domainIsValid()) return;
    setBusy(true);
    setFlowStep("domain");
    setNotice("Validando domínio…");
    setNoticeKind("info");
    try {
      // TODO: substituir pelo endpoint real do backend (ex.: POST /api/backend/sites/:id/domain)
      // const data = await api<{ ok: boolean; domain: string }>(`/sites/${siteId}/domain`, {
      //   method: "POST",
      //   body: JSON.stringify({ domain: domain.trim().toLowerCase() }),
      // });
      await new Promise((r) => setTimeout(r, 600)); // placeholder
      setFlowStep("dns");
      setDnsStatus("pending");
      setNotice("Domínio válido. Iniciando verificação de DNS…");
      setNoticeKind("info");
      void startDnsPoll();
    } catch (e) {
      setDomainError(e instanceof Error ? e.message : "Não foi possível validar o domínio.");
      setNoticeKind("bad");
    } finally {
      setBusy(false);
    }
  }, [domainIsValid, startDnsPoll, domain, siteId]);

  const retry = useCallback(() => {
    setFlowStep("dns");
    setDnsStatus("pending");
    setSslStatus("pending");
    setNotice("");
    setNoticeKind("info");
    void startDnsPoll();
  }, [startDnsPoll]);

  const deploy = useCallback(async () => {
    setBusy(true);
    setFlowStep("deploy");
    setDeployProgress(0);
    setNotice("Publicando no domínio próprio…");
    setNoticeKind("info");
    try {
      // TODO: substituir pelo endpoint real (ex.: POST /api/backend/sites/:id/domain/deploy)
      // await api(`/sites/${siteId}/domain/deploy`, { method: "POST" });
      for (let p = 0; p <= 100; p += 14) {
        setDeployProgress(p);
        await new Promise((r) => setTimeout(r, 400));
      }
      stopPoll();
      setFlowStep("done");
      setNotice("Site publicado no domínio próprio com sucesso.");
      setNoticeKind("ok");
      void onSuccess?.();
    } catch (e) {
      setFlowStep("error");
      setNoticeKind("bad");
      setNotice(e instanceof Error ? e.message : "Falha ao publicar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }, [siteId, stopPoll, onSuccess]);

  const copyRecord = useCallback(
    (value: string) => {
      navigator.clipboard.writeText(value);
      setNotice("Registro copiado.");
      setNoticeKind("ok");
      setTimeout(clearNotice, 1400);
    },
    [clearNotice]
  );

  /* ---------- render ---------- */
  if (!open) return null;

  const noPermission = !canConfigureDomain;

  const statusLabel = (s: DnsSslStatus) => {
    switch (s) {
      case "pending": return "Verificando…";
      case "verified": return "Verificado";
      case "error": return "Erro";
      default: return "—";
    }
  };
  const statusVariant = (s: DnsSslStatus) => {
    switch (s) {
      case "pending": return "muted";
      case "verified": return "ok";
      case "error": return "bad";
      default: return "muted";
    }
  };

  return (
    <section
      className="content-card sites-domain-config"
      role="region"
      aria-label="Configuração de domínio próprio"
    >
      <header className="sites-domain-head">
        <div className="sites-domain-icon">
          <Globe size={20} aria-hidden="true" />
        </div>
        <div>
          <h2 className="sites-domain-title">Conectar domínio próprio</h2>
          <p className="sites-domain-sub">
            Publique o site <strong>{siteSlug}</strong> no seu domínio, com deploy via
            Cloudflare. Somente usuários com permissão de domínio podem concluir esta etapa.
          </p>
        </div>
      </header>

      {noPermission && (
        <div role="alert" className="sites-domain-no-perm">
          <AlertCircle size={15} aria-hidden="true" />
          <span>
            Você não tem permissão para configurar domínios nesta empresa. Peça ao
            proprietário ou à administração da Véxora para liberar o módulo.
          </span>
        </div>
      )}

      {/* Etapas */}
      <ol className="sites-domain-steps" aria-label="Etapas de configuração">
        <li
          className={"sites-domain-step " + (flowStep === "domain" ? "is-current" : flowStep === "done" ? "is-done" : "is-pending")}
        >
          <span className="sites-domain-step-badge">1</span>
          <span className="sites-domain-step-label">Domínio</span>
        </li>
        <li
          className={"sites-domain-step " + (flowStep === "dns" ? "is-current" : flowStep !== "domain" && flowStep !== "done" ? "is-current" : "is-pending")}
        >
          <span className="sites-domain-step-badge">2</span>
          <span className="sites-domain-step-label">DNS e SSL</span>
        </li>
        <li
          className={"sites-domain-step " + (flowStep === "deploy" ? "is-current" : flowStep === "done" ? "is-done" : "is-pending")}
        >
          <span className="sites-domain-step-badge">3</span>
          <span className="sites-domain-step-label">Deploy</span>
        </li>
        <li
          className={"sites-domain-step " + (flowStep === "done" ? "is-current" : "is-pending")}
        >
          <span className="sites-domain-step-badge">4</span>
          <span className="sites-domain-step-label">Concluído</span>
        </li>
      </ol>

      {/* Erro global */}
      {flowStep === "error" && (
        <div role="alert" className="sites-domain-error">
          <AlertCircle size={17} aria-hidden="true" />
          <div>
            <strong>Não foi possível completar a configuração.</strong>
            <p>{notice}</p>
          </div>
          <button type="button" className="primary-button" disabled={busy} onClick={() => {
            setFlowStep("domain");
            setNotice("");
          }}>
            <RefreshCw size={14} aria-hidden="true" /> Tentar novamente
          </button>
        </div>
      )}

      {/* Passo 1: domínio */}
      {flowStep === "domain" && (
        <section className="sites-domain-field-block" aria-label="Passo 1 — Domínio">
          <div className="sites-domain-field-label">
            <span className="sites-domain-field-tag">Seu domínio</span>
            <span>Endereço que os visitantes usarão para acessar o site.</span>
          </div>
          <div className="sites-domain-input-group">
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="none"
              value={domain}
              onChange={handleDomainChange}
              placeholder={DOMAIN_PLACEHOLDER}
              maxLength="253"
              disabled={busy || noPermission}
              aria-invalid={!!domainError}
              aria-describedby="domain-error domain-hint"
            />
            {domainError ? (
              <AlertCircle size={15} className="sites-domain-input-alert" aria-hidden="true" />
            ) : (
              <Zap size={15} className="sites-domain-input-ok" aria-hidden="true" />
            )}
            <button
              type="button"
              className="primary-button"
              disabled={busy || noPermission || !domain.trim()}
              onClick={checkAndSetDomain}
            >
              {busy ? <Loader2 size={15} className="vx-spin" aria-hidden="true" /> : null}
              {busy ? "Verificando…" : "Validar domínio"}
            </button>
          </div>
          {domainError && (
            <p id="domain-error" className="sites-domain-error-text" role="alert">
              {domainError}
            </p>
          )}
          <p id="domain-hint" className="sites-domain-field-hint">
            Exemplo: <code>loja.suaempresa.com.br</code>. O domínio deve ser de sua titularidade.
          </p>
        </section>
      )}

      {/* Passo 2: DNS/SSL */}
      {(flowStep === "dns" || flowStep === "ssl") && (
        <section className="sites-domain-field-block" aria-label="Passo 2 — DNS e SSL">
          <div className="sites-domain-status-row">
            <div className="sites-domain-status-card">
              <div className="sites-domain-status-head">
                <Shield size={16} aria-hidden="true" />
                <span className="sites-domain-status-name">DNS</span>
                <span className={`sites-domain-status-pill is-${statusVariant(dnsStatus)}`}>
                  {statusLabel(dnsStatus)}
                </span>
              </div>
              <p className="sites-domain-status-desc">
                Configure os registros na sua conta Cloudflare para apontar este domínio
                para a Véxora.
              </p>
            </div>
            <div className="sites-domain-status-card">
              <div className="sites-domain-status-head">
                <Cloud size={16} aria-hidden="true" />
                <span className="sites-domain-status-name">SSL / TLS</span>
                <span className={`sites-domain-status-pill is-${statusVariant(sslStatus)}`}>
                  {statusLabel(sslStatus)}
                </span>
              </div>
              <p className="sites-domain-status-desc">
                Certificado automático provisionado após a confirmação do DNS.
              </p>
            </div>
          </div>

          <div className="sites-domain-records">
            <h3 className="sites-domain-records-title">Registros a configurar na Cloudflare</h3>
            <p className="sites-domain-records-hint">
              Em seu painel da Cloudflare, crie os registros abaixo no domínio{" "}
              <code>{domain.trim() || DOMAIN_PLACEHOLDER}</code>. Após criar, aguarde a
              verificação automática (pode levar alguns minutos).
            </p>
            <table className="sites-domain-records-table" aria-label="Registros DNS">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Nome</th>
                  <th>Valor / destino</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {dnsRecords.length ? (
                  dnsRecords.map((rec, i) => (
                    <tr key={i}>
                      <td className="sites-domain-records-type">{rec.type}</td>
                      <td>{rec.name}</td>
                      <td>
                        <div className="sites-domain-records-value">
                          {rec.value}
                          <button
                            type="button"
                            className="icon-button"
                            aria-label="Copiar valor do registro"
                            onClick={() => copyRecord(rec.value)}
                          >
                            <Copy size={13} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="sites-domain-records-empty">
                      Os registros aparecerão após a validação do domínio.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="sites-domain-instructions">
            <h3 className="sites-domain-instructions-title">Como criar os registros na Cloudflare</h3>
            <ol className="sites-domain-instructions-list">
              <li>
                Acesse sua conta na Cloudflare e selecione o domínio <code>{domain.trim() || "seu-domínio.com.br"}</code>.
              </li>
              <li>
                Vá em <strong>DNS → Registros</strong> e clique em <strong>Adicionar registro</strong>.
              </li>
              <li>
                Crie um registro <strong>CNAME</strong> (ou ANAME para o domínio raiz) apontando{" "}
                <strong>{CNAME_TARGET}</strong>. Desative o proxy ("DNS apenas") até a verificação passar.
              </li>
              <li>
                Salve o registro e aguarde. A Véxora confere o DNS automaticamente e avisa quando
                estiver válido. Você pode clicar em <strong>Verificar agora</strong> a qualquer momento.
              </li>
            </ol>
            <div className="sites-domain-cname-box">
              <span className="sites-domain-cname-label">Destino (CNAME / ANAME)</span>
              <div className="sites-domain-cname-value">{CNAME_TARGET}</div>
              <button
                type="button"
                className="icon-button"
                aria-label="Copiar destino CNAME"
                onClick={() => copyRecord(CNAME_TARGET)}
              >
                <Copy size={13} aria-hidden="true" />
              </button>
            </div>
            <div className="sites-domain-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={busy || dnsStatus === "pending" || noPermission}
                onClick={retry}
              >
                <RefreshCw size={14} aria-hidden="true" /> Verificar agora
              </button>
              {dnsStatus === "verified" && sslStatus === "verified" && (
                <button
                  type="button"
                  className="primary-button"
                  disabled={busy || noPermission}
                  onClick={deploy}
                >
                  {busy ? <Loader2 size={15} className="vx-spin" aria-hidden="true" /> : null}
                  {busy ? "Publicando…" : "Publicar no domínio"}
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Passo 3: deploy */}
      {flowStep === "deploy" && (
        <section className="sites-domain-field-block" aria-label="Passo 3 — Deploy">
          <div className="sites-domain-field-label">
            <span className="sites-domain-field-tag">Publicando</span>
            <span>Seu site está sendo ativado no domínio próprio.</span>
          </div>
          <div className="sites-domain-progress">
            <div className="sites-domain-progress-track" role="progressbar" aria-valuenow={deployProgress} aria-valuemin={0} aria-valuemax={100}>
              <span className="sites-domain-progress-bar" style={{ width: `${deployProgress}%` }}></span>
            </div>
            <span className="sites-domain-progress-pct">{deployProgress}%</span>
          </div>
          <p className="sites-domain-field-hint">
            O deploy costuma levar menos de um minuto. Você será avisado quando o site estiver
            acessível em <code>{domain.trim() || DOMAIN_PLACEHOLDER}</code>.
          </p>
        </section>
      )}

      {/* Passo 4: concluído */}
      {flowStep === "done" && (
        <section className="sites-domain-field-block sites-domain-done" aria-label="Passo 4 — Concluído">
          <div className="sites-domain-done-icon">
            <CheckCircle2 size={32} aria-hidden="true" />
          </div>
          <h3 className="sites-domain-done-title">Domínio conectado</h3>
          <p className="sites-domain-done-sub">
            O site <strong>{siteSlug}</strong> está publicado no domínio{" "}
            <code>{domain.trim() || DOMAIN_PLACEHOLDER}</code> com SSL ativo.
          </p>
          <div className="sites-domain-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Fechar
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                window.open(`https://${domain.trim() || DOMAIN_PLACEHOLDER}`, "_blank");
              }}
            >
              <ExternalLink size={14} aria-hidden="true" /> Ver site publicado
            </button>
          </div>
        </section>
      )}

      {/* Rodapé para os passos intermediários */}
      {flowStep === "domain" && (
        <footer className="sites-domain-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={busy || noPermission || !domain.trim() || !!domainError}
            onClick={checkAndSetDomain}
          >
            Avançar para DNS e SSL
          </button>
        </footer>
      )}
      {(flowStep === "dns" || flowStep === "ssl") && (
        <footer className="sites-domain-footer">
          <button type="button" className="secondary-button" onClick={() => setFlowStep("domain")}>
            Voltar ao domínio
          </button>
          {dnsStatus === "verified" && sslStatus === "verified" && (
            <button type="button" className="primary-button" disabled={busy || noPermission} onClick={deploy}>
              Publicar no domínio
            </button>
          )}
        </footer>
      )}
    </section>
  );
}
