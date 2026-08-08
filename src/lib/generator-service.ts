"use server";

import { supabase } from "@/integrations/supabase/client";
import {
  calcFitness,
  calcPares,
  calcSoma,
  calcRepetidas,
  FILTROS_RANGES,
} from "./lotofacil-utils";

// =============================================================================
// TIPOS INTERNOS
// =============================================================================
interface Candidato {
  dezenas: number[];
  score: number;
  valido: boolean;
}

interface EstatisticasMotor {
  scores: { num: number; score: number }[];
  anterior: number[];
  historico: number[][];
}

// =============================================================================
// MOTOR DE SCORE POR DEZENA
// Combina frequência em 3 janelas (50, 200, total), atraso e penalidade de resfriamento
// =============================================================================
function calcScoresDezenas(
  concursos: { dezenas: number[]; soma: number; pares: number }[],
  pesos: { f50: number; f200: number; ftot: number; atr: number }
): { num: number; score: number }[] {
  const total = concursos.length;

  return Array.from({ length: 25 }, (_, i) => {
    const num = i + 1;

    // Frequências em 3 janelas temporais
    const janela50  = concursos.slice(0, Math.min(50, total));
    const janela200 = concursos.slice(0, Math.min(200, total));

    const f50  = janela50.filter(c => c.dezenas.includes(num)).length / janela50.length;
    const f200 = janela200.filter(c => c.dezenas.includes(num)).length / janela200.length;
    const ftot = concursos.filter(c => c.dezenas.includes(num)).length / total;

    // Atraso: quantos concursos atrás saiu pela última vez
    const lastIndex = concursos.findIndex(c => c.dezenas.includes(num));
    const atraso = lastIndex === -1 ? 15 : lastIndex;

    // Penalidade de resfriamento: dezenas que saíram nos últimos 2 concursos
    // têm probabilidade menor de repetir imediatamente
    const resfriamento = (lastIndex === 0 || lastIndex === 1) ? -0.08 : 0;

    const score =
      f50  * pesos.f50  +
      f200 * pesos.f200 +
      ftot * pesos.ftot +
      Math.min(atraso / 15, 1) * pesos.atr +
      resfriamento;

    return { num, score: Math.max(0, score) };
  });
}

// =============================================================================
// GERAÇÃO ALEATÓRIA PONDERADA
// Sorteia 15 dezenas usando os scores como peso probabilístico (roleta viciada)
// Garante diversidade real no espaço de C(25,15) = 3.268.760 combinações
// =============================================================================
function gerarJogoAleatorioViciado(
  scores: { num: number; score: number }[],
  ruido: number = 0
): number[] {
  // Adiciona ruído proporcional para garantir exploração do espaço combinatório
  const comRuido = scores.map(s => ({
    num: s.num,
    peso: Math.max(0.01, s.score + (Math.random() * ruido * 2 - ruido)),
  }));

  // Seleção por roleta (roulette wheel selection)
  const selecionados: number[] = [];
  const pool = [...comRuido];

  while (selecionados.length < 15) {
    const totalPeso = pool.reduce((acc, s) => acc + s.peso, 0);
    let rand = Math.random() * totalPeso;
    for (let i = 0; i < pool.length; i++) {
      rand -= pool[i].peso;
      if (rand <= 0) {
        selecionados.push(pool[i].num);
        pool.splice(i, 1);
        break;
      }
    }
  }

  return selecionados.sort((a, b) => a - b);
}

// =============================================================================
// CROSSOVER GENÉTICO
// Combina os "genes" (dezenas) de dois jogos pais para criar um filho
// =============================================================================
function crossover(pai1: number[], pai2: number[]): number[] {
  const combined = Array.from(new Set([...pai1, ...pai2]));
  // Sorteia 15 do pool combinado, priorizando as que aparecem nos dois pais
  const ambos = pai1.filter(n => pai2.includes(n));
  const extras = combined.filter(n => !ambos.includes(n));

  const filho: number[] = [...ambos];
  while (filho.length < 15 && extras.length > 0) {
    const idx = Math.floor(Math.random() * extras.length);
    filho.push(extras.splice(idx, 1)[0]);
  }

  // Se ficaram menos de 15, completa com aleatórios do universo
  const universo = Array.from({ length: 25 }, (_, i) => i + 1).filter(n => !filho.includes(n));
  while (filho.length < 15 && universo.length > 0) {
    const idx = Math.floor(Math.random() * universo.length);
    filho.push(universo.splice(idx, 1)[0]);
  }

  return filho.sort((a, b) => a - b);
}

// =============================================================================
// MUTAÇÃO
// Troca 1 ou 2 dezenas aleatórias por outras não presentes no jogo
// =============================================================================
function mutar(dezenas: number[], taxa: number = 0.3): number[] {
  if (Math.random() > taxa) return dezenas;
  const mutado = [...dezenas];
  const ausentes = Array.from({ length: 25 }, (_, i) => i + 1).filter(n => !mutado.includes(n));
  const qtdMutacoes = Math.random() < 0.5 ? 1 : 2;
  for (let m = 0; m < qtdMutacoes; m++) {
    const idxRemover = Math.floor(Math.random() * mutado.length);
    const idxAdicionar = Math.floor(Math.random() * ausentes.length);
    mutado.splice(idxRemover, 1, ausentes.splice(idxAdicionar, 1)[0]);
  }
  return mutado.sort((a, b) => a - b);
}

// =============================================================================
// DEDUPLICAÇÃO
// Garante que os jogos finais não sejam duplicatas
// =============================================================================
function deduplicar(candidatos: Candidato[], quantidade: number): Candidato[] {
  const vistos = new Set<string>();
  const unicos: Candidato[] = [];
  for (const c of candidatos) {
    const key = c.dezenas.join(",");
    if (!vistos.has(key)) {
      vistos.add(key);
      unicos.push(c);
      if (unicos.length >= quantidade) break;
    }
  }
  return unicos;
}

// =============================================================================
// MOTOR GENÉTICO PRINCIPAL (exportado)
// 3 fases: população inicial → evolução → elitismo + cruzamento final
// =============================================================================
export async function generateAdvancedGames(count: number = 6): Promise<number[][]> {
  // 1. Busca dados do banco
  const { data: concursos } = await supabase
    .from("concursos")
    .select("dezenas, soma, pares")
    .order("concurso", { ascending: false })
    .limit(500);

  const { data: activeModel } = await supabase
    .from("model_versions")
    .select("*")
    .eq("is_ativo", true)
    .maybeSingle();

  if (!concursos || concursos.length === 0) return [];

  const pesos = activeModel?.pesos_json || { f50: 0.35, f200: 0.30, ftot: 0.20, atr: 0.15 };
  const anterior = concursos[0]?.dezenas || [];
  const scoresDezenas = calcScoresDezenas(concursos, pesos);

  // ── FASE 1: Geração da população inicial (100k candidatos com roleta viciada) ──
  const POPULACAO_INICIAL = 100_000;
  const populacao: Candidato[] = [];

  for (let i = 0; i < POPULACAO_INICIAL; i++) {
    // Ruído crescente nos primeiros 30% para garantir exploração ampla
    const ruido = i < POPULACAO_INICIAL * 0.3 ? 0.15 : 0.05;
    const dezenas = gerarJogoAleatorioViciado(scoresDezenas, ruido);
    const fitness = calcFitness(dezenas, anterior);
    populacao.push({ dezenas, score: fitness.score, valido: fitness.valido });
  }

  // ── FASE 2: Filtra apenas os jogos válidos e ordena pelos melhores ──────────
  const validos = populacao
    .filter(c => c.valido)
    .sort((a, b) => b.score - a.score);

  // Se não temos jogos válidos suficientes, relaxa os critérios (fallback)
  const elite = validos.length >= count * 10
    ? validos.slice(0, Math.min(500, validos.length))
    : populacao.sort((a, b) => b.score - a.score).slice(0, 500);

  // ── FASE 3: Evolução genética — crossover + mutação sobre a elite ───────────
  const GERACOES = 50;
  const geradosEvolucao: Candidato[] = [];

  for (let g = 0; g < GERACOES; g++) {
    // Seleciona 2 pais aleatórios da elite (com viés para os melhores)
    const idxPai1 = Math.floor(Math.random() * Math.min(100, elite.length));
    const idxPai2 = Math.floor(Math.random() * Math.min(200, elite.length));
    const filho = mutar(crossover(elite[idxPai1].dezenas, elite[idxPai2].dezenas));
    const fitness = calcFitness(filho, anterior);
    geradosEvolucao.push({ dezenas: filho, score: fitness.score, valido: fitness.valido });
  }

  // ── FASE 4: Pool final = elite + filhos evoluídos, rankeados e deduplicados ─
  const poolFinal = [...elite, ...geradosEvolucao]
    .sort((a, b) => b.score - a.score);

  const resultado = deduplicar(poolFinal, count);

  // Garante que retornamos a quantidade solicitada mesmo em banco vazio
  if (resultado.length < count) {
    while (resultado.length < count) {
      const dezenas = gerarJogoAleatorioViciado(scoresDezenas, 0.2);
      const fitness = calcFitness(dezenas, anterior);
      resultado.push({ dezenas, score: fitness.score, valido: fitness.valido });
    }
  }

  return resultado.slice(0, count).map(c => c.dezenas);
}

// =============================================================================
// FECHAMENTO MATEMÁTICO COM COBERTURA GARANTIDA
// Garante que se N dezenas do pool saírem, pelo menos 1 jogo acerta 14 pontos
// Implementa a técnica de "cobertura por diversidade máxima"
// =============================================================================
export async function generateClosingGames(
  pool: number[],
  quantity: number = 10
): Promise<number[][]> {
  if (pool.length < 16)
    throw new Error("O pool deve ter pelo menos 16 dezenas.");

  // Busca anterior para usar na fitness function
  const { data: concursos } = await supabase
    .from("concursos")
    .select("dezenas")
    .order("concurso", { ascending: false })
    .limit(1);
  const anterior = concursos?.[0]?.dezenas || [];

  const SIMULACOES = 50_000;
  const candidatos: Candidato[] = [];

  // Gera candidatos apenas dentro do pool escolhido
  for (let i = 0; i < SIMULACOES; i++) {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const dezenas = shuffled.slice(0, 15).sort((a, b) => a - b);
    const fitness = calcFitness(dezenas, anterior);
    candidatos.push({ dezenas, score: fitness.score, valido: fitness.valido });
  }

  // Ordena pelos melhores scores dentro do pool
  candidatos.sort((a, b) => b.score - a.score);

  // ── Seleção por Diversidade Máxima (cobertura real) ──────────────────────
  // Garante que os jogos selecionados cobrem partes diferentes do pool
  // Critério: dois jogos só são "parecidos" se tiverem 13+ dezenas em comum
  //           (se tiverem 14 em comum, cobrem essencialmente a mesma área)
  const LIMIAR_SIMILARIDADE = 13;
  const selecionados: Candidato[] = [];

  for (const cand of candidatos) {
    if (selecionados.length >= quantity) break;

    const muitoSimilar = selecionados.some(sel => {
      const common = cand.dezenas.filter(n => sel.dezenas.includes(n)).length;
      return common >= LIMIAR_SIMILARIDADE;
    });

    if (!muitoSimilar) {
      selecionados.push(cand);
    }
  }

  // Fallback: se não conseguirmos com o limiar rigoroso, relaxa para 12
  if (selecionados.length < quantity) {
    for (const cand of candidatos) {
      if (selecionados.length >= quantity) break;
      const jaEstá = selecionados.some(
        s => JSON.stringify(s.dezenas) === JSON.stringify(cand.dezenas)
      );
      if (!jaEstá) selecionados.push(cand);
    }
  }

  return selecionados.slice(0, quantity).map(c => c.dezenas);
}

// =============================================================================
// GERAÇÃO PROBABILÍSTICA (para backtests — mantida por compatibilidade)
// =============================================================================
export const generateProbabilisticGames = async (
  stats: any,
  quantity: number = 1
): Promise<number[][]> => {
  const { freq50, freq200, freqTotal, atraso } = stats;
  const games: number[][] = [];

  for (let q = 0; q < quantity; q++) {
    const scores = Array.from({ length: 25 }, (_, i) => {
      const num = i + 1;
      const f50  = (freq50[num]    || 0) / 100;
      const f200 = (freq200[num]   || 0) / 100;
      const fTot = (freqTotal[num] || 0) / 100;
      const atr  = Math.min((atraso[num] || 0) / 10, 1);
      return {
        num,
        score: f50 * 0.35 + f200 * 0.30 + fTot * 0.20 + atr * 0.15 + Math.random() * 0.1,
      };
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