import { isAllowedCorsOrigin, parseCorsOrigins } from "./main";

describe("CORS origin validation", () => {
  it("preserves the localhost default outside production", () => {
    expect(parseCorsOrigins(undefined, "development")).toEqual(["http://localhost:3000"]);
  });

  it("normalizes valid origins to URL.origin", () => {
    expect(parseCorsOrigins("https://app.example.com/, https://app.example.com", "production"))
      .toEqual(["https://app.example.com"]);
  });

  it.each(["", "https://app.example.com,,https://admin.example.com"])(
    "rejects empty entries: %s",
    (configuredOrigins) => {
      expect(() => parseCorsOrigins(configuredOrigins, "production")).toThrow("empty entries");
    },
  );

  it("rejects wildcard origins", () => {
    expect(() => parseCorsOrigins("*", "development")).toThrow("wildcard");
  });

  it.each(["https://app.example.com/path", "https://app.example.com/?tenant=1"])(
    "rejects paths and URL components: %s",
    (configuredOrigin) => {
      expect(() => parseCorsOrigins(configuredOrigin, "production")).toThrow("path");
    },
  );

  it("rejects unsupported protocols", () => {
    expect(() => parseCorsOrigins("ftp://app.example.com", "development")).toThrow("HTTP or HTTPS");
  });

  it("allows localhost HTTP only outside production", () => {
    expect(parseCorsOrigins("http://localhost:3000", "development")).toEqual(["http://localhost:3000"]);
    expect(() => parseCorsOrigins("http://localhost:3000", "production")).toThrow("only allowed");
  });

  it("rejects HTTP origins that are not localhost", () => {
    expect(() => parseCorsOrigins("http://app.example.com", "development")).toThrow("only allowed");
  });

  it("compares request origins using URL.origin", () => {
    const allowed = parseCorsOrigins("https://app.example.com", "production");
    expect(isAllowedCorsOrigin("https://app.example.com/some-path", allowed)).toBe(true);
    expect(isAllowedCorsOrigin("https://other.example.com", allowed)).toBe(false);
    expect(isAllowedCorsOrigin(undefined, allowed)).toBe(true);
  });
});
