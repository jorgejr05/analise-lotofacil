"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

export const generateGameInsight = async (stats: any, games: number[][]) => {
  // Agora rodando no servidor, buscamos a chave privada
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error("[LotoExpert-IA] GEMINI_API_KEY não encontrada nas variáveis de ambiente do servidor.");
    return "Configuração pendente: A chave GEMINI_API_KEY não foi encontrada no servidor. Verifique as Secrets do projeto.";
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const quentes = Object.entries(stats.freqTotal || {})
      .sort(([,a]: any, [,b]: any) => b - a)
      .slice(0, 5)
      .map(([num]) => num)
      .join(", ");

    const prompt = `
      Analise estes 3 jogos da Lotofácil (estatísticas baseadas em 100 concursos):
      - Soma média: ${Math.round(stats.somaMedia)}
      - Números mais frequentes: ${quentes}
      - Jogos sugeridos: ${JSON.stringify(games)}
      
      Explique a lógica técnica desses jogos em 2 parágrafos curtos. Foque na probabilidade e equilíbrio. 
      Use Português do Brasil. Seja direto e profissional.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    return text || "Análise concluída com sucesso.";

  } catch (error: any) {
    console.error("[LotoExpert-IA] Erro no Servidor:", error.message);
    
    if (error.message?.includes("location not supported")) {
      return "A API do Gemini ainda não está disponível na sua região de hospedagem. Os jogos seguem validados por filtros estatísticos.";
    }

    return "O servidor de IA está processando muitas requisições. Tente gerar novamente em alguns instantes.";
  }
};