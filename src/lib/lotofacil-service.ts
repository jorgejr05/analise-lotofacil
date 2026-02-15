"use server";

import { supabase } from "@/integrations/supabase/client";
import { processConcursoData } from "./lotofacil-utils";

/**
 * Provedor 1: API Oficial da Caixa (Direto)
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
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
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
 * Provedor 2: Loterias API (Vercel) - Geralmente o mais rápido a atualizar
 */
async function fetchFromTertiary(num?: number) {
  try {
    const url = num 
      ? `https://loterias-api.vercel.app/api/lotofacil/${num}`
      : `https://loterias-api.vercel.app/api/lotofacil/latest`;
    
    const response = await fetch(url, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
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
 * Provedor 3: API Alternativa (Geralmente usada como fallback de segurança)
 */
async function fetchFromQuaternary(num?: number) {
  try {
    const url = `https://loteriascaixa-api.herokuapp.com/api/lotofacil/${num || 'latest'}`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return null;
    const data = await response.json();
    return {
      concurso: data.concurso || data.numero,
      data: data.data,
      dezenas: data.dezenas?.map(Number).sort((a: number, b: number) => a - b),
      listaRateio: data.premiacoes || data.listaRateio,
      valorEstimadoProximoConcurso: data.valorEstimadoProximoConcurso || 0,
      source: 'quaternary'
    };
  } catch (e) {
    return null;
  }
}

export const syncLatestResults = async () => {
  try {
    console.log("[lotofacil-service] Iniciando sincronização profunda...");
    
    // 1. Descobrir qual é o último concurso disponível no mundo
    let latestRaw = await fetchFromTertiary(); 
    if (!latestRaw) latestRaw = await fetchFromOfficial();
    if (!latestRaw) latestRaw = await fetchFromQuaternary();
    
    if (!latestRaw) throw new Error("Não foi possível conectar a nenhum provedor de loterias.");

    const latestNum = Number(latestRaw.concurso);
    console.log(`[lotofacil-service] Último concurso detectado: ${latestNum}`);

    // 2. Verificar o último que temos no banco
    const { data: lastSaved } = await supabase
      .from('concursos')
      .select('concurso')
      .order('concurso', { ascending: false })
      .limit(1)
      .maybeSingle();

    const startFrom = lastSaved ? Math.min(lastSaved.concurso, latestNum - 5) : latestNum - 10;
    const finalStart = Math.max(1, startFrom);

    let count = 0;
    
    // 3. Loop de preenchimento
    for (let i = finalStart; i <= latestNum; i++) {
      let data = null;
      
      data = await fetchFromTertiary(i);
      if (!data) data = await fetchFromOfficial(i);
      if (!data) data = await fetchFromQuaternary(i);
      
      if (!data || !data.dezenas || data.dezenas.length !== 15) {
        console.warn(`[lotofacil-service] Falha ao obter dados válidos para o concurso ${i}`);
        continue;
      }

      const { data: anterior } = await supabase
        .from('concursos')
        .select('*')
        .eq('concurso', i - 1)
        .maybeSingle();

      const processed = processConcursoData(data, anterior || undefined);
      
      const { error } = await supabase
        .from('concursos')
        .upsert(processed, { onConflict: 'concurso' });
      
      if (!error) {
        count++;
        console.log(`[lotofacil-service] Concurso ${i} sincronizado com sucesso.`);
      } else {
        console.error(`[lotofacil-service] Erro ao salvar concurso ${i}:`, error);
      }
    }

    return { 
      success: true, 
      message: count > 0 ? `Sincronizados ${count} resultados (Último: ${latestNum}).` : "O sistema já está em sincronia com os provedores.",
      latest: latestNum
    };
  } catch (error: any) {
    console.error('[lotofacil-service] Erro crítico na sincronização:', error);
    throw error;
  }
};