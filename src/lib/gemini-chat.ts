"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { getInternalApiKey } from "./profile-actions";

const MODEL_NAME = "gemini-flash-latest";

function handleGeminiError(error: any) {
  console.error("[Gemini Error Detail]", error);
  const status = error?.status;
  
  if (status === 429) {
    return "Ops! Você atingiu o limite de requisições da sua conta gratuita do Gemini. Tente novamente em alguns instantes ou use uma chave com maior quota.";
  }
  
  return "Tive um erro ao processar sua solicitação. Verifique sua chave API no perfil!";
}

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

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const lastNum = stats?.ultimoConcurso?.concurso || 0;
    const nextNum = lastNum + 1;

    const systemPrompt = `
      Você é o LotoExpert, um consultor de elite ultra-conciso e amigável.
      
      DIRETRIZES DE COMUNICAÇÃO:
      1. FOCO PREDITIVO: Você SEMPRE gera jogos focando no PRÓXIMO concurso (Concurso #${nextNum}).
      2. HISTÓRICO: O último concurso registrado foi o #${lastNum}. Use-o apenas para análise de tendências.
      3. RESUMO: Suas respostas devem ser curtas e diretas (máximo 2 parágrafos).
      4. APROVAÇÃO: NUNCA gere jogos sem pedido explícito. Pergunte: "Quer que eu gere X jogos para o concurso #${nextNum}?".
      5. GATILHO: Use [GENERATE:X] após confirmação.

      CONTEXTO ATUAL:
      - Último Concurso: #${lastNum}.
      - Alvo da Predição: #${nextNum}.
    `;

    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: `Pronto! O alvo agora é o concurso #${nextNum}. Como posso te ajudar?` }] },
      ],
    });

    const lastMessage = messages[messages.length - 1].content;
    const result = await chat.sendMessage(lastMessage);
    return result.response.text();
  } catch (error: any) {
    return handleGeminiError(error);
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
      "O que foi dito neste áudio? Transcreva apenas o texto.",
      { inlineData: { mimeType: "audio/webm", data: base64Audio } }
    ]);
    
    const text = result.response.text().trim();
    if (text.length < 2 || text.toLowerCase().includes("transcrição não disponível")) {
      return "";
    }
    
    return text;
  } catch (error: any) {
    if (error?.status === 429) return "LIMITE_EXCEDIDO";
    console.error("[transcribeAudio Error]", error);
    return "";
  }
};