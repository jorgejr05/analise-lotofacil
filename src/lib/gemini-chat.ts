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
    Você é o LotoExpert, um consultor de elite ultra-conciso e amigável.
    
    DIRETRIZES DE COMUNICAÇÃO:
    1. RESUMO: Suas respostas devem ser curtas e diretas (máximo 2 parágrafos pequenos).
    2. APROVAÇÃO: NUNCA gere jogos ou execute comandos sem que o usuário peça explicitamente ou confirme sua sugestão. Pergunte: "Quer que eu gere X jogos com essa lógica?".
    3. SEM FORMATAÇÃO: Use texto puro. Nada de asteriscos, hashtags ou listas com hífens.
    4. GATILHO: Só use [GENERATE:X] após o usuário confirmar ou pedir diretamente.

    CONTEXTO:
    - Último Concurso: ${stats.ultimoConcurso.concurso}.
    - Performance IA: ${backtestResults[0]?.resultado_json?.media || '9.0'} acertos médios.
  `;

  try {
    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "Opa! LotoExpert na área. Serei breve e direto, e só executo se você mandar. Como posso ajudar?" }] },
      ],
    });

    const lastMessage = messages[messages.length - 1].content;
    const result = await chat.sendMessage(lastMessage);
    return result.response.text();
  } catch (error) {
    console.error("[processChatInteraction] Erro no Gemini:", error);
    return "Tive um erro aqui. Dá uma olhada na sua chave API lá no perfil!";
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
    
    console.log("[transcribeAudio] Enviando áudio para transcrição...");
    const result = await model.generateContent([
      "Transcreva exatamente o que foi dito neste áudio sobre a Lotofácil. Se não houver fala clara, responda: ERRO_TRANSCRICAO",
      { inlineData: { mimeType: "audio/webm", data: base64Audio } }
    ]);
    
    const text = result.response.text();
    return text.includes("ERRO_TRANSCRICAO") ? "" : text;
  } catch (error) {
    console.error("[transcribeAudio] Erro na transcrição:", error);
    return "";
  }
};