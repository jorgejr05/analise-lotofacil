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