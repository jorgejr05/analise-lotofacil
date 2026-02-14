"use server";

import { supabase } from "@/integrations/supabase/client";
import { generateProbabilisticGames } from "./generator-service";

interface BacktestConfig {
  userId: string;
  startConcurso: number;
  endConcurso: number;
  gamesPerContest: number;
  model: 'gemini' | 'random';
}

export const runBacktestBatch = async (config: BacktestConfig, backtestId: string) => {
  const { startConcurso, endConcurso, gamesPerContest, model } = config;
  
  for (let c = startConcurso; c <= endConcurso; c++) {
    // 1. Busca histórico cego (apenas o que existia antes do concurso testado)
    const { data: pastConcursos } = await supabase
      .from('concursos')
      .select('*')
      .lt('concurso', c)
      .order('concurso', { ascending: false })
      .limit(500);

    if (!pastConcursos || pastConcursos.length < 200) continue;

    // 2. Busca o resultado real para conferência
    const { data: realResult } = await supabase
      .from('concursos')
      .select('dezenas')
      .eq('concurso', c)
      .single();

    if (!realResult) continue;

    let generatedGames: number[][] = [];
    
    if (model === 'random') {
      // Geração aleatória para baseline
      for (let i = 0; i < gamesPerContest; i++) {
        const game: number[] = [];
        while (game.length < 15) {
          const n = Math.floor(Math.random() * 25) + 1;
          if (!game.includes(n)) game.push(n);
        }
        generatedGames.push(game.sort((a, b) => a - b));
      }
    } else {
      // Usa o modelo adaptativo (Windowed Probability)
      const stats = calculateWindowedStats(pastConcursos);
      generatedGames = generateProbabilisticGames(stats as any, gamesPerContest);
    }

    const points = generatedGames.map(game => 
      game.filter(num => realResult.dezenas.includes(num)).length
    );

    // 3. Salva progresso incremental
    await supabase.from('backtest_results').insert({
      backtest_id: backtestId,
      concurso_testado: c,
      pontos_obtidos: points
    });

    const total = endConcurso - startConcurso + 1;
    const current = c - startConcurso + 1;
    const percent = Math.round((current / total) * 100);
    await supabase.from('backtests').update({ progresso: percent }).eq('id', backtestId);
  }

  await finalizeBacktest(backtestId);
};

function calculateWindowedStats(concursos: any[]) {
  const calcFreq = (list: any[]) => {
    const freq: Record<number, number> = {};
    for (let i = 1; i <= 25; i++) freq[i] = 0;
    list.forEach(c => c.dezenas.forEach((d: number) => freq[d]++));
    Object.keys(freq).forEach(k => freq[Number(k)] = (freq[Number(k)] / list.length) * 100);
    return freq;
  };

  return {
    freq50: calcFreq(concursos.slice(0, 50)),
    freq200: calcFreq(concursos.slice(0, 200)),
    freqTotal: calcFreq(concursos),
    atraso: calculateAtraso(concursos),
    somaMedia: concursos.slice(0, 100).reduce((acc, c) => acc + c.soma, 0) / 100,
    paresMedia: concursos.slice(0, 100).reduce((acc, c) => acc + c.pares, 0) / 100,
    ultimoConcurso: concursos[0]
  };
}

function calculateAtraso(concursos: any[]) {
  const atraso: Record<number, number> = {};
  for (let i = 1; i <= 25; i++) {
    const lastIndex = concursos.findIndex(c => c.dezenas.includes(i));
    atraso[i] = lastIndex === -1 ? 100 : lastIndex;
  }
  return atraso;
}

async function finalizeBacktest(id: string) {
  const { data: results } = await supabase
    .from('backtest_results')
    .select('pontos_obtidos')
    .eq('backtest_id', id);

  if (!results) return;

  const allPoints = results.flatMap(r => r.pontos_obtidos);
  const totalGames = allPoints.length;
  
  const metrics = {
    p11: (allPoints.filter(p => p === 11).length / totalGames) * 100,
    p12: (allPoints.filter(p => p === 12).length / totalGames) * 100,
    p13: (allPoints.filter(p => p === 13).length / totalGames) * 100,
    p14: (allPoints.filter(p => p === 14).length / totalGames) * 100,
    media: allPoints.reduce((a, b) => a + b, 0) / totalGames
  };

  await supabase.from('backtests').update({ 
    status: 'concluido', 
    resultado_json: metrics 
  }).eq('id', id);
}