"use server";

import { supabase } from "@/integrations/supabase/client";
import { processConcursoData } from "./lotofacil-utils";
import { calculateNextDrawDate } from "./utils";


// =============================================================================
// SUPABASE EDGE FUNCTION — sync-lotofacil (sa-east-1, São Paulo)
//
// Todas as tentativas anteriores falharam porque:
//   - Server Actions (Vercel) → AWS us-east-1 → IPs bloqueados pelas APIs BR
//   - Edge Function Next.js → Cloudflare, mas chamada vem do servidor (EUA)
//   - API Caixa direta → também bloqueada de IPs internacionais
//
// SOLUÇÃO FINAL: Supabase Edge Function rodando em sa-east-1 (São Paulo).
//   Roda em Deno Deploy na região brasileira, acessa Caixa/Guidi sem bloqueio.
//   Suporta ?action=check (só status) e ?action=sync (importa tudo).
// =============================================================================

const EDGE_FN_URL = 'https://jkjjuicthxcmiidaiiof.supabase.co/functions/v1/sync-lotofacil';

/**
 * Determina se há concursos pendentes usando a Edge Function em SP.
 */
export async function getNextDrawInfo() {
  // Consulta o banco local para ter o lastNum como fallback imediato
  const { data: lastSaved } = await supabase
    .from('concursos')
    .select('concurso')
    .order('concurso', { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastNum = lastSaved?.concurso || 0;

  // Chama a Edge Function no modo "check" — não importa nada, só retorna status
  try {
    const res = await fetch(`${EDGE_FN_URL}?action=check`, { cache: 'no-store' });
    if (res.ok) {
      const info = await res.json();
      const apiLatestNum: number = info.apiLatest ?? lastNum;
      const isPendingSync = info.isPending === true;
      const concursosFaltando: number = info.gap ?? 0;

      return {
        lastNum,
        nextNum: lastNum + 1,
        apiLatestNum,
        isPendingSync,
        concursosFaltando,
        nextDrawDate: calculateNextDrawDate(new Date()),
      };
    }
  } catch (err) {
    console.warn('[EdgeFn] check falhou, usando dados locais:', err);
  }

  // Fallback: sem acesso à API, usa só o banco local
  return {
    lastNum,
    nextNum: lastNum + 1,
    apiLatestNum: null,
    isPendingSync: false,
    concursosFaltando: 0,
    nextDrawDate: calculateNextDrawDate(new Date()),
  };
}





/**
 * Sincronização via Supabase Edge Function (sa-east-1, São Paulo).
 * A Edge Function detecta o gap, busca da API da Caixa e salva tudo no banco.
 * Uma única chamada HTTP substitui toda a lógica anterior.
 */
export const syncLatestResults = async () => {
  try {
    console.log('[Sync] Chamando Edge Function sync-lotofacil...');
    const res = await fetch(`${EDGE_FN_URL}?action=sync`, {
      method: 'POST',
      cache: 'no-store',
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      console.error('[Sync] Edge Function retornou erro:', data.message);
      return { success: false, message: data.message || 'Erro na Edge Function.' };
    }

    console.log(`[Sync] Edge Function concluiu: ${data.count} importados. Último: #${data.latest}`);
    return { success: true, count: data.count, latest: data.latest };

  } catch (error: any) {
    console.error('[Sync] Falha ao chamar Edge Function:', error);
    return { success: false, message: 'Erro ao conectar com a Edge Function.' };
  }
};

// =============================================================================
// CARGA HISTÓRICA EM MASSA
// Importa concursos em lotes de 10 com retry automático (3 tentativas),
// delay entre lotes (respeita rate limit da API Guidi) e callback de progresso.
// =============================================================================

export interface SyncProgressPayload {
  concursoAtual: number;
  importados: number;
  erros: number;
  percentual: number;
  done: boolean;
  mensagem: string;
}

/**
 * Busca dados de um concurso com retry automático (Caixa → Guidi).
 * Usada pelo syncHistoricalBatch do painel Lab (importação histórica).
 */
async function fetchConcursoComRetry(num: number, tentativas = 3): Promise<any | null> {
  const CAIXA = 'https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil';
  const GUIDI  = 'https://api.guidi.dev.br/loteria/lotofacil';
  const h = { 'Accept': 'application/json', 'User-Agent': 'LotoExpert-Importer' };

  for (let t = 0; t < tentativas; t++) {
    // Tenta Caixa primeiro
    try {
      const r = await fetch(`${CAIXA}/${num}`, { cache: 'no-store', headers: h });
      if (r.ok) {
        const d = await r.json();
        if (d?.numero && Array.isArray(d?.listaDezenas) && d.listaDezenas.length === 15) return d;
      }
    } catch {}

    // Fallback Guidi
    try {
      const r = await fetch(`${GUIDI}/${num}?t=${Date.now()}`, { cache: 'no-store', headers: h });
      if (r.ok) {
        const d = await r.json();
        if (d?.numero && Array.isArray(d?.listaDezenas) && d.listaDezenas.length === 15) return d;
      }
    } catch {}

    if (t < tentativas - 1) await new Promise(r => setTimeout(r, 300));
  }
  return null;
}


/**
 * Importa um intervalo de concursos em lotes paralelos de `batchSize`.
 * Chama `onProgress` a cada lote para atualizar a UI sem bloquear.
 *
 * @param startConcurso - Primeiro concurso a importar (ex: 1)
 * @param endConcurso   - Último concurso a tentar importar (ex: 3400)
 * @param batchSize     - Tamanho de cada lote paralelo (default: 10)
 * @param onProgress    - Callback chamado com o estado atual a cada lote
 */
export async function syncHistoricalBatch(
  startConcurso: number,
  endConcurso: number,
  batchSize: number = 10,
  onProgress?: (payload: SyncProgressPayload) => void
): Promise<{ success: boolean; importados: number; erros: number; ultimoSalvo: number }> {
  let importados = 0;
  let erros = 0;
  let ultimoSalvo = startConcurso - 1;
  const total = endConcurso - startConcurso + 1;

  // Descobre concursos que já existem no banco para não reimportar
  const { data: jaExistem } = await supabase
    .from("concursos")
    .select("concurso")
    .gte("concurso", startConcurso)
    .lte("concurso", endConcurso);

  const setExistentes = new Set((jaExistem || []).map((r: any) => r.concurso));

  // Monta a lista de concursos que faltam
  const faltando: number[] = [];
  for (let n = startConcurso; n <= endConcurso; n++) {
    if (!setExistentes.has(n)) faltando.push(n);
  }

  if (faltando.length === 0) {
    onProgress?.({
      concursoAtual: endConcurso,
      importados: 0,
      erros: 0,
      percentual: 100,
      done: true,
      mensagem: `✅ Todos os ${total} concursos já estavam no banco.`,
    });
    return { success: true, importados: 0, erros: 0, ultimoSalvo: endConcurso };
  }

  // Processa em lotes
  for (let i = 0; i < faltando.length; i += batchSize) {
    const lote = faltando.slice(i, i + batchSize);

    // Busca todos do lote em paralelo
    const rawResults = await Promise.all(lote.map(n => fetchConcursoComRetry(n)));

    const registros: any[] = [];
    for (let j = 0; j < lote.length; j++) {
      const num = lote[j];
      const raw = rawResults[j];

      if (!raw) {
        erros++;
        continue;
      }

      // Busca o anterior (já importado ou no lote atual)
      const { data: anteriorDB } = await supabase
        .from("concursos")
        .select("dezenas")
        .eq("concurso", num - 1)
        .maybeSingle();

      const processed = processConcursoData(raw, anteriorDB || undefined);
      registros.push(processed);
      ultimoSalvo = Math.max(ultimoSalvo, num);
    }

    if (registros.length > 0) {
      const { error } = await supabase
        .from("concursos")
        .upsert(registros, { onConflict: "concurso" });

      if (error) {
        console.error(`[Batch Import] Erro ao salvar lote ${lote[0]}–${lote[lote.length - 1]}:`, error.message);
        erros += registros.length;
      } else {
        importados += registros.length;
      }
    }

    // Delay respeitoso entre lotes (evita sobrecarregar a API Guidi)
    if (i + batchSize < faltando.length) {
      await new Promise(r => setTimeout(r, 150));
    }

    // Notifica progresso
    const processados = Math.min(i + batchSize, faltando.length);
    const percentual = Math.round((processados / faltando.length) * 100);
    const concursoAtual = lote[lote.length - 1];

    onProgress?.({
      concursoAtual,
      importados,
      erros,
      percentual,
      done: false,
      mensagem: `Importando concurso #${concursoAtual}... (${processados}/${faltando.length})`,
    });
  }

  onProgress?.({
    concursoAtual: ultimoSalvo,
    importados,
    erros,
    percentual: 100,
    done: true,
    mensagem: `✅ Importação concluída: ${importados} salvos, ${erros} erros.`,
  });

  return { success: true, importados, erros, ultimoSalvo };
}