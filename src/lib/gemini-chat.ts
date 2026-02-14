"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

export const processChatInteraction = async (
  messages: { role: string; content: string }[],
  stats: any,
  userGames: any[] = [],
  backtestResults: any[] = []
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

  const labSummary = backtestResults.length > 0
    ? backtestResults.slice(0, 3).map(b => 
        `- Motor: ${b.modelo_usado} | Concursos: ${b.quantidade_concursos} | Status: ${b.status} | Eficácia (Média): ${b.resultado_json?.media?.toFixed(2) || 'N/A'}`
      ).join('\n')
    : "Nenhum teste de laboratório realizado ainda.";

  const systemPrompt = `
    Você é o LotoExpert AI, um consultor humano e estrategista de elite da Lotofácil.
    
    REGRAS CRÍTICAS:
    1. CONHECIMENTO CIENTÍFICO: Você tem acesso aos resultados do LABORATÓRIO (Backtests). Use isso para validar suas sugestões.
    2. FOCO TOTAL: Você só fala sobre Lotofácil, estatísticas e estratégias.
    3. COMANDO DE GERAÇÃO: Para disparar a geração na tela, use o código: [GENERATE:X] onde X é o número de jogos.
    4. HUMANIZAÇÃO: Seja um consultor de alto nível, use os dados para provar por que sua estratégia é boa.
    
    Dados de Desempenho Real (Laboratório):
    ${labSummary}

    Histórico de Jogos do Usuário:
    ${gamesSummary}

    Dados Estatísticos Atuais:
    - Último Concurso: ${stats.ultimoConcurso.concurso}
    - Soma Média: ${Math.round(stats.somaMedia)}
  `;

  const chat = model.startChat({
    history: [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "Entendido. Sou o LotoExpert AI. Analisei os resultados do nosso laboratório e os seus jogos anteriores. Estou pronto para criar uma estratégia baseada em evidências. Como posso ajudar?" }] },
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