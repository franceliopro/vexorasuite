import { formatDateBR, formatDateTimeBR, formatMonthBR, parseBrazilianDate } from "./date-format";

describe("Brazilian date formatting", () => {
  it("prints date-only values as dd/MM/yyyy without timezone shifts", () => {
    expect(formatDateBR("2026-10-28")).toBe("28/10/2026");
  });

  it("prints timestamps with a four-digit year in São Paulo time", () => {
    expect(formatDateTimeBR("2026-10-28T15:04:00.000Z")).toBe("28/10/2026, 12:04");
  });

  it("parses valid dd/MM/yyyy periods and rejects impossible dates", () => {
    expect(parseBrazilianDate("28/10/2026")).toBe("2026-10-28");
    expect(parseBrazilianDate("31/02/2026")).toBeNull();
  });

  it("formats monthly report buckets as MM/yyyy", () => {
    expect(formatMonthBR("2026-10")).toBe("10/2026");
  });
});
