import { CloudflareApiError, CloudflarePagesClient } from "./cloudflare-pages.client";

type Call = { url: string; method: string; body?: any };

function response(result: unknown, status = 200) {
  return new Response(JSON.stringify({ success: status < 400, result, errors: status < 400 ? [] : [{ code: 1000, message: "erro" }] }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function fakeFetch(handler: (call: Call) => Response) {
  const calls: Call[] = [];
  const fetchImpl = jest.fn(async (url: string, init?: RequestInit) => {
    const call = { url, method: init?.method || "GET", body: init?.body };
    calls.push(call);
    return handler(call);
  });
  return { fetchImpl, calls };
}

const client = (fetchImpl: any, timeoutMs = 1000) =>
  new CloudflarePagesClient({ token: "token", accountId: "a".repeat(32), fetchImpl, timeoutMs });

describe("CloudflarePagesClient", () => {
  const hash = (value: string) => require("node:crypto").createHash("sha256").update(Buffer.from(value)).digest("hex");

  it("executa o fluxo de Direct Upload na ordem oficial", async () => {
    const { fetchImpl, calls } = fakeFetch((call) => {
      if (call.url.endsWith("/pages/projects")) return response({ name: "proj", subdomain: "proj.pages.dev" });
      if (call.url.includes("/upload-token")) return response({ jwt: "upload-jwt" });
      if (call.url.endsWith("/check-missing")) return response([hash("<h1>Oi</h1>"), hash("body{}")]);
      if (call.url.endsWith("/assets/upload")) return response({});
      if (call.url.endsWith("/upsert-hashes")) return response({});
      if (call.url.endsWith("/deployments")) return response({ id: "dep-1", url: "https://proj.pages.dev", latest_stage: { status: "success" } });
      if (call.url.endsWith("/pages/projects/proj")) return response({ name: "proj" });
      return response({});
    });

    const result = await client(fetchImpl).createDeployment({
      projectName: "proj",
      files: new Map([
        ["index.html", { content: Buffer.from("<h1>Oi</h1>"), contentType: "text/html" }],
        ["assets/site.css", { content: Buffer.from("body{}"), contentType: "text/css" }],
      ]),
      commitMessage: "teste",
    });

    expect(result.id).toBe("dep-1");
    const urls = calls.map((call) => `${call.method} ${new URL(call.url).pathname}`);
    expect(urls).toEqual([
      "GET /client/v4/accounts/" + "a".repeat(32) + "/pages/projects/proj",
      "POST /client/v4/accounts/" + "a".repeat(32) + "/pages/projects/proj/upload-token",
      "POST /client/v4/pages/assets/check-missing",
      "POST /client/v4/pages/assets/upload",
      "POST /client/v4/pages/assets/upsert-hashes",
      "POST /client/v4/accounts/" + "a".repeat(32) + "/pages/projects/proj/deployments",
    ]);
    // apenas os arquivos ausentes são enviados; aqui os dois hashes estão ausentes
    const uploaded = JSON.parse(calls.find((call) => call.url.endsWith("/assets/upload"))!.body);
    expect(uploaded).toHaveLength(2);

    const deployment = calls[calls.length - 1]!;
    expect(deployment.body).toBeInstanceOf(FormData);
    const manifest = JSON.parse(String((deployment.body as FormData).get("manifest")));
    expect(Object.keys(manifest)).toEqual(["/index.html", "/assets/site.css"]);
    expect(manifest["/index.html"]).toMatch(/^[a-f0-9]{64}$/);
    expect((deployment.body as FormData).get("branch")).toBe("main");
  });

  it("envia apenas os hashes ausentes", async () => {
    const { fetchImpl, calls } = fakeFetch((call) => {
      if (call.url.endsWith("/check-missing")) return response([hash("x")]);
      if (call.url.endsWith("/upload-token")) return response({ jwt: "jwt" });
      if (call.url.endsWith("/assets/upload")) return response({});
      if (call.url.endsWith("/upsert-hashes")) return response({});
      if (call.url.endsWith("/deployments")) return response({ id: "dep" });
      return response({ name: "proj" });
    });
    await client(fetchImpl).createDeployment({
      projectName: "proj",
      files: new Map([["index.html", { content: Buffer.from("x"), contentType: "text/html" }]]),
    });
    const uploaded = JSON.parse(calls.find((call) => call.url.endsWith("/assets/upload"))!.body);
    expect(uploaded).toHaveLength(1);
    expect(uploaded[0]).toMatchObject({ base64: true, metadata: { contentType: "text/html" } });
    expect(uploaded[0].value).toBe(Buffer.from("x").toString("base64"));
  });

  it("cria o projeto quando ele ainda não existe", async () => {
    const { fetchImpl, calls } = fakeFetch((call) => {
      if (call.method === "GET") return response(undefined, 404);
      return response({ name: "novo", subdomain: "novo.pages.dev" });
    });
    const project = await client(fetchImpl).ensureProject("novo");
    expect(project.name).toBe("novo");
    expect(calls.map((call) => call.method)).toEqual(["GET", "POST"]);
    expect(JSON.parse(calls[1]!.body)).toEqual({ name: "novo", production_branch: "main" });
  });

  it("encontra a zona mais específica do hostname", async () => {
    const { fetchImpl, calls } = fakeFetch((call) => {
      const name = new URL(call.url).searchParams.get("name");
      if (name === "cliente.com.br") return response([{ id: "zone-1", name: "cliente.com.br" }]);
      return response([]);
    });
    const zone = await client(fetchImpl).findZoneForHostname("www.cliente.com.br");
    expect(zone).toEqual({ id: "zone-1", name: "cliente.com.br" });
    expect(calls.map((call) => new URL(call.url).searchParams.get("name"))).toEqual(["www.cliente.com.br", "cliente.com.br"]);
  });

  it("converte erro da API em CloudflareApiError", async () => {
    const { fetchImpl } = fakeFetch(() => response(undefined, 403));
    await expect(client(fetchImpl).getProject("x")).rejects.toBeInstanceOf(CloudflareApiError);
  });
});
