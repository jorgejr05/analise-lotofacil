"use server";

import { supabase } from "@/integrations/supabase/client";
import { processConcursoData } from "./lotofacil-utils";

/**
 * Busca dados de um concurso específico na API Guidi.
 */
async function fetchGuidiData(num: number) {
  try {
    // Adicionamos um timestamp para evitar cache agressivo de provedores
    const url = `https://api.guidi.dev.br/loteria/lotofacil/${num}?t=${Date.now()}`;
    const res = await fetch(url, { 
      cache: 'no-store',
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'LotoExpert-App'
      }
    });
    
    if (!res.ok) return null;
    const data = await res.json();
    
    // Validação rigorosa: a API Guidi retorna o número do concurso no campo 'numero'
    if (!data || !data.numero || !data.listaDezenas) return null;
    
    return data;
  } catch (error) {
    console.error(`[Guidi API Error] Concurso ${num}:`, error);
    return null;
  }
}

/**
 * Determina se há concursos pendentes comparando o banco com o calendário.
 */
export async function getNextDrawInfo() {
  const { data: lastSaved } = await supabase
    .from('concursos')
    .select('concurso, data')
    .order('concurso', { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastNum = lastSaved?.concurso || 0;
  const nextNum = lastNum + 1;
  
  const now = new Date();
  const currentHour = now.getHours();
  
  // Data do último sorteio que DEVERIA ter acontecido (Seg-Sáb 20h)
  const lastExpectedDraw = new Date();
  if (currentHour < 20) {
    lastExpectedDraw.setDate(lastExpectedDraw.getDate() - 1);
  }
  if (lastExpectedDraw.getDay() === 0) { // Domingo não tem sorteio
    lastExpectedDraw.setDate(lastExpectedDraw.getDate() - 1);
  }
  lastExpectedDraw.setHours(20, 0, 0, 0);

  const lastSavedDate = lastSaved?.data ? new Date(lastSaved.data + 'T20:00:00') : new Date(0);
  const isPendingSync = lastSavedDate < lastExpectedDraw;

  return {
    lastNum,
    nextNum,
    isPendingSync,
    nextDrawDate: calculateNextDrawDate(now)
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
 * Sincronização Forçada: Tenta buscar o próximo concurso.
 */
export const syncLatestResults = async () => {
  try {
    const { data: lastSaved } = await supabase
      .from('concursos')
      .select('concurso')
      .order('concurso', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastNum = lastSaved?.concurso || 0;
    let currentTarget = lastNum + 1;
    let count = 0;
    let lastSynced = lastNum;

    // Busca sequencial para garantir que não pulamos nenhum concurso
    while (count < 5) {
      const rawData = await fetchGuidiData(currentTarget);
      
      if (!rawData) {
        console.log(`[Sync] Concurso ${currentTarget} ainda não disponível na API.`);
        break;
      }

      const { data: anterior } = await supabase
        .from('concursos')
        .select('*')
        .eq('concurso', currentTarget - 1)
        .maybeSingle();

      const processed = processConcursoData(rawData, anterior || undefined);
      
      const { error } = await supabase
        .from('concursos')
        .upsert(processed, { onConflict: 'concurso' });
      
      if (error) {
        console.error("[Sync Error] Falha de RLS ou Banco:", error.message);
        return { success: false, message: error.message };
      }

      lastSynced = currentTarget;
      currentTarget++;
      count++;
    }

    return { 
      success: true, 
      count,
      latest: lastSynced 
    };
  } catch (error: any) {
    console.error("[Sync Error] Falha crítica:", error);
    return { success: false, message: "Erro de conexão." };
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
 * Busca dados da API Guidi com retry automático.
 * Aguarda 300ms entre tentativas para evitar rate limit.
 */
async function fetchGuidiComRetry(num: number, tentativas = 3): Promise<any | null> {
  for (let t = 0; t < tentativas; t++) {
    try {
      const url = `https://api.guidi.dev.br/loteria/lotofacil/${num}?t=${Date.now()}`;
      const res = await fetch(url, {
        cache: "no-store",
        headers: { Accept: "application/json", "User-Agent": "LotoExpert-Importer" },
      });
      if (!res.ok) {
        if (res.status === 404) return null; // Concurso não existe, parar
        await new Promise(r => setTimeout(r, 300));
        continue;
      }
      const data = await res.json();
      if (!data?.numero || !data?.listaDezenas) return null;
      return data;
    } catch {
      if (t < tentativas - 1) await new Promise(r => setTimeout(r, 300));
    }
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
    const rawResults = await Promise.all(lote.map(n => fetchGuidiComRetry(n)));

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