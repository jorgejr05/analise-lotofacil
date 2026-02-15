"use server";

import { supabase } from "@/integrations/supabase/client";
import { processConcursoData } from "./lotofacil-utils";

/**
 * Busca dados da Lotofácil exclusivamente via API Guidi.
 * @param num Número do concurso opcional. Se omitido, busca o último.
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

export const syncLatestResults = async () => {
  try {
    // 1. Identifica o último concurso registrado no banco de dados
    const { data: lastSaved } = await supabase
      .from('concursos')
      .select('concurso')
      .order('concurso', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastNum = lastSaved?.concurso || 0;
    
    // 2. Verifica qual o último concurso disponível na API Guidi
    const latestOnline = await fetchGuidiData();
    if (!latestOnline) {
      return { success: false, message: "Não foi possível conectar à API Guidi." };
    }

    const targetNum = Number(latestOnline.numero);
    
    // Se já estamos atualizados, encerra o processo
    if (targetNum <= lastNum) {
      return { success: true, message: "O sistema já possui todos os dados atualizados.", latest: lastNum };
    }

    let count = 0;
    // 3. Sincronização Incremental: processa apenas os novos concursos
    for (let i = lastNum + 1; i <= targetNum; i++) {
      const rawData = await fetchGuidiData(i);
      if (!rawData) continue;

      // Busca o concurso anterior para calcular as dezenas repetidas
      const { data: anterior } = await supabase
        .from('concursos')
        .select('*')
        .eq('concurso', i - 1)
        .maybeSingle();

      const processed = processConcursoData(rawData, anterior || undefined);
      
      const { error } = await supabase
        .from('concursos')
        .upsert(processed, { onConflict: 'concurso' });
      
      if (!error) count++;
    }

    return { 
      success: true, 
      message: count > 0 ? `Sucesso: ${count} novos concursos sincronizados.` : "Sincronizado.",
      latest: targetNum
    };
  } catch (error: any) {
    console.error('[Sync Error]', error);
    return { success: false, message: "Erro ao processar atualização incremental." };
  }
};