import { NextResponse, type NextRequest } from "next/server";

/**
 * Roteamento por Host: domínios próprios de cliente (ex.: www.cliente.com.br)
 * resolvem o site publicado correspondente e reescrevem a URL para /sites/<slug>.
 * Hosts internos (*.vexorasuite.com.br, localhost, IPs) seguem para a UI normal.
 */
const INTERNAL_IPS = /^\d{1,3}(\.\d{1,3}){3}$/;

function isInternalHost(host: string) {
  return host === "localhost" || host === "127.0.0.1" || INTERNAL_IPS.test(host) || host.endsWith(".vexorasuite.com.br") || host === "vexorasuite.com.br";
}

export async function middleware(request: NextRequest) {
  const hostHeader = String(request.headers.get("host") || "").toLowerCase().replace(/\.$/, "");
  const host = hostHeader.replace(/:\d+$/, "");
  if (!host || isInternalHost(host)) return NextResponse.next();

  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/sites/") || pathname.startsWith("/p/") || pathname.startsWith("/api/") || pathname.startsWith("/_next/")) {
    return NextResponse.next();
  }

  const apiOrigin = (process.env.API_INTERNAL_URL || "http://api:3001").replace(/\/$/, "");
  try {
    const response = await fetch(`${apiOrigin}/api/public/sites/resolve?host=${encodeURIComponent(host)}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) {
      return new NextResponse("Domínio não configurado neste ambiente ou site ainda não publicado.", {
        status: response.status === 404 ? 404 : 502,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    }
    const data = (await response.json()) as { slug?: string };
    const slug = String(data?.slug || "").trim();
    if (!slug) throw new Error("missing slug");
    const url = request.nextUrl.clone();
    url.pathname = `/sites/${encodeURIComponent(slug)}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  } catch {
    return new NextResponse("Site indisponível no momento. Tente novamente em instantes.", {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }
}

export const config = {
  matcher: [
    "/((?!_next/|api/|fonts/|favicon|manifest|robots|site.webmanifest|.*\\..*).*)",
  ],
};
