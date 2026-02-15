"use server";

import { supabase } from "@/integrations/supabase/client";
import { processConcursoData } from "./lotofacil-utils";

/**
 * Busca dados de um concurso específico.
 */
async function fetchGuidiData(num: number) {
  try {
    const url = `https://api.guidi.dev.br/loteria/lotofacil/${num}`;
    const res = await fetch(url, { 
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });
    
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error(`[Guidi API Error] Concurso ${num}:`, error);
    return null;
  }
}

/**
 * Calcula informações sobre o estado da base de dados vs calendário oficial.
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
  const currentDay = now.getDay(); // 0=Dom, 1=Seg... 6=Sáb

  // Verifica se hoje é dia de sorteio (Seg-Sáb) e se já passou das 20h
  const isDrawDay = currentDay >= 1 && currentDay <= 6;
  const isAfterDrawTime = currentHour >= 20;
  
  // Se já passou das 20h de um dia de sorteio, o nextNum já deveria estar disponível
  const isPendingSync = isDrawDay && isAfterDrawTime;

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
 * Sincronização Controlada: Busca apenas o necessário para atualizar a base.
 */
export const syncLatestResults = async () => {
  try {
    const { lastNum } = await getNextDrawInfo();
    let currentTarget = lastNum + 1;
    let count = 0;
    let lastSynced = lastNum;

    // Limite de segurança: busca no máximo 5 concursos por chamada
    while (count < 5) {
      const rawData = await fetchGuidiData(currentTarget);
      
      if (!rawData || Number(rawData.numero) !== currentTarget) {
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
      
      if (error) break;

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
    return { success: false, message: "Erro na rede." };
  }
};