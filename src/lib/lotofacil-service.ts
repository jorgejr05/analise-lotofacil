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
 * Calcula informações sobre o próximo sorteio esperado e detecta atrasos.
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
  const currentDay = now.getDay();

  // Lógica de detecção de atraso:
  // Se o último salvo foi sexta (#3612) e hoje é domingo, o #3613 (sábado) está atrasado.
  // Não esperamos segunda para buscar o #3613.
  
  const nextDrawDate = calculateNextDrawDate(now);
  
  // Se a data atual já passou das 20h de um dia de sorteio, ou se estamos em um dia 
  // posterior ao sorteio esperado do nextNum, estamos em "Atraso/Busca Ativa".
  const isWaitingResult = (currentDay >= 1 && currentDay <= 6 && currentHour >= 20) || (currentDay === 0);

  return {
    lastNum,
    nextNum,
    isWaitingResult,
    nextDrawDate
  };
}

function calculateNextDrawDate(now: Date) {
  const next = new Date(now);
  const hour = next.getHours();
  const day = next.getDay();

  // Se for domingo, o próximo oficial é segunda
  if (day === 0) {
    next.setDate(next.getDate() + 1);
  } 
  // Se for sábado após as 20h, o próximo oficial é segunda
  else if (day === 6 && hour >= 20) {
    next.setDate(next.getDate() + 2);
  }
  // Se for dia de semana após as 20h, o próximo oficial é amanhã
  else if (hour >= 20) {
    next.setDate(next.getDate() + 1);
  }
  
  next.setHours(20, 0, 0, 0);
  return next;
}

/**
 * Sincronização Sequencial: Busca o próximo número da fila até atualizar tudo.
 */
export const syncLatestResults = async () => {
  try {
    const { lastNum } = await getNextDrawInfo();
    let currentTarget = lastNum + 1;
    let count = 0;
    let lastSynced = lastNum;

    // Busca sequencial agressiva (até 10 por vez para tirar o atraso)
    while (count < 10) {
      const rawData = await fetchGuidiData(currentTarget);
      
      // Se a API não retornou o concurso alvo, paramos a sequência
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

    if (count > 0) {
      return { 
        success: true, 
        message: `${count} concurso(s) sincronizado(s) com sucesso.`,
        latest: lastSynced 
      };
    }

    return { success: true, message: "Base de dados atualizada.", latest: lastNum };
  } catch (error: any) {
    return { success: false, message: "Falha na conexão com a rede de sorteios." };
  }
};