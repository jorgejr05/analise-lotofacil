"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

export const processChatInteraction = async (
  messages: { role: string; content: string }[],
  stats: any
) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "IA indisponível: Chave API não configurada.";

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const now = new Date();
  const contextPrompt = `
    Você é o LotoExpert AI, um especialista em análise estatística da Lotofácil.
    Data/Hora Atual: ${now.toLocaleString('pt-BR')}
    
    Contexto da Lotofácil:
    - Último Concurso: ${stats.ultimoConcurso.concurso}
    - Dezenas Sorteadas: ${stats.ultimoConcurso.dezenas.join(', ')}
    - Soma Média: ${Math.round(stats.somaMedia)}
    - Pares Médios: ${Math.round(stats.paresMedia)}
    
    Instruções:
    1. Analise as probabilidades com base nos dados fornecidos.
    2. Seja direto, profissional e use um tom de "estrategista".
    3. Se o usuário enviou várias mensagens, responda a todas de forma organizada.
    4. Ajude o usuário a decidir quais dezenas fixar ou remover.
  `;

  const chat = model.startChat({
    history: [
      { role: "user", parts: [{ text: contextPrompt }] },
      { role: "model", parts: [{ text: "Entendido. Estou pronto para analisar os dados e ajudar o usuário com as melhores estratégias para a Lotofácil." }] },
    ],
  });

  // Formata as mensagens para o formato do Gemini
  const lastMessage = messages[messages.length - 1].content;
  const result = await chat.sendMessage(lastMessage);
  const response = await result.response;
  return response.text();
};

export const transcribeAudio = async (base64Audio: string) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "Erro na transcrição.";

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  try {
    const result = await model.generateContent([
      "Transcreva este áudio para texto em Português do Brasil. Retorne apenas a transcrição.",
      {
        inlineData: {
          mimeType: "audio/webm",
          data: base64Audio
        }
      }
    ]);
    return result.response.text();
  } catch (error) {
    console.error("Erro Gemini Audio:", error);
    return "Não consegui entender o áudio.";
  }
};