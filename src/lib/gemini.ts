"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { getInternalApiKey } from "./profile-actions";

/**
 * Nome do modelo atualizado para a versão estável mais recente.
 */
const MODEL_NAME = "gemini-flash-latest";

async function getModel(userId?: string) {
  let apiKey = process.env.GEMINI_API_KEY;
  if (userId) {
    const userKey = await getInternalApiKey(userId);
    if (userKey) apiKey = userKey;
  }
  if (!apiKey) throw new Error("API Key não configurada. Verifique seu perfil.");
  
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: MODEL_NAME });
}

export const generateGameInsight = async (stats: any, games: number[][], mode: string, userId?: string) => {
  try {
    const model = await getModel(userId);
    const prompt = `
      Analise estes jogos de Lotofácil gerados pelo modo ${mode}:
      Jogos: ${JSON.stringify(games)}
      
      Estatísticas Atuais:
      Soma Média: ${stats.somaMedia}
      Pares Médios: ${stats.paresMedia}
      Último Concurso: ${JSON.stringify(stats.ultimoConcurso.dezenas)}
      
      Forneça um insight estratégico de elite (máximo 3 frases) focado em convergência estatística.
    `;
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("[Gemini Insight Error]", error);
    return "Análise indisponível no momento.";
  }
};

export const suggestPoolViaIA = async (stats: any, userId?: string) => {
  try {
    const model = await getModel(userId);
    const prompt = `
      Como estrategista sênior, analise as estatísticas da Lotofácil:
      Frequência Total: ${JSON.stringify(stats.freqTotal)}
      Atrasos: ${JSON.stringify(stats.atraso)}
      
      Selecione o "Pool de Elite": as 20 dezenas com maior probabilidade matemática de compor o próximo sorteio.
      Retorne APENAS o array JSON, ex: [1, 2, 3...]
    `;
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const match = text.match(/\[.*\]/);
    return match ? JSON.parse(match[0]) : null;
  } catch (error) {
    console.error("[Gemini Pool Error]", error);
    return null;
  }
};