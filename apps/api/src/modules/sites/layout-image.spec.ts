import sharp from "sharp";
import { parseLayoutImage } from "./layout-image";

async function png(width: number, height: number): Promise<string> {
  const bytes = await sharp({ create: { width, height, channels: 3, background: "#ffffff" } }).png().toBuffer();
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

describe("referência de layout enviada no wizard", () => {
  it("normaliza PNG em JPEG pequeno e inerte", async () => {
    const image = await parseLayoutImage({
      dataUrl: await png(1200, 800),
      mimeType: "image/png",
      fileName: "meu layout.png",
    });

    expect(image.mimeType).toBe("image/jpeg");
    expect(image.dataUrl).toMatch(/^data:image\/jpeg;base64,\/9j\//);
    expect(image.width).toBeLessThanOrEqual(1600);
    expect(image.height).toBeLessThanOrEqual(1600);
    expect(image.bytes).toBeLessThanOrEqual(1_500_000);
    expect(image.fileName).toBe("meu_layout.png");
  });

  it("rejeita SVG, dados que não são imagem e capturas minúsculas", async () => {
    await expect(parseLayoutImage({ dataUrl: "data:image/svg+xml;base64,PHN2Zz48c2NyaXB0Pg==" })).rejects.toThrow();
    await expect(parseLayoutImage({ dataUrl: "data:image/png;base64,bmFvIGVhIGltYWdl" })).rejects.toThrow();
    await expect(parseLayoutImage({ dataUrl: await png(32, 32) })).rejects.toThrow(/64x64/);
    await expect(parseLayoutImage("javascript:alert(1)")).rejects.toThrow();
  });
});
