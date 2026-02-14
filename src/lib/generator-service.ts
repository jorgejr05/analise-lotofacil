import { Concurso } from "./lotofacil-service";

interface Stats {
  freq50: Record<number, number>;
  freq200: Record<number, number>;
  freqTotal: Record<number, number>;
  atraso: Record<number, number>;
  somaMedia: number;
  paresMedia: number;
  ultimoConcurso: Concurso;
}

/**
 * Calcula a pontuação de saúde (Fitness) de um jogo
 * Baseado em: Soma, Paridade, Repetidas e Números na Moldura
 */
const calculateFitness = (game: number[], stats: Stats): number => {
  let score = 0;
  const { ultimoConcurso } = stats;
  
  const soma = game.reduce((a, b) => a + b, 0);
  const pares = game.filter(n => n % 2 === 0).length;
  const repetidas = game.filter(n => ultimoConcurso.dezenas.includes(n)).length;
  const moldura = game.filter(n => [1,2,3,4,5,6,10,11,15,16,20,21,22,23,24,25].includes(n)).length;

  // Filtros de Ouro (Pontuação Máxima se estiver no range ideal)
  if (soma >= 180 && soma <= 210) score += 25;
  if (pares >= 7 && pares <= 9) score += 25;
  if (repetidas >= 8 && repetidas <= 10) score += 25;
  if (moldura >= 9 && moldura <= 11) score += 25;

  return score;
};

export const generateProbabilisticGames = (stats: Stats, quantity: number = 1): number[][] => {
  const { freq50, freq200, freqTotal, atraso } = stats;
  const scores: Record<number, number> = {};

  // Score Base Adaptativo
  for (let i = 1; i <= 25; i++) {
    const f50 = (freq50[i] || 0) / 100;
    const f200 = (freq200[i] || 0) / 100;
    const fTot = (freqTotal[i] || 0) / 100;
    const atr = Math.min((atraso[i] || 0) / 10, 1);
    scores[i] = (f50 * 0.35) + (f200 * 0.30) + (fTot * 0.20) + (atr * 0.15);
  }

  // --- MONTE CARLO SIMULATION ---
  // Geramos uma massa de 10.000 jogos candidatos
  const simulationPool: { game: number[], fitness: number }[] = [];
  const SIMULATION_SIZE = 10000;

  for (let i = 0; i < SIMULATION_SIZE; i++) {
    const candidate: number[] = [];
    const sortedByScore = Object.entries(scores)
      .map(([num, score]) => ({ 
        num: Number(num), 
        score: score + (Math.random() * 0.3) // Ruído aumentado para diversidade na massa
      }))
      .sort((a, b) => b.score - a.score);

    // Composição dinâmica
    const top = sortedByScore.slice(0, 12).map(d => d.num);
    const mid = sortedByScore.slice(12, 19).map(d => d.num);
    const low = sortedByScore.slice(19).map(d => d.num);

    while (candidate.length < 9) {
      const n = top[Math.floor(Math.random() * top.length)];
      if (!candidate.includes(n)) candidate.push(n);
    }
    while (candidate.length < 13) {
      const n = mid[Math.floor(Math.random() * mid.length)];
      if (!candidate.includes(n)) candidate.push(n);
    }
    while (candidate.length < 15) {
      const n = low[Math.floor(Math.random() * low.length)];
      if (!candidate.includes(n)) candidate.push(n);
    }

    const game = candidate.sort((a, b) => a - b);
    const fitness = calculateFitness(game, stats);
    
    // Só adicionamos ao pool se o fitness for relevante (> 50%)
    if (fitness >= 75) {
      simulationPool.push({ game, fitness });
    }
  }

  // Ordenamos o pool pelos melhores jogos (Fitness 100) e pegamos a quantidade pedida
  return simulationPool
    .sort((a, b) => b.fitness - a.fitness || Math.random() - 0.5)
    .slice(0, quantity)
    .map(item => item.game);
};