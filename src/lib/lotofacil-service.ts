"use server";

import { supabase } from "@/integrations/supabase/client";
import { processConcursoData } from "./lotofacil-utils";

/**
 * Busca dados da Lotofácil usando a API Guidi (Primária) com Fallback.
 */
async function fetchConcursoFromAnywhere(num?: number) {
  const providers = [
    // Provedor 1: API Guidi (Gratuita e Estável)
    async () => {
      const url = num 
        ? `https://api.guidi.dev.br/loteria/lotofacil/${num}`
        : `https://api.guidi.dev.br/loteria/lotofacil/ultimo`;
      
      const res = await fetch(url, { 
        cache: 'no-store',
        headers: { 'Accept': 'application/json' }
      });
      
      if (!res.ok) return null;
      const d = await res.json();
      
      // Normalização para o processador
      return { 
        concurso: d.numero || d.concurso, 
        data: d.data, 
        dezenas: d.listaDezenas || d.dezenas, 
        rateio: d.listaRateio || d.premiacoes, 
        estimativa: d.valorEstimadoProximoConcurso 
      };
    },
    // Provedor 2: Loterias API Vercel (Fallback)
    async () => {
      const url = num 
        ? `https://loterias-api.vercel.app/api/lotofacil/${num}`
        : `https://loterias-api.vercel.app/api/lotofacil/latest`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return null;
      const d = await res.json();
      return { 
        concurso: d.concurso || d.numero, 
        data: d.data, 
        dezenas: d.dezenas, 
        rateio: d.premiacoes || d.listaRateio, 
        estimativa: d.valorEstimadoProximoConcurso 
      };
    }
  ];

  for (const provider of providers) {
    try {
      const data = await provider();
      if (data && data.dezenas && data.dezenas.length === 15) return data;
    } catch (e) {
      continue;
    }
  }
  return null;
}

export const syncLatestResults = async () => {
  try {
    // 1. Identifica o último concurso no banco (ex: 3613)
    const { data: lastSaved } = await supabase
      .from('concursos')
      .select('concurso')
      .order('concurso', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastNum = lastSaved?.concurso || 0;
    
    // 2. Verifica qual o último concurso disponível na API
    const latestOnline = await fetchConcursoFromAnywhere();
    if (!latestOnline) return { success: false, message: "Servidores de resultados indisponíveis." };

    const targetNum = Number(latestOnline.concurso);
    
    // Se o banco já tem o último, não faz nada
    if (targetNum <= lastNum) {
      return { success: true, message: "Base de dados sincronizada.", latest: lastNum };
    }

    let count = 0;
    // 3. Sincronização Incremental: busca apenas do (lastNum + 1) até o targetNum
    for (let i = lastNum + 1; i <= targetNum; i++) {
      const rawData = await fetchConcursoFromAnywhere(i);
      if (!rawData) continue;

      // Busca o anterior para calcular repetidas
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
      message: count > 0 ? `${count} novos concursos adicionados.` : "Sincronizado.",
      latest: targetNum
    };
  } catch (error: any) {
    console.error('[Sync Error]', error);
    return { success: false, message: "Falha na atualização incremental." };
  }
};