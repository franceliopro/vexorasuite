import { Pool } from "pg";
import type { ConsentRecord } from "./consent.js";
import type { CallEvent, StoredMedia } from "./events.js";

export interface EventStore {
  consentFor(tenantId: string, partyHash: string, channel: string): Promise<ConsentRecord | null>;
  insertEvent(
    event: CallEvent,
    media: StoredMedia,
    consentReason: string,
  ): Promise<{ duplicate: boolean; id: string | null }>;
}

type ConsentRow = {
  tenant_id: string;
  channel: string;
  party_hash: string;
  granted_at: Date | null;
  revoked_at: Date | null;
  opted_out: boolean;
};

export class PostgresEventStore implements EventStore {
  constructor(private readonly pool: Pool) {}

  async consentFor(tenantId: string, partyHash: string, channel: string): Promise<ConsentRecord | null> {
    const result = await this.pool.query<ConsentRow>(
      `SELECT tenant_id, channel, party_hash, granted_at, revoked_at, opted_out
         FROM call_consent
        WHERE tenant_id = $1 AND channel = $2 AND party_hash = $3`,
      [tenantId, channel, partyHash],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      tenantId: row.tenant_id,
      channel: row.channel,
      partyHash: row.party_hash,
      grantedAt: row.granted_at,
      revokedAt: row.revoked_at,
      optedOut: row.opted_out,
    };
  }

  async insertEvent(
    event: CallEvent,
    media: StoredMedia,
    consentReason: string,
  ): Promise<{ duplicate: boolean; id: string | null }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO call_events
           (tenant_id, provider, external_call_id, event_type, direction, channel,
            party_hash, counterparty_hash, occurred_at, correlation_id,
            recording_url, transcript, ai_allowed, consent_reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (tenant_id, provider, external_call_id, event_type) DO NOTHING
         RETURNING id`,
        [
          event.tenantId,
          event.provider,
          event.externalCallId,
          event.eventType,
          event.direction,
          event.channel,
          event.partyHash,
          event.counterpartyHash,
          event.occurredAt,
          event.correlationId,
          media.recordingUrl,
          media.transcript,
          media.aiAllowed,
          consentReason,
        ],
      );
      const row = inserted.rows[0];
      if (!row) {
        await client.query("COMMIT");
        return { duplicate: true, id: null };
      }
      await client.query(
        `INSERT INTO telephony_audit
           (tenant_id, action, entity_type, entity_id, correlation_id, details)
         VALUES ($1, 'call_event.received', 'call_event', $2, $3, $4::jsonb)`,
        [
          event.tenantId,
          row.id,
          event.correlationId,
          JSON.stringify({
            consentReason,
            eventType: event.eventType,
            recordingStored: media.recordingUrl !== null,
            transcriptStored: media.transcript !== null,
            aiAllowed: media.aiAllowed,
          }),
        ],
      );
      await client.query("COMMIT");
      return { duplicate: false, id: row.id };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
