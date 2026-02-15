"use server";

import { supabase } from "@/integrations/supabase/client";
import { processConcursoData } from "./lotofacil-utils";

export interface Concurso {
  concurso: number;
  data: string;
  dezenas: number[];
  soma: number;
  pares: number;
  impares: number;
  repetidas_anterior?: number;
  premiacao_json?: any;
  valor_estimado?: number;
}

/**
 * Provedor 1: API Oficial da Caixa (Servidor)
 */
async function fetchFromOfficial(num?: number) {
  try {
    const url = num 
      ? `https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil/${num}`
      : `https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil/`;
    
    const response = await fetch(url, { 
      cache: 'no-store',
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      next: { revalidate: 0 }
    });
    
    if (!response.ok) return null;
    const data = await response.json();
    
    return {
      concurso: data.numero,
      data: data.dataApuração,
      dezenas: data.listaDezenas?.map(Number).sort((a: number, b: number) => a - b),
      listaRateio: data.listaRateio,
      valorEstimadoProximoConcurso: data.valorEstimadoProximoConcurso,
      source: 'oficial'
    };
  } catch (e) {
    return null;
  }
}

/**
 * Provedor 2: Loterias API (Vercel - Alta Disponibilidade)
 */
async function fetchFromTertiary(num?: number) {
  try {
    const url = num 
      ? `https://loterias-api.vercel.app/api/lotofacil/${num}`
      : `https://loterias-api.vercel.app/api/lotofacil/latest`;
    
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return null;
    const data = await response.json();
    
    return {
      concurso: data.concurso || data.numero,
      data: data.data,
      dezenas: data.dezenas?.map(Number).sort((a: number, b: number) => a - b),
      listaRateio: data.premiacoes || data.listaRateio,
      valorEstimadoProximoConcurso: data.valorEstimadoProximoConcurso,
      source: 'tertiary'
    };
  } catch (e) {
    return null;
  }
}

/**
 * Provedor 3: Heroku API (Fallback)
 */
async function fetchFromSecondary(num?: number) {
  try {
    const url = num 
      ? `https://loteriascaixa-api.herokuapp.com/api/lotofacil/${num}`
      : `https://loteriascaixa-api.herokuapp.com/api/lotofacil/latest`;
    
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return null;
    const data = await response.json();
    return { ...data, source: 'secondary' };
  } catch (e) {
    return null;
  }
}

export const syncLatestResults = async () => {
  try {
    // Tenta obter o número do último concurso de qualquer provedor
    let latestRaw = await fetchFromOfficial();
    if (!latestRaw) latestRaw = await fetchFromTertiary();
    if (!latestRaw) latestRaw = await fetchFromSecondary();
    
    if (!latestRaw) throw new Error("Todos os provedores de dados estão offline.");

    const latestNum = Number(latestRaw.concurso);

    // Verifica o que já temos no banco
    const { data: lastSaved } = await supabase
      .from('concursos')
      .select('concurso')
      .order('concurso', { ascending: false })
      .limit(1)
      .maybeSingle();

    const startFrom = lastSaved ? Math.max(1, lastSaved.concurso - 2) : Math.max(1, latestNum - 5);

    let count = 0;
    // Loop para preencher lacunas
    for (let i = startFrom; i <= latestNum; i++) {
      try {
        let data = await fetchFromOfficial(i);
        if (!data) data = await fetchFromTertiary(i);
        if (!data) data = await fetchFromSecondary(i);
        
        if (!data || !data.dezenas) continue;

        const { data: anterior } = await supabase
          .from('concursos')
          .select('*')
          .eq('concurso', i - 1)
          .maybeSingle();

        const processed = processConcursoData(data, anterior || undefined);
        
        if (processed.dezenas && processed.dezenas.length === 15) {
          const { error } = await supabase
            .from('concursos')
            .upsert(processed, { onConflict: 'concurso' });
          
          if (!error) count++;
        }
      } catch (err) {
        console.warn(`[Sync] Erro no concurso ${i}:`, err);
      }
    }

    return { 
      success: true, 
      message: count > 0 ? `Sincronizados ${count} novos resultados.` : "O sistema já está atualizado.",
      latest: latestNum
    };
  } catch (error: any) {
    console.error('[Sync Error]', error);
    throw error;
  }
};