"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { getInternalApiKey } from "./profile-actions";

const MODEL_NAME = "gemini-3-flash-preview";

export const processChatInteraction = async (
  messages: { role: string; content: string }[],
  stats: any,
  userGames: any[] = [],
  backtestResults: any[] = [],
  userId?: string
) => {
  let apiKey = process.env.GEMINI_API_KEY;

  if (userId) {
    const userKey = await getInternalApiKey(userId);
    if (userKey) apiKey = userKey;
  }

  if (!apiKey) return "IA Indisponível: Configure sua chave Gemini no Perfil.";

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  const systemPrompt = `
    Você é o LotoExpert, um consultor de apostas casual e muito gente boa.
    
    DIRETRIZES DE ESTILO (CRÍTICAS):
    1. JAMAIS use caracteres de formatação como asteriscos (*), hashtags (#), hífens (-) no início de frases para listas, ou sublinhados (_).
    2. Escreva em texto puro (plain text).
    3. Separe seus pensamentos em parágrafos claros com pulo de linha duplo.
    4. Use um tom de conversa humana, como se estivesse conversando no WhatsApp com um amigo.
    5. Não seja um robô técnico. Explique as estatísticas de forma simples e direta.
    6. Se quiser sugerir jogos, coloque [GENERATE:X] apenas no final da mensagem, escondido no final de um parágrafo.

    CONTEXTO ATUAL:
    - Último Concurso: ${stats.ultimoConcurso.concurso}.
    - Histórico do Usuário: ${userGames.length} jogos salvos.
    - O laboratório mostra que sua IA tem média de ${backtestResults[0]?.resultado_json?.media || '9.0'} acertos.
  `;

  try {
    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "Beleza! LotoExpert na área. Vou mandar a real pros usuários de um jeito bem tranquilo e sem aquela chatice de robô. Pode deixar!" }] },
      ],
    });

    const lastMessage = messages[messages.length - 1].content;
    const result = await chat.sendMessage(lastMessage);
    return result.response.text();
  } catch (error) {
    console.error("[Chat Error]", error);
    return "Opa, deu um probleminha aqui no meu motor. Dá uma conferida na sua chave API lá no perfil!";
  }
};

export const transcribeAudio = async (base64Audio: string, userId?: string) => {
  try {
    let apiKey = process.env.GEMINI_API_KEY;
    if (userId) {
      const userKey = await getInternalApiKey(userId);
      if (userKey) apiKey = userKey;
    }
    if (!apiKey) return "Chave API não encontrada.";

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    
    const result = await model.generateContent([
      "Transcreva este áudio para texto de forma natural. Retorne apenas o texto.",
      { inlineData: { mimeType: "audio/webm", data: base64Audio } }
    ]);
    return result.response.text();
  } catch (error) {
    return "Não consegui entender o áudio.";
  }
};