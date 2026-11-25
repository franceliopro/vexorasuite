/** Health-check mínimo. Não consulta banco e não expõe configuração. */
export const dynamic = 'force-static'

export function GET() {
  return Response.json({ service: 'vexora-payload', ok: true })
}