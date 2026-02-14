"use server";

import { supabase } from "@/integrations/supabase/client";

/**
 * Versão de Alta Precisão (50k simulações) para busca de 14/15 pontos.
 * Esta função busca os dados internamente para ser usada em Server Components/Actions.
 */
export async function generateAdvancedGames(count: number = 6) {
  const { data: concursos } = await supabase
    .from('concursos')
    .select('dezenas, soma, pares')
    .order('concurso', { ascending: false })
    .limit(200);

  const { data: activeModel } = await supabase
    .from('model_versions')
    .select('*')
    .eq('is_ativo', true)
    .maybeSingle();

  if (!concursos || concursos.length === 0) return [];

  const pesos = activeModel?.pesos_json || { f50: 0.35, f200: 0.30, ftot: 0.20, atr: 0.15 };
  
  const stats = Array.from({ length: 25 }, (_, i) => {
    const num = i + 1;
    const f50 = concursos.slice(0, 50).filter(c => c.dezenas.includes(num)).length / 50;
    const f200 = concursos.filter(c => c.dezenas.includes(num)).length / concursos.length;
    let lastIndex = concursos.findIndex(c => c.dezenas.includes(num));
    const atraso = lastIndex === -1 ? 10 : lastIndex;
    const score = (f50 * pesos.f50) + (f200 * pesos.f200) + (atraso * 0.1 * pesos.atr);
    return { num, score };
  });

  const candidates: { dezenas: number[], fitness: number }[] = [];
  for (let i = 0; i < 50000; i++) {
    const available = [...stats].sort((a, b) => b.score - a.score + (Math.random() * 0.2 - 0.1));
    const finalGame = available.slice(0, 15).map(d => d.num).sort((a, b) => a - b);
    
    const soma = finalGame.reduce((a, b) => a + b, 0);
    const pares = finalGame.filter(n => n % 2 === 0).length;
    const repetidas = finalGame.filter(n => concursos[0].dezenas.includes(n)).length;

    let fitness = 100;
    if (soma < 180 || soma > 210) fitness -= 40;
    if (pares < 7 || pares > 9) fitness -= 30;
    if (repetidas < 8 || repetidas > 10) fitness -= 30;
    candidates.push({ dezenas: finalGame, fitness });
  }

  return candidates
    .sort((a, b) => b.fitness - a.fitness)
    .slice(0, count)
    .map(c => c.dezenas);
}

/**
 * Mantendo a função original para compatibilidade com o Laboratório (Backtests).
 */
export const generateProbabilisticGames = (stats: any, quantity: number = 1): number[][] => {
  const { freq50, freq200, freqTotal, atraso, ultimoConcurso } = stats;
  const games: number[][] = [];

  for (let q = 0; q < quantity; q++) {
    const scores = Array.from({ length: 25 }, (_, i) => {
      const num = i + 1;
      const f50 = (freq50[num] || 0) / 100;
      const f200 = (freq200[num] || 0) / 100;
      const fTot = (freqTotal[num] || 0) / 100;
      const atr = Math.min((atraso[num] || 0) / 10, 1);
      return { num, score: (f50 * 0.35) + (f200 * 0.30) + (fTot * 0.20) + (atr * 0.15) + (Math.random() * 0.1) };
    });

    const game = scores
      .sort((a, b) => b.score - a.score)
      .slice(0, 15)
      .map(d => d.num)
      .sort((a, b) => a - b);
    games.push(game);
  }
  return games;
};