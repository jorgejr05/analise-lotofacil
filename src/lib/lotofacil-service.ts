"use server";

import { supabase } from "@/integrations/supabase/client";
import { processConcursoData } from "./lotofacil-utils";

// =============================================================================
// FONTES DE DADOS — Fallback em cadeia para garantir disponibilidade na Vercel
//
// PROBLEMA: API Guidi bloqueia IPs de fora do Brasil (servidores Vercel = EUA).
// SOLUÇÃO:  Usar a API oficial da Caixa como fonte primária (sem restrição geo)
//           e a Guidi como fallback secundário (útil em dev local).
// =============================================================================

const CAIXA_BASE = 'https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil';
const GUIDI_BASE = 'https://api.guidi.dev.br/loteria/lotofacil';

/** Valida que o payload tem os campos mínimos necessários */
function isValidPayload(data: any): boolean {
  return !!data && !!data.numero && Array.isArray(data.listaDezenas) && data.listaDezenas.length === 15;
}

/**
 * Busca dados de um concurso específico.
 * Tenta a API da Caixa primeiro (sem bloqueio geo).
 * Cai na Guidi se a Caixa falhar (útil em dev local).
 */
async function fetchConcursoData(num: number): Promise<any | null> {
  // ── Fonte 1: API Oficial da Caixa Econômica Federal ──────────────────────
  try {
    const res = await fetch(`${CAIXA_BASE}/${num}`, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json', 'User-Agent': 'LotoExpert-App' },
    });
    if (res.ok) {
      const data = await res.json();
      if (isValidPayload(data)) {
        console.log(`[Caixa API] Concurso ${num} OK.`);
        return data;
      }
    }
  } catch (err) {
    console.warn(`[Caixa API] Concurso ${num} falhou, tentando Guidi...`, err);
  }

  // ── Fonte 2: Guidi (fallback, funciona só do Brasil) ─────────────────────
  try {
    const res = await fetch(`${GUIDI_BASE}/${num}?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json', 'User-Agent': 'LotoExpert-App' },
    });
    if (res.ok) {
      const data = await res.json();
      if (isValidPayload(data)) {
        console.log(`[Guidi API] Concurso ${num} OK (fallback).`);
        return data;
      }
    }
  } catch (err) {
    console.error(`[Guidi API] Concurso ${num} também falhou:`, err);
  }

  return null;
}

/**
 * Busca o número do concurso mais recente disponível.
 * Tenta a API da Caixa (endpoint vazio = último) e cai na Guidi como fallback.
 */
async function fetchUltimoConcursoNum(): Promise<number | null> {
  // ── Fonte 1: Caixa (endpoint raiz retorna o último concurso) ─────────────
  try {
    const res = await fetch(`${CAIXA_BASE}/`, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json', 'User-Agent': 'LotoExpert-App' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.numero) {
        console.log(`[Caixa API] Último concurso: #${data.numero}`);
        return Number(data.numero);
      }
    }
  } catch (err) {
    console.warn('[Caixa API] Falha ao buscar último, tentando Guidi...', err);
  }

  // ── Fonte 2: Guidi /ultimo (fallback) ────────────────────────────────────
  try {
    const res = await fetch(`${GUIDI_BASE}/ultimo?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json', 'User-Agent': 'LotoExpert-App' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.numero) return Number(data.numero);
    }
  } catch {}

  return null;
}


/**
 * Determina se há concursos pendentes comparando o banco com a API.
 * Usa o endpoint /ultimo para saber o número real do último sorteio.
 */
export async function getNextDrawInfo() {
  const { data: lastSaved } = await supabase
    .from('concursos')
    .select('concurso, data')
    .order('concurso', { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastNum = lastSaved?.concurso || 0;

  // Busca o concurso mais recente disponível na API
  const apiLatestNum = await fetchUltimoConcursoNum();
  const nextNum = lastNum + 1;

  // Há pendência se a API tem concursos além do que está no banco
  const isPendingSync = apiLatestNum !== null && apiLatestNum > lastNum;
  const concursosFaltando = isPendingSync && apiLatestNum ? apiLatestNum - lastNum : 0;

  return {
    lastNum,
    nextNum,
    apiLatestNum,
    isPendingSync,
    concursosFaltando,
    nextDrawDate: calculateNextDrawDate(new Date())
  };
}

function calculateNextDrawDate(now: Date) {
  const next = new Date(now);
  const hour = next.getHours();
  const day = next.getDay();

  if (day === 0) {
    next.setDate(next.getDate() + 1);
  } else if (day === 6 && hour >= 20) {
    next.setDate(next.getDate() + 2);
  } else if (hour >= 20) {
    next.setDate(next.getDate() + 1);
  }
  
  next.setHours(20, 0, 0, 0);
  return next;
}

/**
 * Sincronização Inteligente:
 * 1. Detecta o concurso mais recente disponível na API (/ultimo)
 * 2. Calcula o gap real entre o banco e a API
 * 3. Importa TODOS os concursos faltando em lotes paralelos de 5
 * Suporta gaps grandes (ex: 100+ concursos) sem travar.
 */
export const syncLatestResults = async () => {
  try {
    // Descobre o último salvo no banco
    const { data: lastSaved } = await supabase
      .from('concursos')
      .select('concurso')
      .order('concurso', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastNum = lastSaved?.concurso || 0;

    // Descobre o último disponível na API
    const apiLatestNum = await fetchUltimoConcursoNum();

    if (!apiLatestNum) {
      console.log('[Sync] Não foi possível contatar a API Guidi.');
      return { success: false, message: 'API Guidi indisponível.' };
    }

    if (apiLatestNum <= lastNum) {
      console.log(`[Sync] Banco já está atualizado (${lastNum} = API ${apiLatestNum}).`);
      return { success: true, count: 0, latest: lastNum };
    }

    const gap = apiLatestNum - lastNum;
    console.log(`[Sync] Gap detectado: ${gap} concurso(s) faltando (#${lastNum + 1} até #${apiLatestNum}).`);

    // Monta lista de concursos a buscar
    const targets: number[] = [];
    for (let n = lastNum + 1; n <= apiLatestNum; n++) targets.push(n);

    let count = 0;
    let lastSynced = lastNum;
    const BATCH = 5; // lotes paralelos de 5 para não sobrecarregar a API

    for (let i = 0; i < targets.length; i += BATCH) {
      const lote = targets.slice(i, i + BATCH);

      // Busca o lote em paralelo
      const rawResults = await Promise.all(lote.map(n => fetchConcursoData(n)));

      const registros: any[] = [];
      for (let j = 0; j < lote.length; j++) {
        const num = lote[j];
        const raw = rawResults[j];
        if (!raw) {
          console.log(`[Sync] Concurso ${num} ainda não disponível na API.`);
          continue;
        }

        const { data: anterior } = await supabase
          .from('concursos')
          .select('*')
          .eq('concurso', num - 1)
          .maybeSingle();

        registros.push(processConcursoData(raw, anterior || undefined));
        lastSynced = Math.max(lastSynced, num);
      }

      if (registros.length > 0) {
        const { error } = await supabase
          .from('concursos')
          .upsert(registros, { onConflict: 'concurso' });

        if (error) {
          console.error('[Sync Error] Falha ao salvar lote:', error.message);
          return { success: false, message: error.message };
        }
        count += registros.length;
      }

      // Delay respeitoso entre lotes
      if (i + BATCH < targets.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    console.log(`[Sync] Concluído: ${count} concurso(s) importado(s). Último: #${lastSynced}.`);
    return { success: true, count, latest: lastSynced };

  } catch (error: any) {
    console.error('[Sync Error] Falha crítica:', error);
    return { success: false, message: 'Erro de conexão.' };
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
 * Busca dados de um concurso com retry automático.
 * Usa fallback Caixa → Guidi (mesmo esquema da fetchConcursoData).
 * Aguarda 300ms entre tentativas para evitar rate limit.
 */
async function fetchConcursoComRetry(num: number, tentativas = 3): Promise<any | null> {
  for (let t = 0; t < tentativas; t++) {
    const data = await fetchConcursoData(num);
    if (data) return data;
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