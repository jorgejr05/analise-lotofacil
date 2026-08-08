/**
 * PROXY EDGE — Rota da Lotofácil
 *
 * Por que Edge Runtime?
 * - Serverless Functions na Vercel rodam em servidores AWS nos EUA → IPs bloqueados.
 * - Edge Functions rodam na CDN Cloudflare no nó MAIS PRÓXIMO do usuário.
 * - Como o usuário está no Brasil → roda de São Paulo → acessa APIs brasileiras.
 *
 * Uso:
 *   GET /api/loto-proxy/3756       → concurso específico
 *   GET /api/loto-proxy/ultimo     → último concurso disponível
 */
export const runtime = 'edge';

const CAIXA = 'https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil';
const GUIDI  = 'https://api.guidi.dev.br/loteria/lotofacil';

const HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'LotoExpert-EdgeProxy/1.0',
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ concurso: string }> }
) {
  const { concurso } = await params;

  // Monta as URLs para cada fonte
  const isConcurso = concurso !== 'ultimo';
  const caixaUrl = isConcurso ? `${CAIXA}/${concurso}` : `${CAIXA}/`;
  const guidiUrl = isConcurso ? `${GUIDI}/${concurso}` : `${GUIDI}/ultimo`;

  // ── Fonte 1: API Oficial da Caixa ──────────────────────────────────────────
  try {
    const res = await fetch(caixaUrl, { headers: HEADERS });
    if (res.ok) {
      const data = await res.json() as any;
      if (data?.numero && Array.isArray(data?.listaDezenas)) {
        return Response.json(data, {
          headers: { 'X-Source': 'caixa', 'Cache-Control': 'no-store' },
        });
      }
    }
  } catch (e) {
    console.warn('[EdgeProxy] Caixa falhou:', e);
  }

  // ── Fonte 2: Guidi (fallback) ───────────────────────────────────────────────
  try {
    const res = await fetch(`${guidiUrl}?t=${Date.now()}`, { headers: HEADERS });
    if (res.ok) {
      const data = await res.json() as any;
      if (data?.numero && Array.isArray(data?.listaDezenas)) {
        return Response.json(data, {
          headers: { 'X-Source': 'guidi', 'Cache-Control': 'no-store' },
        });
      }
    }
  } catch (e) {
    console.error('[EdgeProxy] Guidi também falhou:', e);
  }

  return Response.json(
    { error: 'Nenhuma fonte disponível para o concurso ' + concurso },
    { status: 503 }
  );
}
