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

export const generateProbabilisticGames = (stats: Stats, quantity: number = 1): number[][] => {
  const { freq50, freq200, freqTotal, atraso, ultimoConcurso } = stats;
  const scores: Record<number, number> = {};

  // CÁLCULO DO SCORE ADAPTATIVO (Fórmula de Elite)
  for (let i = 1; i <= 25; i++) {
    const f50 = (freq50[i] || 0) / 100;   // Peso 35%
    const f200 = (freq200[i] || 0) / 100; // Peso 30%
    const fTot = (freqTotal[i] || 0) / 100; // Peso 20%
    const atr = Math.min((atraso[i] || 0) / 10, 1); // Peso 15% (cap em 10 concursos)
    
    // A soma dos pesos deve ser 1.0 (ou 100%)
    scores[i] = (f50 * 0.35) + (f200 * 0.30) + (fTot * 0.20) + (atr * 0.15);
  }

  const games: number[][] = [];
  let attempts = 0;

  while (games.length < quantity && attempts < 1000) {
    attempts++;
    
    // Adicionamos um fator de ruído (vizinhança) para não gerar sempre o mesmo jogo
    const sortedDezenas = Object.entries(scores)
      .map(([num, score]) => ({ 
        num: Number(num), 
        score: score + (Math.random() * 0.15) // Ruído para exploração de novas combinações
      }))
      .sort((a, b) => b.score - a.score);

    // Estratégia de Composição: 
    // Pegar 9 das top 12 (Base forte)
    // Pegar 4 das intermediárias (Equilíbrio)
    // Pegar 2 das frias/atrasadas (Surpresa)
    const top = sortedDezenas.slice(0, 12).map(d => d.num);
    const mid = sortedDezenas.slice(12, 18).map(d => d.num);
    const low = sortedDezenas.slice(18).map(d => d.num);
    
    let dezenas: number[] = [];
    
    // Sorteio interno para variação
    while (dezenas.length < 9) {
      const n = top[Math.floor(Math.random() * top.length)];
      if (!dezenas.includes(n)) dezenas.push(n);
    }
    while (dezenas.length < 13) {
      const n = mid[Math.floor(Math.random() * mid.length)];
      if (!dezenas.includes(n)) dezenas.push(n);
    }
    while (dezenas.length < 15) {
      const n = low[Math.floor(Math.random() * low.length)];
      if (!dezenas.includes(n)) dezenas.push(n);
    }

    dezenas.sort((a, b) => a - b);

    // Validação de Filtros Profissionais (Obrigatório)
    const soma = dezenas.reduce((a, b) => a + b, 0);
    const pares = dezenas.filter(n => n % 2 === 0).length;
    const repetidas = dezenas.filter(n => ultimoConcurso.dezenas.includes(n)).length;

    // Filtros de Ouro da Lotofácil
    const isSomaOk = soma >= 170 && soma <= 215;
    const isParesOk = pares >= 7 && pares <= 9;
    const isRepetidasOk = repetidas >= 8 && repetidas <= 10;

    if (isSomaOk && isParesOk && isRepetidasOk) {
      games.push(dezenas);
    }
  }

  return games;
};