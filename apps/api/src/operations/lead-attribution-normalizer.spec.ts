import { CLICK_ID_KEYS, UNKNOWN_ORIGIN, normalizeAttribution } from "./lead-attribution-normalizer";

describe("normalizador puro de atribuição", () => {
  it("normaliza UTMs de URLs absolutas e relativas de forma determinística", () => {
    const absolute =
      "https://example.com/oferta?utm_source=Google%20Ads&utm_medium=CPC&utm_campaign=Ver%C3%A3o_2026&utm_term=piano&utm_content=cta-a";
    const relative = "/lp?utm_source=Instagram&utm_medium=paid_social";

    expect(normalizeAttribution(absolute)).toMatchObject({
      origin: "google ads",
      source: "google ads",
      medium: "cpc",
      campaign: "Verão_2026",
      term: "piano",
      content: "cta-a",
      hasEvidence: true,
    });
    expect(normalizeAttribution(relative)).toMatchObject({
      origin: "instagram",
      source: "instagram",
      medium: "paid_social",
      campaign: null,
    });
    expect(normalizeAttribution(absolute)).toEqual(normalizeAttribution(absolute));
  });

  it("mantém origem desconhecida explicitamente quando não há fonte declarada", () => {
    const result = normalizeAttribution("https://example.com/?gclid=abc.123");

    expect(result.origin).toBe(UNKNOWN_ORIGIN);
    expect(result.source).toBeNull();
    expect(result.clickIds.gclid).toBe("abc.123");
    expect(result.hasEvidence).toBe(true);
    expect(result.campaignId).toBeNull();
    expect(result.firstTouchAt).toBeNull();
  });

  it("não infere campanha, primeiro toque nem canal de conversa", () => {
    const result = normalizeAttribution({ utm_campaign: "Promo_Nov", utm_medium: "whatsapp" });

    expect(result.campaign).toBe("Promo_Nov");
    expect(result.medium).toBe("whatsapp");
    expect(result.origin).toBe(UNKNOWN_ORIGIN);
    expect(result.campaignId).toBeNull();
    expect(result.firstTouchAt).toBeNull();
  });

  it("ignora chaves desconhecidas, valores vazios e valores excessivos sem alterar a entrada", () => {
    const input: Record<string, unknown> = {
      utm_source: "x".repeat(201),
      utm_medium: "   ",
      utm_content: " ok ",
      fbclid: "",
      referral: "parceiro",
      contact_phone: "11999999999",
    };
    const snapshot = JSON.stringify(input);

    const result = normalizeAttribution(input);

    expect(result.source).toBeNull();
    expect(result.medium).toBeNull();
    expect(result.content).toBe("ok");
    expect(result.clickIds.fbclid).toBeNull();
    expect(result.hasEvidence).toBe(true);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("aceita apenas click IDs da lista fixa e preserva a primeira ocorrência", () => {
    const result = normalizeAttribution(
      "?gclid=first&fbclid=fb&msclkid=ms&ttclid=tt&dclid=dc&gclid=second&unknownid=ignored",
    );

    expect(result.clickIds).toEqual({
      gclid: "first",
      fbclid: "fb",
      msclkid: "ms",
      ttclid: "tt",
      dclid: "dc",
    });
    expect(result.clickIds).toEqual(Object.fromEntries(CLICK_ID_KEYS.map((key) => [key, result.clickIds[key]])));
  });

  it("aceita URLSearchParams e chaves com maiúsculas sem perder determinismo", () => {
    const params = new URLSearchParams("UTM_SOURCE=Newsletter&UTM_CAMPAIGN=Outubro&gclid=token");

    expect(normalizeAttribution(params)).toMatchObject({
      origin: "newsletter",
      source: "newsletter",
      campaign: "Outubro",
      clickIds: { gclid: "token", fbclid: null, msclkid: null, ttclid: null, dclid: null },
    });
  });

  it("devolve resultado vazio para entradas inválidas ou acima do limite", () => {
    const empty = normalizeAttribution("https://example.com/sem-parametros");
    const oversized = normalizeAttribution("?utm_source=" + "a".repeat(5000));
    const unrelated = normalizeAttribution({ page: "home", consent: false });

    expect(empty).toEqual(normalizeAttribution({}));
    expect(empty.origin).toBe(UNKNOWN_ORIGIN);
    expect(empty.hasEvidence).toBe(false);
    expect(oversized).toEqual(empty);
    expect(unrelated).toEqual(empty);
  });
});
