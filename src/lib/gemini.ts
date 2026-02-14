"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { getInternalApiKey } from "./profile-actions";

/**
 * Gets the Gemini model instance using the user's or system's API key.
 */
async function getModel(userId?: string) {
  let apiKey = process.env.GEMINI_API_KEY;
  if (userId) {
    const userKey = await getInternalApiKey(userId);
    if (userKey) apiKey = userKey;
  }
  if (!apiKey) throw new Error("API Key not configured");
  
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
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
      
      Forneça um insight curto (máximo 3 frases) sobre a qualidade destes jogos e a probabilidade de convergência baseada em tendências.
    `;
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("[Gemini Insight Error]", error);
    return "Análise temporariamente indisponível.";
  }
};

export const suggestPoolViaIA = async (stats: any, userId?: string) => {
  try {
    const model = await getModel(userId);
    const prompt = `
      Baseado nas estatísticas da Lotofácil:
      Frequência Total: ${JSON.stringify(stats.freqTotal)}
      Atrasos: ${JSON.stringify(stats.atraso)}
      
      Selecione as 20 melhores dezenas para um fechamento estratégico. 
      Retorne APENAS um array JSON de números, ex: [1, 2, 3...]
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

export const processChatInteraction = async (
  messages: { role: string; content: string }[],
  stats: any,
  userGames: any[] = [],
  backtestResults: any[] = [],
  userId?: string
) => {
  try {
    const model = await getModel(userId);
    
    const gamesSummary = userGames.length > 0 
      ? userGames.slice(0, 10).map(g => `- Jogo: [${g.dezenas.join(', ')}] | Pontos: ${g.pontos || 0}`).join('\n')
      : "Nenhum jogo salvo.";

    const labSummary = backtestResults.length > 0
      ? backtestResults.slice(0, 3).map(b => `- Motor: ${b.modelo_usado} | Média: ${b.resultado_json?.media?.toFixed(2) || 'N/A'}`).join('\n')
      : "Nenhum teste de laboratório realizado.";

    const systemPrompt = `Você é o LotoExpert AI. Analise: Laboratório: ${labSummary}. Jogos do Usuário: ${gamesSummary}. Último Concurso: ${stats.ultimoConcurso.concurso}. Se o usuário pedir para gerar jogos, responda com [GENERATE:X] no final.`;

    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "Pronto para traçar sua estratégia vencedora." }] },
      ],
    });

    const result = await chat.sendMessage(messages[messages.length - 1].content);
    return result.response.text();
  } catch (error: any) {
    return "Erro na comunicação com a IA. Verifique sua chave API.";
  }
};

export const transcribeAudio = async (base64Audio: string, userId?: string) => {
  try {
    const model = await getModel(userId);
    const result = await model.generateContent([
      "Transcreva este áudio para texto em Português do Brasil. Retorne apenas a transcrição.",
      { inlineData: { mimeType: "audio/webm", data: base64Audio } }
    ]);
    return result.response.text();
  } catch (error) {
    return "Não consegui entender o áudio.";
  }
};