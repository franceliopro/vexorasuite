export type ConsentChannel = "PHONE" | "SMS";

export type ConsentRecord = {
  tenantId: string;
  channel: string;
  partyHash: string;
  grantedAt: Date | null;
  revokedAt: Date | null;
  optedOut: boolean;
};

export type ConsentDecision = {
  allowed: boolean;
  reason: "GRANTED" | "NO_CONSENT" | "REVOKED" | "OPTED_OUT" | "CHANNEL_MISMATCH";
  allowRecording: boolean;
  allowTranscription: boolean;
  allowAi: boolean;
};

function deny(reason: ConsentDecision["reason"]): ConsentDecision {
  return {
    allowed: false,
    reason,
    allowRecording: false,
    allowTranscription: false,
    allowAi: false,
  };
}

/**
 * Default deny: ausência de registro, canal diferente, revogação ou opt-out
 * bloqueiam gravação, transcrição e IA. Opt-out nunca é desligável.
 */
export function decideConsent(record: ConsentRecord | null, channel: ConsentChannel): ConsentDecision {
  if (!record) return deny("NO_CONSENT");
  if (record.channel !== channel) return deny("CHANNEL_MISMATCH");
  if (record.optedOut) return deny("OPTED_OUT");
  if (record.revokedAt) return deny("REVOKED");
  if (!record.grantedAt) return deny("NO_CONSENT");
  return {
    allowed: true,
    reason: "GRANTED",
    allowRecording: true,
    allowTranscription: true,
    allowAi: true,
  };
}
