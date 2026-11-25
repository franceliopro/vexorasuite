/** Token de injeção do cliente de submissões selecionado por configuração. */
export const SUBMISSIONS_CLIENT = "SUBMISSIONS_CLIENT";

/**
 * Formato normalizado de uma submissão, independente do CMS de origem.
 *
 * `tenantId` é sempre preenchido pelo cliente. A Véxora deriva o tenant da
 * sessão e nunca aceita um tenant informado pelo navegador.
 */
export interface SubmissionRecord {
  id: string;
  tenantId: string;
  submission_key: string;
  name: string;
  email: string;
  phone: string | null;
  payload: Record<string, unknown>;
  status: string;
  rejection_reason: string | null;
  property_id: string | null;
  date_created: string;
  date_updated: string | null;
}

export type SubmissionDecision = "APPROVED" | "REJECTED";

/**
 * Contrato único para os clientes de submissões. O tenant é passado em todas
 * as chamadas: o cliente é singleton e não pode guardar "o tenant atual" sem
 * vazar dados entre requisições concorrentes.
 */
export interface SubmissionsClient {
  assertConfigured(tenantId: string): void;
  listPending(tenantId: string): Promise<SubmissionRecord[]>;
  findByKey(tenantId: string, submissionKey: string): Promise<SubmissionRecord | null>;
  decide(tenantId: string, id: string, decision: SubmissionDecision, reason: string | null): Promise<void>;
}

/**
 * Directus continua sendo o padrão até a instância Payload ser validada.
 * A troca é explícita (`SUBMISSIONS_PROVIDER=payload`) e reversível por config.
 */
export function createSubmissionsClient(
  directus: SubmissionsClient,
  payload: SubmissionsClient,
  provider: string = (process.env.SUBMISSIONS_PROVIDER ?? "directus").trim().toLowerCase(),
): SubmissionsClient {
  const selected = provider.trim().toLowerCase();
  if (selected === "directus") return directus;
  if (selected === "payload") return payload;
  throw new Error("SUBMISSIONS_PROVIDER deve ser 'directus' ou 'payload'.");
}
