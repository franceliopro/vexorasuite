export type SupervisionActivityRow = {
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date | null;
};

export function supervisionReferenceAt(row: SupervisionActivityRow): Date {
  return row.lastMessageAt || row.createdAt;
}

export function isSupervisionStale(row: SupervisionActivityRow, now: Date, slaMinutes: number): boolean {
  return now.getTime() - supervisionReferenceAt(row).getTime() >= slaMinutes * 60_000;
}
