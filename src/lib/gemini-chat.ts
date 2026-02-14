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

  const now = new Date();
  
  // Formata um resumo dos jogos do usuário para o contexto
  const gamesSummary = userGames.length > 0 
    ? userGames.slice(0, 10).map(g => 
        `- Jogo (ID: ${g.id.slice(0,4)}): [${g.dezenas.join(', ')}] | Pontos: ${g.pontos || 0} | Ref: #${g.concurso_referencia}`
      ).join('\n')
    : "Nenhum jogo salvo no histórico ainda.";

  const contextPrompt = `
    Você é o LotoExpert AI, um estrategista de elite da Lotofácil.
    Data/Hora Atual: ${now.toLocaleString('pt-BR')}
    
    Contexto Global:
    - Último Concurso: ${stats.ultimoConcurso.concurso}
    - Dezenas Sorteadas: ${stats.ultimoConcurso.dezenas.join(', ')}
    - Soma Média: ${Math.round(stats.somaMedia)}
    
    Histórico de Jogos do Usuário (Últimos 10):
    ${gamesSummary}
    
    Instruções:
    1. Se o usuário perguntar sobre o desempenho dele, analise os pontos dos jogos salvos.
    2. Compare as dezenas dos jogos salvos com as tendências atuais (quentes/frias).
    3. Sugira ajustes com base no que funcionou ou não nos jogos anteriores dele.
    4. Mantenha o tom de consultor técnico e motivador.
  `;

  const chat = model.startChat({
    history: [
      { role: "user", parts: [{ text: contextPrompt }] },
      { role: "model", parts: [{ text: "Entendido. Tenho acesso total aos dados globais e ao histórico de desempenho do usuário. Estou pronto para fornecer uma análise personalizada." }] },
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