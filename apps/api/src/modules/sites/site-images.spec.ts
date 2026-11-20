import { buildSiteIllustrations } from "./site-images";

describe("deterministic site illustrations", () => {
  it("creates three inert PNG data URIs with a stable result", async () => {
    const input = { name: "Clínica Pet", primary: "#0E7A5C", accent: "#6258DF" };
    const first = await buildSiteIllustrations(input);
    const second = await buildSiteIllustrations(input);

    expect(first).toEqual(second);
    expect(Object.keys(first)).toEqual(["about", "team", "service"]);
    for (const uri of Object.values(first)) {
      expect(uri).toMatch(/^data:image\/png;base64,iVBORw0KGgo/);
      expect(uri.length).toBeLessThan(120_000);
      expect(uri).not.toMatch(/<script|javascript:/i);
    }
  });

  it("treats the company name as untrusted text and tolerates invalid colors", async () => {
    const images = await buildSiteIllustrations({
      name: '<script>alert(1)</script> "Pet"',
      primary: "not-a-color",
      accent: "#6258DF",
    });
    expect(images.about).toMatch(/^data:image\/png;base64,/);
    expect(images.about).not.toContain("<script>");
  });
});
