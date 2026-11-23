"use client";
import { useEffect, useState } from "react";
import { CreditCard, Wallet } from "lucide-react";

type StripeSettings = {
  enabled: boolean; configured: boolean; secretKeyMasked: string; publishableKey: string;
  environment: "TEST" | "LIVE"; webhookSecretConfigured: boolean; webhookUrl: string;
};
type InfinitePaySettings = {
  enabled: boolean; configured: boolean; handle: string; apiKeyConfigured: boolean;
  apiKeyMasked: string; environment: "PRODUCTION"; webhookUrl: string;
  sandboxAvailable: boolean; recurringAvailable: boolean;
};
const stripeEmpty: StripeSettings = { enabled: false, configured: false, secretKeyMasked: "", publishableKey: "", environment: "TEST", webhookSecretConfigured: false, webhookUrl: "" };
const infiniteEmpty: InfinitePaySettings = { enabled: false, configured: false, handle: "", apiKeyConfigured: false, apiKeyMasked: "", environment: "PRODUCTION", webhookUrl: "", sandboxAvailable: false, recurringAvailable: false };

const sectionTw = "grid content-start gap-3 rounded-token border border-gray-200 bg-zinc-100 p-pad shadow-token";
const headingTw = "flex items-center gap-3 border-b border-gray-200 pb-3";
const iconTw = "grid h-8 w-8 flex-none place-items-center rounded-token-sm bg-blue-50 text-blue-800";
const titleTw = "text-h4 font-extrabold tracking-tight text-slate-950";
const noteTw = "text-small leading-relaxed text-slate-600";
const labelTw = "grid gap-1.5 text-2xs font-extrabold uppercase tracking-wider text-slate-600";
const inputTw = "min-h-control w-full min-w-0 rounded-token-sm border border-gray-200 bg-zinc-100 px-2.5 py-1.5 text-channels-field text-slate-950 placeholder:text-slate-400 focus:border-blue-600 focus:outline-hidden focus:ring-2 focus:ring-blue-600/25";
const primaryButton = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-4 text-body font-bold text-blue-900 shadow-token-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm border border-gray-200 bg-zinc-200 px-4 text-body font-bold text-slate-950 shadow-token-sm transition-colors hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-60";
const actionsTw = "flex flex-wrap gap-2";
const alertTw = "rounded-channels-alert border border-blue-600 bg-blue-50 px-3.5 py-3 text-channels-field text-blue-800";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(Array.isArray(body.message) ? body.message.join(" ") : body.message || body.error || "Não foi possível concluir a operação agora. Tente novamente; se continuar falhando, avise a administração.");
  }
  return body as T;
}

function WebhookUrl({ value, label }: { value: string; label: string }) {
  if (!value) return null;
  return <p className={noteTw}>{label}: <code className="break-all text-slate-950">{value}</code></p>;
}

export function PaymentProvidersSettings({ canConfigure }: { canConfigure: boolean }) {
  const [stripe, setStripe] = useState<StripeSettings>(stripeEmpty);
  const [infinite, setInfinite] = useState<InfinitePaySettings>(infiniteEmpty);
  const [stripeKey, setStripeKey] = useState("");
  const [stripeWebhook, setStripeWebhook] = useState("");
  const [stripePublishable, setStripePublishable] = useState("");
  const [handle, setHandle] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setError("");
    try {
      const [s, i] = await Promise.all([
        api<StripeSettings>("/api/backend/integrations/stripe"),
        api<InfinitePaySettings>("/api/backend/integrations/infinitepay"),
      ]);
      setStripe(s);
      setInfinite(i);
      setStripePublishable(s.publishableKey || "");
      setHandle(i.handle || "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar as integrações de pagamento.");
    }
  }

  useEffect(() => { void load(); }, []);

  async function save(endpoint: "stripe" | "infinitepay", body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/api/backend/integrations/${endpoint}`, {
        method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      setNotice("Configuração salva. A confirmação de pagamentos depende dos eventos recebidos do provedor.");
      setStripeKey("");
      setStripeWebhook("");
      setApiKey("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar a configuração.");
    } finally {
      setBusy(false);
    }
  }

  async function test(endpoint: "stripe" | "infinitepay") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ connected?: boolean; verified?: boolean; message?: string; environment?: string }>(
        `/api/backend/integrations/${endpoint}/test-connection`, { method: "POST" },
      );
      setNotice(result.connected ? `Credenciais aceitas em ${result.environment || "ambiente informado"}.` : result.message || "Nenhuma conexão ao vivo foi confirmada.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível verificar a integração.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="grid content-start gap-token">
    <section className={sectionTw}>
      <div className={headingTw}><span className={iconTw}><CreditCard size={16} aria-hidden="true" /></span><div><h2 className={titleTw}>Stripe</h2><p className={noteTw}>Cartões e PaymentIntent com webhook assinado.</p></div></div>
      <p className={noteTw}>Status: {stripe.configured ? `credencial configurada (${stripe.environment})` : "sem credencial configurada"}. Chave pública: {stripe.publishableKey || "não informada"}.</p>
      <WebhookUrl value={stripe.webhookUrl} label="URL do webhook" />
      <p className={noteTw}>Registre essa URL no Stripe e use o segredo <code>whsec_</code> do endpoint. A assinatura é verificada com o corpo cru e tolerância de 5 minutos.</p>
      {canConfigure ? <div className="grid gap-3">
        <label className={labelTw}>Chave pública<input className={inputTw} value={stripePublishable} onChange={(event) => setStripePublishable(event.target.value)} placeholder="pk_test_…" maxLength={200} /></label>
        <label className={labelTw}>Chave secreta<input className={inputTw} type="password" value={stripeKey} onChange={(event) => setStripeKey(event.target.value)} placeholder={stripe.configured ? "•••••••••••• (manter atual)" : "sk_test_…"} maxLength={500} /></label>
        <label className={labelTw}>Segredo do webhook<input className={inputTw} type="password" value={stripeWebhook} onChange={(event) => setStripeWebhook(event.target.value)} placeholder={stripe.webhookSecretConfigured ? "•••••••••••• (manter atual)" : "whsec_…"} maxLength={500} /></label>
        <div className={actionsTw}>
          <button type="button" className={secondaryButton} disabled={busy} onClick={() => void test("stripe")}>Testar credenciais</button>
          <button type="button" className={primaryButton} disabled={busy} onClick={() => void save("stripe", {
            enabled: !stripe.enabled, environment: stripe.environment, publishableKey: stripePublishable,
            ...(stripeKey ? { secretKey: stripeKey } : {}), ...(stripeWebhook ? { webhookSecret: stripeWebhook } : {}),
          })}>{stripe.enabled ? "Desativar Stripe" : "Ativar Stripe"}</button>
        </div>
      </div> : null}
    </section>
    <section className={sectionTw}>
      <div className={headingTw}><span className={iconTw}><Wallet size={16} aria-hidden="true" /></span><div><h2 className={titleTw}>InfinitePay</h2><p className={noteTw}>Links de pagamento com confirmação por payment_check.</p></div></div>
      <p className={noteTw}>Status: {infinite.configured ? `configurada${infinite.handle ? ` como @${infinite.handle}` : ""}` : "sem credencial configurada"}. Sem sandbox e sem recorrência pela API.</p>
      <WebhookUrl value={infinite.webhookUrl} label="URL do webhook" />
      <p className={noteTw}>O webhook não tem assinatura: nenhum pagamento é marcado como pago apenas pelo aviso. A confirmação exige consulta ao payment_check com valor original conferido.</p>
      {canConfigure ? <div className="grid gap-3">
        <label className={labelTw}>InfiniteTag (handle)<input className={inputTw} value={handle} onChange={(event) => setHandle(event.target.value)} placeholder="seu-handle" maxLength={64} /></label>
        <label className={labelTw}>API Key<input className={inputTw} type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={infinite.apiKeyConfigured ? "•••••••••••• (manter atual)" : "inchk_…"} maxLength={500} /></label>
        <div className={actionsTw}>
          <button type="button" className={secondaryButton} disabled={busy} onClick={() => void test("infinitepay")}>Verificar configuração</button>
          <button type="button" className={primaryButton} disabled={busy} onClick={() => void save("infinitepay", {
            enabled: !infinite.enabled, handle, ...(apiKey ? { apiKey } : {}),
          })}>{infinite.enabled ? "Desativar InfinitePay" : "Ativar InfinitePay"}</button>
        </div>
      </div> : null}
    </section>
    {error ? <p className={alertTw} role="alert">{error}</p> : null}
    {notice ? <p className={alertTw} role="status">{notice}</p> : null}
  </div>;
}
