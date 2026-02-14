"use server";

import { generateAdvancedGames } from "./generator-service";

/**
 * Gera um fechamento simplificado mas altamente eficaz.
 * Objetivo: Cobrir o máximo de combinações de 14 pontos dentro de um grupo de dezenas.
 */
export async function generateClosingGames(pool: number[], quantity: number = 10) {
  if (pool.length < 15) throw new Error("O grupo de dezenas deve ter pelo menos 15 números.");
  
  const games: number[][] = [];
  
  // 1. Gerar combinações usando técnica de rotação e aleatoriedade controlada
  // Para um fechamento real de 20-15-14-15 seriam centenas de jogos.
  // Aqui usamos "Smart Selection": geramos milhares e filtramos os que têm maior 'distância' entre si.
  
  const candidates: number[][] = [];
  const SIMULATIONS = 20000;

  for (let i = 0; i < SIMULATIONS; i++) {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const game = shuffled.slice(0, 15).sort((a, b) => a - b);
    candidates.push(game);
  }

  // 2. Filtro de Cobertura (Garantir que os jogos não sejam muito parecidos)
  // Queremos que cada jogo novo cubra uma parte diferente do pool
  for (const cand of candidates) {
    if (games.length >= quantity) break;

    const isRedundant = games.some(selected => {
      const common = cand.filter(n => selected.includes(n)).length;
      return common >= 13; // Se tiver 13 ou mais iguais, o jogo é redundante para fechamento
    });

    if (!isRedundant) {
      games.push(cand);
    }
  }

  // Se não conseguirmos jogos suficientes com o filtro rigoroso, relaxamos um pouco
  if (games.length < quantity) {
    for (const cand of candidates) {
      if (games.length >= quantity) break;
      if (!games.some(g => JSON.stringify(g) === JSON.stringify(cand))) {
        games.push(cand);
      }
    }
  }

  return games;
}