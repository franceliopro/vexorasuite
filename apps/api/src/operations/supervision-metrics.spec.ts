import { isSupervisionStale, supervisionReferenceAt } from "./supervision-metrics";

describe("supervision metrics", () => {
  const createdAt = new Date("2026-11-04T10:00:00.000Z");
  it("uses lastMessageAt instead of incidental conversation updates", () => {
    const row = { createdAt, updatedAt: new Date("2026-11-04T12:00:00.000Z"), lastMessageAt: new Date("2026-11-04T11:55:00.000Z") };
    expect(supervisionReferenceAt(row)).toEqual(row.lastMessageAt);
    expect(isSupervisionStale(row, new Date("2026-11-04T12:20:00.000Z"), 30)).toBe(false);
  });

  it("falls back to creation time when no message exists", () => {
    const row = { createdAt, updatedAt: createdAt, lastMessageAt: null };
    expect(supervisionReferenceAt(row)).toEqual(createdAt);
    expect(isSupervisionStale(row, new Date("2026-11-04T10:31:00.000Z"), 30)).toBe(true);
  });
});
