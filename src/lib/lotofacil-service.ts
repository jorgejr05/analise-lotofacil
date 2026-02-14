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
 * Provedor 1: API Oficial da Caixa (Só funciona no Servidor)
 */
async function fetchFromOfficial(num?: number) {
  try {
    const url = num 
      ? `https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil/${num}`
      : `https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil/`;
    
    const response = await fetch(url, { 
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    if (!response.ok) return null;
    const data = await response.json();
    
    return {
      concurso: data.numero,
      data: data.dataApuração,
      dezenas: data.listaDezenas.map(Number).sort((a: number, b: number) => a - b),
      listaRateio: data.listaRateio,
      valorEstimadoProximoConcurso: data.valorEstimadoProximoConcurso,
      source: 'oficial'
    };
  } catch (e) {
    return null;
  }
}

/**
 * Provedor 2: API Secundária (Fallback)
 */
async function fetchFromSecondary(num?: number) {
  try {
    const url = num 
      ? `https://loteriascaixa-api.herokuapp.com/api/lotofacil/${num}`
      : `https://loteriascaixa-api.herokuapp.com/api/lotofacil/latest`;
    
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    return { ...data, source: 'secondary' };
  } catch (e) {
    return null;
  }
}

export const syncLatestResults = async () => {
  try {
    let latestRaw = await fetchFromOfficial();
    if (!latestRaw) latestRaw = await fetchFromSecondary();
    if (!latestRaw) throw new Error("Todos os provedores falharam.");

    const latestNum = Number(latestRaw.concurso);

    const { data: lastSaved } = await supabase
      .from('concursos')
      .select('concurso')
      .order('concurso', { ascending: false })
      .limit(1)
      .maybeSingle();

    const startFrom = lastSaved ? Math.max(1, lastSaved.concurso - 3) : Math.max(1, latestNum - 10);

    let count = 0;
    for (let i = startFrom; i <= latestNum; i++) {
      try {
        let data = await fetchFromOfficial(i);
        if (!data) data = await fetchFromSecondary(i);
        if (!data) continue;

        const { data: anterior } = await supabase
          .from('concursos')
          .select('*')
          .eq('concurso', i - 1)
          .maybeSingle();

        const processed = processConcursoData(data, anterior || undefined);
        if (processed.dezenas.length === 15) {
          await supabase.from('concursos').upsert(processed, { onConflict: 'concurso' });
          count++;
        }
      } catch (err) {
        console.warn(`Erro no concurso ${i}:`, err);
      }
    }

    return { message: `Sincronização concluída com sucesso.` };
  } catch (error) {
    console.error('Erro na sincronização:', error);
    throw error;
  }
};