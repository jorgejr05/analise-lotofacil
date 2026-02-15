"use server";

import { supabase } from "@/integrations/supabase/client";
import { processConcursoData } from "./lotofacil-utils";

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
    const { data: lastSaved } = await supabase
      .from('concursos')
      .select('concurso')
      .order('concurso', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastNum = lastSaved?.concurso || 0;
    const latestOnline = await fetchGuidiData();
    
    if (!latestOnline) return { success: false, message: "API Guidi offline." };

    const targetNum = Number(latestOnline.numero);
    
    if (targetNum <= lastNum) {
      return { success: true, message: "Dados já estão atualizados.", latest: lastNum };
    }

    let count = 0;
    for (let i = lastNum + 1; i <= targetNum; i++) {
      const rawData = await fetchGuidiData(i);
      if (!rawData) continue;

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
      message: count > 0 ? `${count} novos concursos sincronizados.` : "Sincronizado.",
      latest: targetNum
    };
  } catch (error: any) {
    console.error('[Sync Error]', error);
    return { success: false, message: "Erro na sincronização." };
  }
};