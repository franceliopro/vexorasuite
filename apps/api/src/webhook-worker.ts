import { PrismaClient } from "@prisma/client";
import { assertWebhookTargetSafe, decryptWebhookSecret, signWebhookPayload } from "./operations/webhook-crypto";

const prisma = new PrismaClient();
const intervalMs = Math.max(1000, Number(process.env.WEBHOOK_WORKER_INTERVAL_MS || 2000));
const batchSize = Math.max(1, Math.min(100, Number(process.env.WEBHOOK_WORKER_BATCH_SIZE || 25)));
const maxAttempts = 3;
let lastRealtimeCleanupAt = 0;

type ClaimedDelivery = { id: string };

async function claimBatch(): Promise<string[]> {
  const rows = await prisma.$queryRaw<ClaimedDelivery[]>`
    WITH candidates AS (
      SELECT id
      FROM webhook_deliveries
      WHERE (status IN ('PENDING', 'RETRYING') AND next_attempt_at <= NOW())
         OR (status = 'PROCESSING' AND updated_at < NOW() - INTERVAL '10 minutes')
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${batchSize}
    )
    UPDATE webhook_deliveries AS delivery
    SET status = 'PROCESSING', updated_at = NOW()
    FROM candidates
    WHERE delivery.id = candidates.id
    RETURNING delivery.id
  `;
  return rows.map((row) => row.id);
}

async function markFailed(id: string, error: string): Promise<void> {
  await prisma.webhookDelivery.update({
    where: { id },
    data: { status: "FAILED", attempts: maxAttempts, lastError: error.slice(0, 240), updatedAt: new Date() },
  });
}

async function processDelivery(id: string): Promise<void> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id },
    include: { subscription: true },
  });
  if (!delivery) return;
  if (!delivery.subscription.active) {
    await markFailed(id, "A assinatura do webhook está desativada.");
    return;
  }

  const payload = JSON.stringify(delivery.payload);
  let secret: string;
  try {
    secret = decryptWebhookSecret(delivery.subscription.secretCiphertext);
  } catch {
    await markFailed(id, "Não foi possível descriptografar o segredo do webhook.");
    return;
  }

  const nextAttempt = delivery.attempts + 1;
  try {
    await assertWebhookTargetSafe(delivery.subscription.url);
    const response = await fetch(delivery.subscription.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-vexora-event": "sha256=" + signWebhookPayload(secret, payload),
      },
      body: payload,
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    await prisma.webhookDelivery.update({
      where: { id },
      data: { status: "DELIVERED", attempts: nextAttempt, responseStatus: response.status, lastError: null },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na entrega.";
    const exhausted = nextAttempt >= maxAttempts;
    await prisma.webhookDelivery.update({
      where: { id },
      data: {
        status: exhausted ? "FAILED" : "RETRYING",
        attempts: nextAttempt,
        responseStatus: null,
        lastError: message.slice(0, 240),
        nextAttemptAt: new Date(Date.now() + (exhausted ? 0 : Math.min(60, 5 * 2 ** (nextAttempt - 1)) * 1000)),
      },
    });
  }
}

async function cleanupRealtimeEvents(): Promise<void> {
  if (Date.now() - lastRealtimeCleanupAt < 60_000) return;
  await prisma.$executeRaw`DELETE FROM realtime_events WHERE expires_at <= NOW()`;
  lastRealtimeCleanupAt = Date.now();
}

async function drain(): Promise<void> {
  await cleanupRealtimeEvents();
  const ids = await claimBatch();
  await Promise.all(ids.map((id) => processDelivery(id)));
}

async function shutdown(signal: string): Promise<void> {
  console.log("Webhook worker encerrando (" + signal + ").");
  await prisma.$disconnect();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

async function main(): Promise<void> {
  await prisma.$connect();
  console.log("Webhook worker ativo (intervalo " + intervalMs + "ms).");
  while (true) {
    try {
      await drain();
    } catch (error) {
      console.error("Falha no ciclo do webhook worker:", error);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

void main().catch(async (error) => {
  console.error("Webhook worker não pôde iniciar:", error);
  await prisma.$disconnect();
  process.exit(1);
});