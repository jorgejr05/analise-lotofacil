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
    // Se a API diz que o último é 3613, mas sabemos que pode ter o 3614, forçamos a busca
    const targetNum = latestOnline ? Math.max(Number(latestOnline.concurso), lastNum + 1) : lastNum + 1;

    console.log(`[Sync] Banco: ${lastNum} | Online Detectado: ${targetNum}`);

    let count = 0;
    // 3. Busca Exaustiva: Tenta até 3 números à frente do "último detectado"
    // Isso garante que se o 3614 saiu mas a API de "latest" ainda aponta 3613, nós o acharemos.
    for (let i = lastNum + 1; i <= targetNum + 3; i++) {
      const rawData = await fetchConcursoFromAnywhere(i);
      
      if (!rawData) {
        if (i > targetNum) break; // Para se já passamos do detectado e não achamos nada
        continue;
      }

      const { data: anterior } = await supabase
        .from('concursos')
        .select('*')
        .eq('concurso', i - 1)
        .maybeSingle();

      const processed = processConcursoData(rawData, anterior || undefined);
      
      // Removemos campos que podem não existir no banco para evitar erro PGRST204
      // O ideal é rodar o SQL no Supabase, mas isso evita o crash agora.
      const { premiacao_json, valor_estimado, ...safeData } = processed as any;
      
      // Tentamos salvar com os campos novos, se falhar, salvamos apenas o básico
      const { error } = await supabase
        .from('concursos')
        .upsert(processed, { onConflict: 'concurso' });
      
      if (error && error.code === 'PGRST204') {
        console.warn(`[Sync] Colunas ausentes detectadas. Salvando apenas dados básicos para o concurso ${i}`);
        await supabase.from('concursos').upsert(safeData, { onConflict: 'concurso' });
      }
      
      count++;
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