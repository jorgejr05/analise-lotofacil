import { Concurso } from "./lotofacil-service";

interface Stats {
  freqTotal: Record<number, number>;
  atraso: Record<number, number>;
  somaMedia: number;
  paresMedia: number;
  ultimoConcurso: Concurso;
}

export const generateProbabilisticGames = (stats: Stats, quantity: number = 1): number[][] => {
  const { freqTotal, atraso, ultimoConcurso } = stats;
  const scores: Record<number, number> = {};

  // 1. Calcular Scores Individuais (01-25)
  for (let i = 1; i <= 25; i++) {
    const freq = (freqTotal[i] || 0) / 100; // Normalizado 0-1
    const atr = Math.min((atraso[i] || 0) / 10, 1); // Normalizado 0-1 (cap em 10 concursos)
    
    // Fórmula: (freq * 0.4) + (atraso * 0.3) + (random * 0.3 para variabilidade)
    // Ajustado para garantir que números quentes e atrasados tenham peso
    scores[i] = (freq * 0.45) + (atr * 0.35) + (Math.random() * 0.2);
  }

  const games: number[][] = [];

  while (games.length < quantity) {
    // Ordenar dezenas por score e adicionar um pouco de ruído para não gerar sempre o mesmo
    const sortedDezenas = Object.entries(scores)
      .map(([num, score]) => ({ num: Number(num), score: score + (Math.random() * 0.1) }))
      .sort((a, b) => b.score - a.score);

    // Tentar montar um jogo que respeite os filtros básicos
    let dezenas: number[] = [];
    
    // Estratégia: Pegar top 10 e completar com 5 aleatórios do resto para manter equilíbrio
    const top12 = sortedDezenas.slice(0, 12).map(d => d.num);
    const rest = sortedDezenas.slice(12).map(d => d.num);
    
    dezenas = [...top12];
    while (dezenas.length < 15) {
      const randomIndex = Math.floor(Math.random() * rest.length);
      const num = rest[randomIndex];
      if (!dezenas.includes(num)) {
        dezenas.push(num);
      }
    }

    dezenas.sort((a, b) => a - b);

    // Validação de Filtros Profissionais
    const soma = dezenas.reduce((a, b) => a + b, 0);
    const pares = dezenas.filter(n => n % 2 === 0).length;
    const repetidas = dezenas.filter(n => ultimoConcurso.dezenas.includes(n)).length;

    // Filtros: Soma (160-220), Pares (7-9), Repetidas (8-10)
    const isSomaOk = soma >= 160 && soma <= 220;
    const isParesOk = pares >= 7 && pares <= 9;
    const isRepetidasOk = repetidas >= 8 && repetidas <= 10;

    // Se passar nos filtros ou se for a 50ª tentativa (para evitar loop infinito)
    if ((isSomaOk && isParesOk && isRepetidasOk) || games.length > 100) {
      games.push(dezenas);
    }
  }

  return games;
};