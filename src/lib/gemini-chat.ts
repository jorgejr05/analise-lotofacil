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
    1. FOCO TOTAL: Você só fala sobre Lotofácil, estatísticas e estratégias.
    2. SEM LIMITES DE GERAÇÃO: Se o usuário pedir 20, 50 ou 100 jogos, você deve atender. Não há limite máximo.
    3. ESTRATÉGIAS MÚLTIPLAS: Se o usuário pedir, por exemplo, "10 jogos quentes e 10 jogos frios", você pode emitir múltiplos comandos ou um comando somado.
    4. COMANDO DE GERAÇÃO: Para disparar a geração na tela, use o código: [GENERATE:X] onde X é o número total de jogos solicitados.
    5. HUMANIZAÇÃO E ANÁLISE: Antes de gerar, explique sua linha de raciocínio estatístico. Seja um consultor de alto nível.
    6. DESVIO DE ASSUNTO: Recuse educadamente qualquer tema fora de loteria.
    
    Dados Reais:
    - Último Concurso: ${stats.ultimoConcurso.concurso}
    - Dezenas: ${stats.ultimoConcurso.dezenas.join(', ')}
    - Soma Média: ${Math.round(stats.somaMedia)}
    
    Histórico do Usuário:
    ${gamesSummary}
  `;

  const chat = model.startChat({
    history: [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "Entendido. Sou o LotoExpert AI. Não tenho limites de geração e estou pronto para criar estratégias complexas e múltiplos jogos conforme sua necessidade. Como vamos atacar o próximo concurso?" }] },
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