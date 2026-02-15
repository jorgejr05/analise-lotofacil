"use server";

import { supabase } from "@/integrations/supabase/client";
import { processConcursoData } from "./lotofacil-utils";

/**
 * Tenta buscar um concurso específico em múltiplos provedores com bypass de cache total.
 */
async function fetchConcursoFromAnywhere(num?: number) {
  const providers = [
    // Provedor 1: Vercel (Geralmente o mais rápido)
    async () => {
      const url = num 
        ? `https://loterias-api.vercel.app/api/lotofacil/${num}`
        : `https://loterias-api.vercel.app/api/lotofacil/latest`;
      const res = await fetch(url, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } });
      if (!res.ok) return null;
      const d = await res.json();
      return { concurso: d.concurso || d.numero, data: d.data, dezenas: d.dezenas, rateio: d.premiacoes || d.listaRateio, estimativa: d.valorEstimadoProximoConcurso };
    },
    // Provedor 2: Caixa Oficial
    async () => {
      const url = num 
        ? `https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil/${num}`
        : `https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil/`;
      const res = await fetch(url, { 
        cache: 'no-store', 
        headers: { 
          'User-Agent': 'Mozilla/5.0', 
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        } 
      });
      if (!res.ok) return null;
      const d = await res.json();
      return { concurso: d.numero, data: d.dataApuração, dezenas: d.listaDezenas, rateio: d.listaRateio, estimativa: d.valorEstimadoProximoConcurso };
    },
    // Provedor 3: Heroku Fallback
    async () => {
      const url = `https://loteriascaixa-api.herokuapp.com/api/lotofacil/${num || 'latest'}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return null;
      const d = await res.json();
      return { concurso: d.concurso || d.numero, data: d.data, dezenas: d.dezenas, rateio: d.premiacoes || d.listaRateio, estimativa: d.valorEstimadoProximoConcurso };
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
    // 1. Pegar o último concurso que temos no banco
    const { data: lastSaved } = await supabase
      .from('concursos')
      .select('concurso')
      .order('concurso', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastNum = lastSaved?.concurso || 0;
    
    // 2. Descobrir qual o último concurso real disponível
    const latestOnline = await fetchConcursoFromAnywhere();
    const targetNum = latestOnline ? Math.max(Number(latestOnline.concurso), lastNum + 1) : lastNum + 1;

    console.log(`[Sync] Banco: ${lastNum} | Online: ${targetNum}`);

    let count = 0;
    // 3. Busca Exaustiva: Tenta o próximo número e os subsequentes (até 5 à frente do que a API diz ser o último)
    // Isso resolve casos onde a API de "latest" está atrasada mas a de "número específico" já funciona.
    for (let i = lastNum + 1; i <= targetNum + 2; i++) {
      const rawData = await fetchConcursoFromAnywhere(i);
      
      if (!rawData) {
        // Se não achou o próximo imediato, para a busca exaustiva
        if (i > targetNum) break;
        continue;
      }

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
      message: count > 0 ? `Sincronizados ${count} novos resultados.` : "O sistema já está atualizado.",
      latest: targetNum
    };
  } catch (error: any) {
    console.error('[Sync Error]', error);
    throw error;
  }
};