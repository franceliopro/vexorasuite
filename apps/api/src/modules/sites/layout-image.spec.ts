import sharp from "sharp";
import { analyzeLayoutImage, parseLayoutImage } from "./layout-image";

async function png(width: number, height: number): Promise<string> {
  const bytes = await sharp({ create: { width, height, channels: 3, background: "#ffffff" } }).png().toBuffer();
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

function band(width: number, height: number, color: [number, number, number]): Buffer {
  const buffer = Buffer.alloc(width * height * 3);
  for (let index = 0; index < buffer.length; index += 3) {
    buffer[index] = color[0];
    buffer[index + 1] = color[1];
    buffer[index + 2] = color[2];
  }
  return buffer;
}

async function layoutPng(): Promise<string> {
  const width = 256;
  const bytes = await sharp({ create: { width, height: 512, channels: 3, background: "#ffffff" } })
    .composite([
      { input: band(width, 128, [194, 65, 12]), raw: { width, height: 128, channels: 3 }, top: 96, left: 0 },
      { input: band(width, 128, [29, 78, 216]), raw: { width, height: 128, channels: 3 }, top: 320, left: 0 },
    ])
    .png()
    .toBuffer();
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

  it("extrai paleta e estrutura determinísticas sem usar modelo de visão", async () => {
    const image = await parseLayoutImage({ dataUrl: await layoutPng(), fileName: "layout.png" });
    const first = await analyzeLayoutImage(image);
    const second = await analyzeLayoutImage(image);

    expect(first).toEqual(second);
    expect(first.primary).toMatch(/^#[0-9a-f]{6}$/);
    expect(first.accent).toMatch(/^#[0-9a-f]{6}$/);
    expect(first.primary).not.toBe(first.accent);
    expect(first.brief.sections.slice(0, 2)).toEqual(["topo", "hero"]);
    expect(first.brief.sections.slice(-2)).toEqual(["contato", "rodape"]);
    expect(first.brief.sections).toContain("servicos");
    expect(["compacta", "equilibrada", "generosa"]).toContain(first.brief.density);
    expect(first.brief.notes).toContain("Estimativa determinística");
  });
});
