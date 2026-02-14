"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { getInternalApiKey } from "./profile-actions";

const MODEL_NAME = "gemini-3-flash-preview";

/**
 * Função utilitária para capturar mensagens de erro amigáveis da API Gemini
 */
function handleGeminiError(error: any) {
  console.error("[Gemini Error Detail]", error);
  const status = error?.status;
  
  if (status === 429) {
    return "Ops! Você atingiu o limite de requisições da sua conta gratuita do Gemini. Tente novamente em alguns instantes ou use uma chave com maior quota.";
  }
  
  if (status === 400) {
    return "Erro nos dados enviados para a IA. Tente reformular sua frase.";
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

    const systemPrompt = `
      Você é o LotoExpert, um consultor de elite ultra-conciso e amigável.
      
      DIRETRIZES DE COMUNICAÇÃO:
      1. RESUMO: Suas respostas devem ser curtas e diretas (máximo 2 parágrafos pequenos).
      2. APROVAÇÃO: NUNCA gere jogos sem pedido explícito. Pergunte: "Quer que eu gere X jogos?".
      3. SEM FORMATAÇÃO: Use texto puro. Nada de asteriscos ou hashtags.
      4. GATILHO: Só use [GENERATE:X] após confirmação.

      CONTEXTO:
      - Último Concurso: ${stats?.ultimoConcurso?.concurso || 'Desconhecido'}.
      - Seus Jogos: ${userGames.length} registrados.
    `;

    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "Pronto! Como o LotoExpert pode te ajudar agora?" }] },
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
      "Transcreva o áudio sobre a Lotofácil. Se não houver fala clara, responda: ERRO_TRANSCRICAO",
      { inlineData: { mimeType: "audio/webm", data: base64Audio } }
    ]);
    
    const text = result.response.text();
    return text.includes("ERRO_TRANSCRICAO") ? "" : text;
  } catch (error: any) {
    // Para transcrição, retornamos uma string especial para o componente saber que foi erro de quota
    if (error?.status === 429) return "LIMITE_EXCEDIDO";
    return "";
  }
};