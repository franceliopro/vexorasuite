import type { PaymentProvider } from "./payment-providers";

export type FinanceSource = "PROVIDER_LIVE" | "LOCAL_RECORDS" | "UNSUPPORTED";

export type FinanceCapabilityKey =
  | "customers"
  | "catalog"
  | "charges"
  | "reports"
  | "subscriptions"
  | "refunds"
  | "pixQrCode"
  | "whatsappCharge"
  | "sandbox";

export type FinanceCapability = {
  source: FinanceSource;
  note: string;
};

export type FinanceCapabilities = {
  customers: FinanceCapability;
  catalog: FinanceCapability;
  charges: FinanceCapability;
  reports: FinanceCapability;
  subscriptions: boolean;
  refunds: boolean;
  pixQrCode: boolean;
  whatsappCharge: boolean;
  sandbox: boolean;
};

export type FinanceProviderDescriptor = {
  provider: PaymentProvider;
  label: string;
  enabled: boolean;
  configured: boolean;
  environment: string | null;
  verification: { status: "NOT_VERIFIED"; note: string };
  capabilities: FinanceCapabilities;
  limitations: string[];
  caveat: string;
};

type StaticDescriptor = Omit<FinanceProviderDescriptor, "enabled" | "configured" | "environment" | "verification">;

export const CONFIGURATION_IS_NOT_CONNECTION = "Configuração salva não prova conexão ativa, pagamento executado ou saldo disponível; a origem de cada dado é informada na resposta.";

export const FINANCE_PROVIDER_DEFINITIONS: Record<PaymentProvider, StaticDescriptor> = {
  ASAAS: {
    provider: "ASAAS",
    label: "Asaas",
    capabilities: {
      customers: { source: "PROVIDER_LIVE", note: "Clientes sincronizados diretamente da conta Asaas da empresa." },
      catalog: { source: "PROVIDER_LIVE", note: "Produtos e serviços consultados no Asaas e no catálogo local vinculado." },
      charges: { source: "PROVIDER_LIVE", note: "Cobranças, assinaturas e faturas consultadas na API do Asaas." },
      reports: { source: "PROVIDER_LIVE", note: "Indicadores calculados sobre a carteira real do Asaas." },
      subscriptions: true,
      refunds: false,
      pixQrCode: true,
      whatsappCharge: false,
      sandbox: true,
    },
    limitations: [
      "Estorno pela API não está exposto nesta entrega.",
      "O envio da cobrança continua na inbox da Véxora; não usamos um motor externo de WhatsApp.",
    ],
    caveat: "Dados consultados no Asaas. Sandbox e produção nunca são misturados.",
  },
  STRIPE: {
    provider: "STRIPE",
    label: "Stripe",
    capabilities: {
      customers: { source: "PROVIDER_LIVE", note: "Clientes consultados na API da Stripe da empresa." },
      catalog: { source: "PROVIDER_LIVE", note: "Products e Prices consultados na API da Stripe." },
      charges: { source: "PROVIDER_LIVE", note: "PaymentIntents e sessões de checkout consultados na Stripe." },
      reports: { source: "PROVIDER_LIVE", note: "Indicadores calculados sobre PaymentIntents e transações da Stripe." },
      subscriptions: true,
      refunds: true,
      pixQrCode: false,
      whatsappCharge: false,
      sandbox: true,
    },
    limitations: [
      "Pix com QR Code não é gerado pela Stripe nesta integração.",
      "O envio da cobrança continua na inbox da Véxora; não usamos um motor externo de WhatsApp.",
    ],
    caveat: "Dados consultados na Stripe. O ambiente TEST nunca é apresentado como produção.",
  },
  INFINITEPAY: {
    provider: "INFINITEPAY",
    label: "InfinitePay",
    capabilities: {
      customers: { source: "LOCAL_RECORDS", note: "Contatos da Véxora vinculados a links InfinitePay; a API não lista clientes da conta." },
      catalog: { source: "LOCAL_RECORDS", note: "Catálogo local da Véxora enviado como itens do link; a API não gerencia produtos." },
      charges: { source: "LOCAL_RECORDS", note: "Links criados pela Véxora, confirmados por webhook e payment_check." },
      reports: { source: "LOCAL_RECORDS", note: "Indicadores parciais apenas sobre links criados pela Véxora." },
      subscriptions: false,
      refunds: false,
      pixQrCode: false,
      whatsappCharge: false,
      sandbox: false,
    },
    limitations: [
      "A API documentada cria links e consulta status; não lista vendas, clientes ou produtos da conta.",
      "Não há sandbox: validação exige compra real de valor baixo.",
      "Não há estorno, cancelamento, recorrência ou split por API.",
      "O webhook não tem assinatura; nenhum pagamento é confirmado apenas por ele.",
      "Não existe API documentada para cobrança via WhatsApp da InfinitePay.",
    ],
    caveat: "Painel local e parcial: mostra somente o que a Vexora registrou e confirmou por payment_check.",
  },
};

export function financeCapabilityAvailable(capability: FinanceCapability): boolean {
  return capability.source !== "UNSUPPORTED";
}
