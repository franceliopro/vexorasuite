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

/* TW utility-first: cores e medidas vêm do preset e dos tokens de tema. */
const rootTw = "grid min-w-0 gap-token rounded-token border border-gray-200 bg-zinc-100 p-pad shadow-token";
const headTw = "flex flex-wrap items-start gap-3";
const iconTw = "grid size-10 shrink-0 place-items-center rounded-token bg-blue-50 text-blue-800";
const titleTw = "text-h3 font-bold text-slate-950";
const subTw = "text-small text-slate-600";
const noPermTw = "flex items-start gap-2 rounded-token-sm border border-red-600 bg-red-100 p-3 text-small text-red-600";
const stepsTw = "grid grid-cols-2 gap-2 p-0 list-none md:grid-cols-4";
const stepTw = "flex items-center gap-2 text-small font-semibold text-slate-600";
const stepBadgeTw = "grid size-6 shrink-0 place-items-center rounded-full bg-zinc-200 text-h6 font-bold text-slate-950";
const stepLabelTw = "min-w-0";
const stepStateTw: Record<string, string> = {
  current: "text-blue-800",
  done: "text-emerald-600",
  pending: "text-slate-600 opacity-70",
};
const stepBadgeStateTw: Record<string, string> = {
  current: "bg-blue-600 text-blue-50",
  done: "bg-emerald-100 text-emerald-600",
  pending: "bg-zinc-200 text-slate-600",
};
const stepClass = (state: string) => `${stepTw} ${stepStateTw[state] ?? stepStateTw.pending}`;
const stepBadgeClass = (state: string) => `${stepBadgeTw} ${stepBadgeStateTw[state] ?? stepBadgeStateTw.pending}`;
const errorTw = "flex items-start gap-3 rounded-token-sm border border-red-600 bg-red-100 p-3 text-slate-950";
const fieldBlockTw = "grid gap-3";
const fieldLabelTw = "grid gap-1";
const fieldTagTw = "text-small font-bold text-slate-950";
const inputGroupTw = "flex flex-wrap items-center gap-2";
const inputTw = "min-h-control min-w-0 flex-1 rounded-token-sm border border-gray-200 bg-zinc-50 px-3 text-body text-slate-950 outline-hidden placeholder:text-slate-600 focus:border-blue-600 focus:ring-2 focus:ring-blue-50";
const inputAlertTw = "shrink-0 text-red-600";
const inputOkTw = "shrink-0 text-emerald-600";
const errorTextTw = "text-small text-red-600";
const fieldHintTw = "text-small text-slate-600";
const statusRowTw = "grid grid-cols-1 gap-3 md:grid-cols-2";
const statusCardTw = "grid gap-2 rounded-token-sm border border-gray-200 bg-zinc-100 p-3";
const statusHeadTw = "flex flex-wrap items-center gap-2";
const statusNameTw = "text-small font-bold text-slate-950";
const statusPillTw = "inline-flex items-center rounded-full px-2 py-1 text-h6 font-bold";
const statusPillVariantTw: Record<string, string> = {
  muted: "bg-zinc-200 text-slate-600",
  ok: "bg-emerald-100 text-emerald-600",
  bad: "bg-red-100 text-red-600",
};
const statusPillClass = (variant: string) => `${statusPillTw} ${statusPillVariantTw[variant] ?? statusPillVariantTw.muted}`;
const statusDescTw = "text-small text-slate-600";
const recordsTw = "grid gap-2";
const recordsTitleTw = "text-h3 font-bold text-slate-950";
const recordsHintTw = "text-small text-slate-600";
const recordsTableTw = "w-full border-collapse text-small text-slate-950";
const recordsTypeTw = "font-bold text-slate-950";
const recordsValueTw = "flex flex-wrap items-center gap-2";
const recordsEmptyTw = "p-3 text-center text-slate-600";
const instructionsTw = "grid gap-2";
const instructionsTitleTw = "text-h3 font-bold text-slate-950";
const instructionsListTw = "grid list-decimal gap-1 pl-5 text-small text-slate-600";
const cnameBoxTw = "flex flex-wrap items-center gap-2 rounded-token-sm border border-gray-200 bg-zinc-100 p-3";
const cnameLabelTw = "text-small font-bold text-slate-950";
const cnameValueTw = "min-w-0 flex-1 break-all font-mono text-small";
const progressTw = "flex flex-wrap items-center gap-3";
const progressTrackTw = "h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-200";
const progressBarTw = "block h-full rounded-full bg-blue-600 transition-all duration-300";
const progressPctTw = "text-small font-bold tabular-nums text-slate-950";
const doneTw = "grid place-items-center gap-2 text-center";
const doneIconTw = "text-emerald-600";
const doneTitleTw = "text-h2 font-bold text-slate-950";
const doneSubTw = "text-small text-slate-600";
const actionsTw = "flex flex-wrap items-center justify-end gap-2";
const footerTw = "flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 pt-3";
const primaryTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-brand-pad font-bold text-body text-blue-950 transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";
const secondaryTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm border border-gray-200 bg-zinc-200 px-brand-pad font-bold text-body text-slate-950 shadow-token-sm transition-colors hover:border-gray-300 hover:bg-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";
const iconButtonTw = "grid size-control shrink-0 place-items-center rounded-token-sm border border-gray-200 bg-zinc-100 text-slate-950 shadow-token-sm transition-colors hover:bg-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";


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
    const ssl: DnsSslStatus = dns === "verified" ? "verified" : "error";
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

  const domainStepState = flowStep === "domain" ? "current" : flowStep === "done" ? "done" : "pending";
  const dnsStepState = flowStep === "dns" || (flowStep !== "domain" && flowStep !== "done") ? "current" : "pending";
  const deployStepState = flowStep === "deploy" ? "current" : flowStep === "done" ? "done" : "pending";
  const doneStepState = flowStep === "done" ? "current" : "pending";
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
      className={rootTw}
      role="region"
      aria-label="Configuração de domínio próprio"
    >
      <header className={headTw}>
        <div className={iconTw}>
          <Globe size={20} aria-hidden="true" />
        </div>
        <div>
          <h2 className={titleTw}>Conectar domínio próprio</h2>
          <p className={subTw}>
            Publique o site <strong>{siteSlug}</strong> no seu domínio, com deploy via
            Cloudflare. Somente usuários com permissão de domínio podem concluir esta etapa.
          </p>
        </div>
      </header>

      {noPermission && (
        <div role="alert" className={noPermTw}>
          <AlertCircle size={15} aria-hidden="true" />
          <span>
            Você não tem permissão para configurar domínios nesta empresa. Peça ao
            proprietário ou à administração da Véxora para liberar o módulo.
          </span>
        </div>
      )}

      {/* Etapas */}
      <ol className={stepsTw} aria-label="Etapas de configuração">
        <li
          className={stepClass(domainStepState)}
        >
          <span className={stepBadgeClass(domainStepState)}>1</span>
          <span className={stepLabelTw}>Domínio</span>
        </li>
        <li
          className={stepClass(dnsStepState)}
        >
          <span className={stepBadgeClass(dnsStepState)}>2</span>
          <span className={stepLabelTw}>DNS e SSL</span>
        </li>
        <li
          className={stepClass(deployStepState)}
        >
          <span className={stepBadgeClass(deployStepState)}>3</span>
          <span className={stepLabelTw}>Deploy</span>
        </li>
        <li
          className={stepClass(doneStepState)}
        >
          <span className={stepBadgeClass(doneStepState)}>4</span>
          <span className={stepLabelTw}>Concluído</span>
        </li>
      </ol>

      {/* Erro global */}
      {flowStep === "error" && (
        <div role="alert" className={errorTw}>
          <AlertCircle size={17} aria-hidden="true" />
          <div>
            <strong>Não foi possível completar a configuração.</strong>
            <p>{notice}</p>
          </div>
          <button type="button" className={primaryTw} disabled={busy} onClick={() => {
            setFlowStep("domain");
            setNotice("");
          }}>
            <RefreshCw size={14} aria-hidden="true" /> Tentar novamente
          </button>
        </div>
      )}

      {/* Passo 1: domínio */}
      {flowStep === "domain" && (
        <section className={fieldBlockTw} aria-label="Passo 1 — Domínio">
          <div className={fieldLabelTw}>
            <span className={fieldTagTw}>Seu domínio</span>
            <span>Endereço que os visitantes usarão para acessar o site.</span>
          </div>
          <div className={inputGroupTw}>
            <input
              className={inputTw}
              type="text"
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="none"
              value={domain}
              onChange={handleDomainChange}
              placeholder={DOMAIN_PLACEHOLDER}
              maxLength={253}
              disabled={busy || noPermission}
              aria-invalid={!!domainError}
              aria-describedby="domain-error domain-hint"
            />
            {domainError ? (
              <AlertCircle size={15} className={inputAlertTw} aria-hidden="true" />
            ) : (
              <Zap size={15} className={inputOkTw} aria-hidden="true" />
            )}
            <button
              type="button"
              className={primaryTw}
              disabled={busy || noPermission || !domain.trim()}
              onClick={checkAndSetDomain}
            >
              {busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null}
              {busy ? "Verificando…" : "Validar domínio"}
            </button>
          </div>
          {domainError && (
            <p id="domain-error" className={errorTextTw} role="alert">
              {domainError}
            </p>
          )}
          <p id="domain-hint" className={fieldHintTw}>
            Exemplo: <code>loja.suaempresa.com.br</code>. O domínio deve ser de sua titularidade.
          </p>
        </section>
      )}

      {/* Passo 2: DNS/SSL */}
      {(flowStep === "dns" || flowStep === "ssl") && (
        <section className={fieldBlockTw} aria-label="Passo 2 — DNS e SSL">
          <div className={statusRowTw}>
            <div className={statusCardTw}>
              <div className={statusHeadTw}>
                <Shield size={16} aria-hidden="true" />
                <span className={statusNameTw}>DNS</span>
                <span className={statusPillClass(statusVariant(dnsStatus))}>
                  {statusLabel(dnsStatus)}
                </span>
              </div>
              <p className={statusDescTw}>
                Configure os registros na sua conta Cloudflare para apontar este domínio
                para a Véxora.
              </p>
            </div>
            <div className={statusCardTw}>
              <div className={statusHeadTw}>
                <Cloud size={16} aria-hidden="true" />
                <span className={statusNameTw}>SSL / TLS</span>
                <span className={statusPillClass(statusVariant(sslStatus))}>
                  {statusLabel(sslStatus)}
                </span>
              </div>
              <p className={statusDescTw}>
                Certificado automático provisionado após a confirmação do DNS.
              </p>
            </div>
          </div>

          <div className={recordsTw}>
            <h3 className={recordsTitleTw}>Registros a configurar na Cloudflare</h3>
            <p className={recordsHintTw}>
              Em seu painel da Cloudflare, crie os registros abaixo no domínio{" "}
              <code>{domain.trim() || DOMAIN_PLACEHOLDER}</code>. Após criar, aguarde a
              verificação automática (pode levar alguns minutos).
            </p>
            <table className={recordsTableTw} aria-label="Registros DNS">
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
                      <td className={recordsTypeTw}>{rec.type}</td>
                      <td>{rec.name}</td>
                      <td>
                        <div className={recordsValueTw}>
                          {rec.value}
                          <button
                            type="button"
                            className={iconButtonTw}
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
                    <td colSpan={4} className={recordsEmptyTw}>
                      Os registros aparecerão após a validação do domínio.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className={instructionsTw}>
            <h3 className={instructionsTitleTw}>Como criar os registros na Cloudflare</h3>
            <ol className={instructionsListTw}>
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
            <div className={cnameBoxTw}>
              <span className={cnameLabelTw}>Destino (CNAME / ANAME)</span>
              <div className={cnameValueTw}>{CNAME_TARGET}</div>
              <button
                type="button"
                className={iconButtonTw}
                aria-label="Copiar destino CNAME"
                onClick={() => copyRecord(CNAME_TARGET)}
              >
                <Copy size={13} aria-hidden="true" />
              </button>
            </div>
            <div className={actionsTw}>
              <button
                type="button"
                className={secondaryTw}
                disabled={busy || dnsStatus === "pending" || noPermission}
                onClick={retry}
              >
                <RefreshCw size={14} aria-hidden="true" /> Verificar agora
              </button>
              {dnsStatus === "verified" && sslStatus === "verified" && (
                <button
                  type="button"
                  className={primaryTw}
                  disabled={busy || noPermission}
                  onClick={deploy}
                >
                  {busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null}
                  {busy ? "Publicando…" : "Publicar no domínio"}
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Passo 3: deploy */}
      {flowStep === "deploy" && (
        <section className={fieldBlockTw} aria-label="Passo 3 — Deploy">
          <div className={fieldLabelTw}>
            <span className={fieldTagTw}>Publicando</span>
            <span>Seu site está sendo ativado no domínio próprio.</span>
          </div>
          <div className={progressTw}>
            <div className={progressTrackTw} role="progressbar" aria-valuenow={deployProgress} aria-valuemin={0} aria-valuemax={100}>
              <span className={progressBarTw} style={{ width: `${deployProgress}%` }}></span>
            </div>
            <span className={progressPctTw}>{deployProgress}%</span>
          </div>
          <p className={fieldHintTw}>
            O deploy costuma levar menos de um minuto. Você será avisado quando o site estiver
            acessível em <code>{domain.trim() || DOMAIN_PLACEHOLDER}</code>.
          </p>
        </section>
      )}

      {/* Passo 4: concluído */}
      {flowStep === "done" && (
        <section className={doneTw} aria-label="Passo 4 — Concluído">
          <div className={doneIconTw}>
            <CheckCircle2 size={32} aria-hidden="true" />
          </div>
          <h3 className={doneTitleTw}>Domínio conectado</h3>
          <p className={doneSubTw}>
            O site <strong>{siteSlug}</strong> está publicado no domínio{" "}
            <code>{domain.trim() || DOMAIN_PLACEHOLDER}</code> com SSL ativo.
          </p>
          <div className={actionsTw}>
            <button type="button" className={secondaryTw} onClick={onClose}>
              Fechar
            </button>
            <button
              type="button"
              className={primaryTw}
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
        <footer className={footerTw}>
          <button type="button" className={secondaryTw} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className={primaryTw}
            disabled={busy || noPermission || !domain.trim() || !!domainError}
            onClick={checkAndSetDomain}
          >
            Avançar para DNS e SSL
          </button>
        </footer>
      )}
      {(flowStep === "dns" || flowStep === "ssl") && (
        <footer className={footerTw}>
          <button type="button" className={secondaryTw} onClick={() => setFlowStep("domain")}>
            Voltar ao domínio
          </button>
          {dnsStatus === "verified" && sslStatus === "verified" && (
            <button type="button" className={primaryTw} disabled={busy || noPermission} onClick={deploy}>
              Publicar no domínio
            </button>
          )}
        </footer>
      )}
    </section>
  );
}
