import {
  isAllowedMediaUrl,
  normalizeInboundMedia,
  readMediaResponse,
  wahaMediaPath,
} from "./inbound-media";

describe("inbound media normalization", () => {
  it("normalizes WAHA media to a gateway path and never keeps the webhook host", () => {
    const media = normalizeInboundMedia({
      provider: "WAHA",
      hasMedia: true,
      type: "image",
      mimeType: "image/jpeg",
      filename: "foto.jpg",
      mediaUrl: "http://waha:3000/api/files/foto.jpg?token=secret",
    });
    expect(media).toMatchObject({
      hasMedia: true,
      mediaUrl: "/api/files/foto.jpg",
      filename: "foto.jpg",
      mimetype: "image/jpeg",
      contentType: "image",
      mediaDelivery: "READY",
    });
    expect(media.mediaUrl).not.toContain("token=");
  });

  it("drops a WAHA url outside the gateway file path", () => {
    expect(wahaMediaPath("https://evil.example/api/sessions")).toBeNull();
    expect(normalizeInboundMedia({ provider: "WAHA", hasMedia: true, mediaUrl: "//evil.example/api/files/x" }).mediaUrl).toBeNull();
  });

  it("stores only the Meta media id so the binary is resolved with tenant credentials", () => {
    const media = normalizeInboundMedia({
      provider: "META",
      type: "image",
      mimeType: "image/png",
      mediaId: "meta-media-123",
    });
    expect(media).toMatchObject({
      hasMedia: true,
      mediaUrl: null,
      mediaRef: "meta-media-123",
      mimetype: "image/png",
      contentType: "image",
      mediaDelivery: "READY",
    });
  });

  it("keeps an honest placeholder for Meta media without an id", () => {
    const media = normalizeInboundMedia({ provider: "META", type: "document", filename: "contrato.pdf", mimetype: "application/pdf" });
    expect(media).toMatchObject({ hasMedia: true, mediaUrl: null, filename: "contrato.pdf", contentType: "file", mediaDelivery: "UNAVAILABLE" });
  });

  it("normalizes the first Zernio attachment and only keeps allowlisted https urls", () => {
    const accepted = normalizeInboundMedia({
      provider: "ZERNIO",
      type: "message",
      attachments: [{ url: "https://cdn.zernio.com/media/foto.png", mimeType: "image/png", fileName: "foto.png" }],
    });
    expect(accepted).toMatchObject({ hasMedia: true, mediaUrl: "https://cdn.zernio.com/media/foto.png", filename: "foto.png", contentType: "image", mediaDelivery: "READY" });

    const rejected = normalizeInboundMedia({
      provider: "ZERNIO",
      attachments: [{ url: "http://attacker.example/steal?token=abc", type: "application/pdf", name: "nota.pdf" }],
    });
    expect(rejected).toMatchObject({ hasMedia: true, mediaUrl: null, filename: "nota.pdf", mimetype: "application/pdf", contentType: "file", mediaDelivery: "UNAVAILABLE" });
  });

  it.each([
    ["https://zernio.com/media/1.png", true],
    ["https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1", true],
    ["https://video-something.fbcdn.net/video.mp4", true],
    ["https://evilzernio.com/media/1.png", false],
    ["https://zernio.com.evil.example/media", false],
    ["http://zernio.com/media/1.png", false],
    ["https://user:pass@zernio.com/media", false],
    ["https://zernio.com:8443/media", false],
    ["https://127.0.0.1/media", false],
    ["not-a-url", false],
  ])("allowlist decides whether %s can be fetched", (url, allowed) => {
    expect(isAllowedMediaUrl(url)).toBe(allowed);
  });

  it("leaves text without media as text", () => {
    expect(normalizeInboundMedia({ provider: "META", type: "text", hasMedia: false })).toMatchObject({
      hasMedia: false,
      contentType: "text",
      mediaDelivery: "UNAVAILABLE",
    });
  });

  it("reads a ranged media response with a content type and rejects oversized payloads", async () => {
    const ok = new Response(Buffer.from("binary"), { headers: { "content-type": "image/png; charset=utf-8" } });
    await expect(readMediaResponse(ok)).resolves.toMatchObject({ mimetype: "image/png" });
    const tooLarge = new Response(Buffer.from("0123456789"), { headers: { "content-type": "image/png", "content-length": "11" } });
    await expect(readMediaResponse(tooLarge, 10)).rejects.toThrow("limite");
  });
});
