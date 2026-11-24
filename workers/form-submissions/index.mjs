/**
 * Worker do formulário público do Alto Araguaia Imóveis.
 *
 * Recebe o POST do site, valida, aplica honeypot e rate limit e grava uma
 * `submission` no Directus com status `pending`. Não cria imóvel, não notifica
 * o anunciante e não publica nada: isso pertence aos Flows do Directus.
 *
 * Segredos (DIRECTUS_URL, DIRECTUS_TOKEN) ficam no ambiente do Cloudflare.
 * Nenhum deles é devolvido ao navegador ou incluído no bundle do site.
 */

const JSON_HEADERS = Object.freeze({
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
});

const LIMITS = Object.freeze({
  name: 120,
  email: 180,
  phone: 40,
  propertyType: 80,
  city: 120,
  message: 2000,
  source: 80,
  subject: 160,
  propertyRef: 40,
  propertyTitle: 160,
  propertyUrl: 300,
});

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[0-9+()\s.-]{8,40}$/;
const RATE_MAX = 5;
const RATE_WINDOW_SECONDS = 3600;

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function text(value, max) {
  const valueClean = clean(value);
  return valueClean.length <= max ? valueClean : null;
}

function corsHeaders(origin) {
  const headers = { vary: "Origin" };
  if (origin) headers["access-control-allow-origin"] = origin;
  return headers;
}

function allowedOrigin(env, origin) {
  const configured = (env.ALLOWED_ORIGIN ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!configured.length || !origin) return { allowed: true, origin: null };
  return configured.includes(origin)
    ? { allowed: true, origin }
    : { allowed: false, origin: null };
}

async function sha256(value) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function configurationProblem(env) {
  if (!clean(env.DIRECTUS_URL) || !clean(env.DIRECTUS_TOKEN)) {
    return "O canal de envio não está configurado. Use um dos canais oficiais de contato.";
  }
  try {
    const url = new URL(env.DIRECTUS_URL);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      return "A configuração do Directus não é válida.";
    }
    if (url.protocol === "http:" && !["localhost", "127.0.0.1"].includes(url.hostname)) {
      return "A configuração do Directus exige HTTPS.";
    }
  } catch {
    return "A configuração do Directus não é válida.";
  }
  return null;
}

function validate(body) {
  const errors = [];
  const name = text(body.name, LIMITS.name);
  if (!name || name.length < 2) errors.push("Informe seu nome.");

  const email = text(body.email, LIMITS.email);
  if (!email || !EMAIL.test(email)) errors.push("Informe um e-mail válido.");

  const phone = clean(body.phone);
  if (phone && (phone.length > LIMITS.phone || !PHONE.test(phone))) {
    errors.push("Informe um telefone válido.");
  }

  const message = text(body.message, LIMITS.message);
  if (!message || message.length < 5) errors.push("Descreva o imóvel com um pouco mais de detalhes.");

  const propertyType = text(body.propertyType, LIMITS.propertyType);
  const city = text(body.city, LIMITS.city);
  const source = text(body.source, LIMITS.source) || "site";
  const subject = text(body.subject, LIMITS.subject);
  const propertyRef = text(body.propertyRef, LIMITS.propertyRef);
  const propertyTitle = text(body.propertyTitle, LIMITS.propertyTitle);
  const propertyUrl = text(body.propertyUrl, LIMITS.propertyUrl);

  if (body.consent !== true) errors.push("Autorize o contato para enviar sua submissão.");

  return {
    errors,
    fields: {
      name,
      email,
      phone: phone || null,
      propertyType,
      city,
      message,
      source,
      subject,
      propertyRef,
      propertyTitle,
      propertyUrl,
    },
  };
}

async function consumeRateLimit(env, request) {
  const kv = env.RATE_LIMIT_KV;
  if (!kv || typeof kv.get !== "function" || typeof kv.put !== "function") {
    return { ok: false, status: 503, reason: "O canal de envio não está configurado. Use um dos canais oficiais de contato." };
  }
  const ip = request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")
    ?? "sem-ip";
  const key = `submissao:${(await sha256(ip)).slice(0, 24)}`;
  try {
    const current = Number.parseInt(await kv.get(key), 10) || 0;
    if (current >= RATE_MAX) {
      return { ok: false, status: 429, reason: "Muitos envios. Tente novamente mais tarde." };
    }
    await kv.put(key, String(current + 1), { expirationTtl: RATE_WINDOW_SECONDS });
    return { ok: true };
  } catch {
    return { ok: false, status: 503, reason: "O canal de envio não está disponível. Tente novamente mais tarde." };
  }
}

function directusHeaders(env) {
  return {
    authorization: `Bearer ${env.DIRECTUS_TOKEN}`,
    "content-type": "application/json",
  };
}

async function findSubmission(fetchImpl, listUrl, env) {
  const response = await fetchImpl(listUrl, {
    method: "GET",
    headers: directusHeaders(env),
    redirect: "error",
  });
  if (!response.ok) return null;
  const jsonValue = await response.json().catch(() => null);
  const rows = Array.isArray(jsonValue?.data) ? jsonValue.data : [];
  return rows[0] ?? null;
}

/**
 * Contrato puro da requisição. `fetch`, relógio e KV podem ser injetados nos
 * testes; o runtime usa os globais do Cloudflare Workers.
 */
export async function handleRequest(request, env, dependencies = {}) {
  const fetchImpl = dependencies.fetch ?? globalThis.fetch;
  const now = dependencies.now ?? (() => new Date());
  const cors = allowedOrigin(env, request.headers.get("origin"));

  if (!cors.allowed) {
    return json({ error: "Origem não autorizada." }, 403, corsHeaders(cors.origin));
  }
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders(cors.origin),
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "content-type",
        "access-control-max-age": "86400",
      },
    });
  }
  if (request.method !== "POST") {
    return json({ error: "Método não permitido." }, 405, {
      ...corsHeaders(cors.origin),
      allow: "POST, OPTIONS",
    });
  }

  const headers = corsHeaders(cors.origin);
  const problem = configurationProblem(env);
  if (problem) return json({ error: problem }, 503, headers);

  const rate = await consumeRateLimit(env, request);
  if (!rate.ok) {
    const status = rate.status ?? 429;
    return json({ error: rate.reason }, status, status === 429
      ? { ...headers, "retry-after": String(RATE_WINDOW_SECONDS) }
      : headers);
  }

  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.includes("application/json")) {
    return json({ error: "Envie a submissão como JSON." }, 415, headers);
  }

  let body;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return json({ error: "JSON inválido." }, 400, headers);
  }
  if (!isObject(body)) {
    return json({ error: "JSON inválido." }, 400, headers);
  }

  // Honeypot: resposta neutra, sem gravar e sem revelar o motivo ao robô.
  if (clean(body.website)) {
    return json({ ok: true, submissionKey: null }, 200, headers);
  }

  const parsed = validate(body);
  if (parsed.errors.length) {
    return json({ error: "Revise os campos do formulário.", fields: parsed.errors }, 400, headers);
  }

  const receivedAt = now().toISOString();
  const hourBucket = receivedAt.slice(0, 13);
  const material = [
    parsed.fields.email,
    parsed.fields.source,
    parsed.fields.message,
    parsed.fields.propertyRef ?? "",
    hourBucket,
  ].join("\u001f");
  const submissionKey = `AA-${(await sha256(material)).slice(0, 32)}`;
  const baseUrl = env.DIRECTUS_URL.replace(/\/+$/, "");
  const listUrl = `${baseUrl}/items/submission?fields=id,submission_key&filter[submission_key][_eq]=${encodeURIComponent(submissionKey)}&limit=1`;

  try {
    const existing = await findSubmission(fetchImpl, listUrl, env);
    if (existing) {
      return json({ ok: true, submissionKey, duplicate: true }, 200, headers);
    }

    const created = await fetchImpl(`${baseUrl}/items/submission`, {
      method: "POST",
      headers: directusHeaders(env),
      body: JSON.stringify({
        submission_key: submissionKey,
        name: parsed.fields.name,
        email: parsed.fields.email,
        phone: parsed.fields.phone,
        status: "pending",
        payload: { ...parsed.fields, consent: true, receivedAt },
      }),
    });

    if (!created.ok) {
      // Concorrência: outra requisição pode ter criado a mesma chave.
      if (created.status === 409 || created.status === 400) {
        const raced = await findSubmission(fetchImpl, listUrl, env);
        if (raced) return json({ ok: true, submissionKey, duplicate: true }, 200, headers);
      }
      return json({ error: "Não foi possível registrar a submissão." }, 502, headers);
    }

    // A criação não implica notificação nem publicação. O Flow do Directus
    // decide o que acontece depois e registra a confirmação do provedor.
    return json({ ok: true, submissionKey, duplicate: false, status: "pending" }, 200, headers);
  } catch {
    return json({ error: "Não foi possível registrar a submissão." }, 502, headers);
  }
}

export default {
  fetch(request, env) {
    return handleRequest(request, env, {});
  },
};
