import { cleanEmail, occasion, personalize } from "./content";
import { localInstant, repeatInstant, workflowSteps } from "./workflow-time";
import { publicAddress, seal, unseal } from "./security";
import { whatsappPhone } from "../operations/whatsapp-bridge";
describe("communication boundaries", () => {
  it("removes scripts, remote CSS, active content and unsafe image schemes", () => {
    const html = cleanEmail(
      '<script>alert(1)</script><style>@import "https://evil.test";</style><p style="color:#6258df;background-image:url(https://evil.test)">Olá</p><img src="javascript:alert(1)" onerror="evil()"><iframe src="https://evil.test"></iframe>',
    );
    expect(html).toContain("color:#6258df");
    expect(html).not.toMatch(
      /script|onerror|iframe|@import|javascript:|background-image/,
    );
  });
  it("escapes contact names while preserving intended template HTML", () => {
    expect(
      personalize("<h1>{{novo_nome}}</h1>", "<img src=x onerror=evil()>"),
    ).toBe("<h1>&lt;img src=x onerror=evil()&gt;</h1>");
  });
  it("selects birthday and partnership fields without using contact creation as anniversary", () => {
    expect(occasion({ birthDate: "1990-10-02" }, "birthday", 10)).toBe(true);
    expect(occasion({ partnershipDate: "2020-10-02" }, "partnership", 10)).toBe(
      true,
    );
    expect(occasion({ createdAt: "2020-10-02" }, "partnership", 10)).toBe(
      false,
    );
    expect(
      occasion(
        { customFields: { data_nascimento: "05/10/1990" } },
        "birthday",
        10,
      ),
    ).toBe(true);
  });
  it("binds encrypted credentials to the tenant and account", () => {
    const prior = process.env.JWT_ACCESS_SECRET;
    process.env.JWT_ACCESS_SECRET = "test-only-secret";
    try {
      const c = seal("a", "account", { password: "secret" });
      expect(unseal("a", "account", c)).toEqual({ password: "secret" });
      expect(() => unseal("b", "account", c)).toThrow();
      expect(() => unseal("a", "other", c)).toThrow();
    } finally {
      if (prior === undefined) delete process.env.JWT_ACCESS_SECRET;
      else process.env.JWT_ACCESS_SECRET = prior;
    }
  });
  it.each([
    "127.0.0.1",
    "169.254.169.254",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "100.64.0.1",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
  ])("does not allow private mail destination %s", (ip) => {
    expect(publicAddress(ip)).toBe(false);
  });
  it("normalizes an explicit international phone without guessing from social usernames", () => {
    expect(whatsappPhone("+55 (11) 99999-9999")).toBe("5511999999999");
    expect(() => whatsappPhone("franceliopro")).toThrow();
    expect(() => whatsappPhone("000000000000")).toThrow();
  });
});
describe("workflow clocks", () => {
  it("converts chosen timezone instead of assuming Brasília for every tenant", () => {
    expect(
      localInstant("2026-10-27T09:30", "America/Sao_Paulo").toISOString(),
    ).toBe("2026-10-27T12:30:00.000Z");
    expect(
      localInstant("2026-10-27T09:30", "America/Manaus").toISOString(),
    ).toBe("2026-10-27T13:30:00.000Z");
  });
  it("keeps local wall time when recurring over a DST change", () => {
    const first = localInstant("2026-10-31T09:00", "America/New_York");
    expect(repeatInstant(first, 1, "America/New_York").toISOString()).toBe(
      "2026-11-01T14:00:00.000Z",
    );
  });
  it("rejects non-existent local times and malformed or unsupported steps", () => {
    expect(() =>
      localInstant("2026-03-08T02:30", "America/New_York"),
    ).toThrow();
    expect(() => workflowSteps([{ type: "EXEC_JS", text: "bad" }])).toThrow();
    expect(() => workflowSteps([{ type: "WAIT", minutes: -1 }])).toThrow();
    expect(() => localInstant("2026-02-31T09:00", "UTC")).toThrow();
  });
});
