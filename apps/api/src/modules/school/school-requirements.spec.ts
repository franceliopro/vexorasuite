import {
  DEFAULT_BILLING_POLICY,
  billingPeriodKey,
  paymentReminderOccurrences,
  penaltyForBreach,
  teacherReminderAt,
} from "./school-rules";

describe("requisitos Fermata Music", () => {
  it("calcula a multa sobre o total contratado menos o já pago", () => {
    expect(penaltyForBreach(100_000, 40_000, 20)).toBe(12_000);
    expect(penaltyForBreach(100_000, 120_000, 20)).toBe(0);
    expect(penaltyForBreach(null, 0, 20)).toBeNull();
  });

  it("identifica o período da cobrança por ciclo", () => {
    expect(billingPeriodKey("2026-11-27", "MONTHLY")).toBe("2026-11");
    expect(billingPeriodKey("2026-11-27", "BIWEEKLY")).toBe("2026-11-H2");
    expect(billingPeriodKey("2026-11-27", "WEEKLY")).toMatch(/^2026-W\d{2}$/);
  });

  it("agenda lembretes sem executar envio", () => {
    const occurrences = paymentReminderOccurrences("2026-12-10", DEFAULT_BILLING_POLICY, new Date("2026-12-05T00:00:00.000Z"));
    expect(occurrences.map((item) => item.kind)).toContain("BEFORE_DUE");
    expect(occurrences.map((item) => item.kind)).toContain("DUE_DATE");
    expect(occurrences.every((item) => item.channels.includes("SMS"))).toBe(true);
  });

  it("calcula o lembrete do professor 30 minutos antes da aula", () => {
    expect(teacherReminderAt("2026-12-10", "18:00", 30)).toBe("2026-12-10T17:30:00.000Z");
    expect(teacherReminderAt("2026-12-10", "invalid", 30)).toBeNull();
  });

  it("mantém a notificação de pagamento ao professor como configuração sem envio", () => {
    expect(DEFAULT_BILLING_POLICY.paymentNoticeToTeacher).toBe(true);
    expect(DEFAULT_BILLING_POLICY.channels).toEqual(["WHATSAPP", "SMS", "EMAIL"]);
  });

  it("cancela automaticamente após duas mensalidades em atraso", () => {
    expect(DEFAULT_BILLING_POLICY.cancellationApprovalRequired).toBe(false);
    expect(DEFAULT_BILLING_POLICY.overdueInstallmentsForCancellation).toBe(2);
    expect(DEFAULT_BILLING_POLICY.breachPenaltyPercent).toBe(20);
  });
});
