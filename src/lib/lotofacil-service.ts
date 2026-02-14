"use server";

import { supabase } from "@/integrations/supabase/client";

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
    
    // Mapeamento do formato oficial da Caixa
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

export const calculatePoints = (jogoDezenas: number[], sorteioDezenas: number[]) => {
  return jogoDezenas.filter(num => sorteioDezenas.includes(num)).length;
};

export const processConcursoData = (data: any, anterior?: Concurso): Concurso => {
  const dezenas = data.dezenas || [];
  const soma = dezenas.reduce((acc: number, curr: number) => acc + curr, 0);
  const pares = dezenas.filter((n: number) => n % 2 === 0).length;
  const impares = 15 - pares;
  
  let repetidas_anterior = 0;
  if (anterior && dezenas.length > 0) {
    repetidas_anterior = dezenas.filter((n: number) => anterior.dezenas.includes(n)).length;
  }

  // Normalização do Rateio entre diferentes provedores
  let rawRateio = data.listaRateio || data.premiacoes || [];
  const prizesMap: Record<number, { valor: number, ganhadores: number }> = {};
  
  rawRateio.forEach((p: any) => {
    // A oficial usa 'numeroDeAcertos', a secundária usa 'descricao'
    const numHits = p.numeroDeAcertos || (p.descricao?.match(/(\d+) acertos/)?.[1]) || (16 - p.faixa);
    const hits = Number(numHits);
    
    prizesMap[hits] = {
      valor: Number(p.valor || p.valorPremio || 0),
      ganhadores: Number(p.numeroDeGanhadores || p.ganhadores || 0)
    };
  });

  // Injeção de valores fixos (11, 12, 13)
  if (!prizesMap[11] || prizesMap[11].valor <= 0) prizesMap[11] = { valor: 7, ganhadores: prizesMap[11]?.ganhadores || 0 };
  if (!prizesMap[12] || prizesMap[12].valor <= 0) prizesMap[12] = { valor: 14, ganhadores: prizesMap[12]?.ganhadores || 0 };
  if (!prizesMap[13] || prizesMap[13].valor <= 0) prizesMap[13] = { valor: 35, ganhadores: prizesMap[13]?.ganhadores || 0 };

  const premiacao_json = [15, 14, 13, 12, 11].map(hits => ({
    faixa: 16 - hits,
    descricao: `${hits} acertos`,
    valor: prizesMap[hits]?.valor || 0,
    ganhadores: prizesMap[hits]?.ganhadores || 0
  }));

  const formattedDate = data.data?.includes('/') 
    ? data.data.split('/').reverse().join('-') 
    : data.data;

  return {
    concurso: Number(data.concurso),
    data: formattedDate,
    dezenas,
    soma,
    pares,
    impares,
    repetidas_anterior,
    premiacao_json,
    valor_estimado: Number(data.valorEstimadoProximoConcurso || 0)
  };
};

export const syncLatestResults = async () => {
  try {
    // Tenta pegar o último da Oficial, se não der vai na secundária
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
        // Tenta buscar o concurso específico
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

    return { message: `Sincronização concluída com motor multi-provedor.` };
  } catch (error) {
    console.error('Erro na sincronização:', error);
    throw error;
  }
};