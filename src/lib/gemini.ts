"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { getInternalApiKey } from "./profile-actions";

export const generateGameInsight = async (stats: any, games: number[][], mode: 'ia' | 'fechamento' = 'ia', userId?: string) => {
  let apiKey = process.env.GEMINI_API_KEY;

  if (userId) {
    const userKey = await getInternalApiKey(userId);
    if (userKey) apiKey = userKey;
  }
  
  if (!apiKey) {
    return "Aguardando ativação da IA: Configure sua chave API no Perfil.";
  }

  const quentes = Object.entries(stats.freqTotal || {})
    .sort(([,a]: any, [,b]: any) => b - a)
    .slice(0, 5)
    .map(([num]) => num)
    .join(", ");

  const prompt = `
    Você é o LotoExpert AI. Analise estes jogos da Lotofácil gerados no modo ${mode.toUpperCase()}:
    - Soma média histórica: ${Math.round(stats.somaMedia)}
    - Dezenas frequentes: ${quentes}
    - Jogos sugeridos: ${JSON.stringify(games)}
    
    ${mode === 'fechamento' 
      ? "Explique como este fechamento matemático protege o apostador e por que a escolha dessas dezenas é sólida." 
      : "Explique por que esses jogos baseados em probabilidade são equilibrados."}
    
    Seja breve (máximo 2 parágrafos). Use Português do Brasil.
  `;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    return "Análise estatística concluída. (IA em standby ou chave inválida)";
  }
};

export const suggestPoolViaIA = async (stats: any, userId?: string) => {
  let apiKey = process.env.GEMINI_API_KEY;

  if (userId) {
    const userKey = await getInternalApiKey(userId);
    if (userKey) apiKey = userKey;
  }

  if (!apiKey) return null;

  const prompt = `
    Com base nas estatísticas da Lotofácil:
    - Dezenas mais frequentes (Top 10): ${JSON.stringify(Object.entries(stats.freqTotal).sort(([,a]:any,[,b]:any)=>b-a).slice(0,10).map(([n])=>n))}
    - Dezenas com maior atraso: ${JSON.stringify(Object.entries(stats.atraso).sort(([,a]:any,[,b]:any)=>b-a).slice(0,5).map(([n])=>n))}
    
    Sugira um grupo de 20 dezenas para um FECHAMENTO de alta performance. 
    Misture dezenas quentes, dezenas que devem voltar (atrasadas) e dezenas neutras.
    Retorne APENAS um array JSON de números, exemplo: [1, 2, 3, ...]
  `;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const match = text.match(/\[.*\]/);
    return match ? JSON.parse(match[0]) : null;
  } catch (error) {
    return null;
  }
};