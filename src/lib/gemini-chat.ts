"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

export const processChatInteraction = async (
  messages: { role: string; content: string }[],
  stats: any,
  userGames: any[] = []
) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "IA indisponível: Chave API não configurada.";

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const gamesSummary = userGames.length > 0 
    ? userGames.slice(0, 10).map(g => 
        `- Jogo: [${g.dezenas.join(', ')}] | Pontos: ${g.pontos || 0}`
      ).join('\n')
    : "Nenhum jogo salvo.";

  const systemPrompt = `
    Você é o LotoExpert AI, um consultor humano e estrategista de elite da Lotofácil.
    
    REGRAS CRÍTICAS:
    1. FOCO TOTAL: Você só fala sobre Lotofácil, estatísticas, estratégias de jogo e desempenho do usuário.
    2. DESVIO DE ASSUNTO: Se o usuário perguntar algo fora desse tema, responda: "Como seu Agente Estrategista, meu foco é total na sua performance na Lotofácil. Vamos voltar às estratégias de jogo?"
    3. HUMANIZAÇÃO: Seja claro, direto e motivador. Não use termos excessivamente robóticos.
    4. COMANDO DE GERAÇÃO: Se o usuário pedir para gerar jogos (ex: "gere 3 jogos", "faça 5 apostas"), você DEVE incluir no final da sua resposta o código: [GENERATE:X] onde X é o número de jogos (máximo 10).
    5. SEM ALUCINAÇÕES: Baseie-se nos dados reais fornecidos:
       - Último Concurso: ${stats.ultimoConcurso.concurso}
       - Dezenas: ${stats.ultimoConcurso.dezenas.join(', ')}
       - Soma Média: ${Math.round(stats.somaMedia)}
    
    Histórico do Usuário:
    ${gamesSummary}
  `;

  const chat = model.startChat({
    history: [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "Entendido. Sou o LotoExpert AI. Estou focado exclusivamente em otimizar suas estratégias de Lotofácil com base em dados reais e no seu histórico. Como posso ajudar com seus jogos hoje?" }] },
    ],
  });

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
      { inlineData: { mimeType: "audio/webm", data: base64Audio } }
    ]);
    return result.response.text();
  } catch (error) {
    return "Não consegui entender o áudio.";
  }
};