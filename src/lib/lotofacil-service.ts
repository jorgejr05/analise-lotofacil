"use server";

import { supabase } from "@/integrations/supabase/client";
import { processConcursoData } from "./lotofacil-utils";

/**
 * Busca dados de um concurso específico ou o último disponível.
 */
async function fetchGuidiData(num?: number) {
  try {
    const url = num 
      ? `https://api.guidi.dev.br/loteria/lotofacil/${num}`
      : `https://api.guidi.dev.br/loteria/lotofacil/ultimo`;
    
    const res = await fetch(url, { 
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });
    
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("[Guidi API Error]", error);
    return null;
  }
}

/**
 * Calcula informações sobre o próximo sorteio esperado.
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
  const currentDay = now.getDay(); // 0 = Domingo, 1 = Segunda... 6 = Sábado

  // Lotofácil: Segunda (1) a Sábado (6) às 20h
  const isDrawDay = currentDay >= 1 && currentDay <= 6;
  const isAfterDrawTime = currentHour >= 20;
  
  // Se for dia de sorteio e já passou das 20h, estamos "em busca" do resultado
  const isWaitingResult = isDrawDay && isAfterDrawTime;

  return {
    lastNum,
    nextNum,
    isWaitingResult,
    nextDrawDate: calculateNextDrawDate(now)
  };
}

function calculateNextDrawDate(now: Date) {
  const next = new Date(now);
  const hour = next.getHours();
  const day = next.getDay();

  // Se for domingo, o próximo é segunda
  if (day === 0) {
    next.setDate(next.getDate() + 1);
  } 
  // Se for sábado após as 20h, o próximo é segunda
  else if (day === 6 && hour >= 20) {
    next.setDate(next.getDate() + 2);
  }
  // Se for dia de semana após as 20h, o próximo é amanhã
  else if (hour >= 20) {
    next.setDate(next.getDate() + 1);
  }
  
  next.setHours(20, 0, 0, 0);
  return next;
}

/**
 * Sincronização Proativa: Busca sequencialmente a partir do último salvo.
 */
export const syncLatestResults = async () => {
  try {
    const { lastNum } = await getNextDrawInfo();
    let currentTarget = lastNum + 1;
    let count = 0;
    let lastSynced = lastNum;

    // Tenta buscar o próximo número sequencialmente
    // Fazemos um loop pequeno (max 5) para evitar travar se houver muitos atrasados
    while (count < 5) {
      const rawData = await fetchGuidiData(currentTarget);
      
      // Se a API não retornou o concurso (ainda não sorteado ou erro)
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
      
      if (error) {
        console.error(`[Sync Error] Falha no concurso ${currentTarget}:`, error.message);
        break;
      }

      lastSynced = currentTarget;
      currentTarget++;
      count++;
    }

    if (count > 0) {
      return { 
        success: true, 
        message: `${count} novos concursos (até #${lastSynced}) sincronizados.`,
        latest: lastSynced 
      };
    }

    return { success: true, message: "Sistema já está na última versão disponível.", latest: lastNum };
  } catch (error: any) {
    console.error('[Sync Error Global]', error);
    return { success: false, message: "Erro na rede de inteligência." };
  }
};