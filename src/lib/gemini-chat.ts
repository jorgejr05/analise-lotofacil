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
    Você é o LotoExpert AI v3.0, operando no modelo ${MODEL_NAME}.
    Seu objetivo é ser o consultor definitivo em Lotofácil, baseando-se estritamente em dados.
    
    ESTRUTURA DE DADOS DISPONÍVEL:
    - Laboratório: ${JSON.stringify(backtestResults.slice(0, 3))}
    - Histórico do Usuário: ${userGames.length} jogos salvos.
    - Status do Último Concurso: ${stats.ultimoConcurso.concurso}.

    REGRAS DE OURO:
    1. Não utilize modelos de fallback. Use apenas ${MODEL_NAME}.
    2. Se o usuário quiser jogos, use [GENERATE:X] no final da resposta.
    3. Seja preciso, técnico e encorajador.
  `;

  try {
    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "LotoExpert AI 3.0 (Flash Preview) ativado. Processando dados de elite." }] },
      ],
    });

    const lastMessage = messages[messages.length - 1].content;
    const result = await chat.sendMessage(lastMessage);
    return result.response.text();
  } catch (error) {
    console.error("[Chat Error]", error);
    return "Falha na comunicação com o motor de IA. Verifique sua chave API.";
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
      "Transcreva este áudio para texto. Retorne apenas a transcrição.",
      { inlineData: { mimeType: "audio/webm", data: base64Audio } }
    ]);
    return result.response.text();
  } catch (error) {
    return "Não consegui processar o áudio.";
  }
};