import { assertPublicHttpUrl, isPrivateAddress } from "./safe-fetch";

describe("busca segura de URL", () => {
  it("aceita apenas links http(s) públicos", () => {
    expect(assertPublicHttpUrl("https://exemplo.com.br/pagina").hostname).toBe("exemplo.com.br");
    expect(() => assertPublicHttpUrl("file:///etc/passwd")).toThrow();
    expect(() => assertPublicHttpUrl("javascript:alert(1)")).toThrow();
    expect(() => assertPublicHttpUrl("http://localhost:3000")).toThrow();
    expect(() => assertPublicHttpUrl("http://192.168.1.10")).toThrow();
    expect(() => assertPublicHttpUrl("http://user:pass@exemplo.com.br")).toThrow();
  });

  it("bloqueia faixas privadas, link-local e IPv6 local", () => {
    expect(isPrivateAddress("127.0.0.1")).toBe(true);
    expect(isPrivateAddress("10.1.2.3")).toBe(true);
    expect(isPrivateAddress("172.20.0.1")).toBe(true);
    expect(isPrivateAddress("169.254.169.254")).toBe(true);
    expect(isPrivateAddress("::1")).toBe(true);
    expect(isPrivateAddress("fe80::1")).toBe(true);
    expect(isPrivateAddress("::ffff:192.168.0.1")).toBe(true);
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
    expect(isPrivateAddress("2001:4860:4860::8888")).toBe(false);
  });
});
