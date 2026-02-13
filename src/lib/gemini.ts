import { GoogleGenerativeAI } from "@google/generative-ai";

// Para configurar a chave, adicione NEXT_PUBLIC_GEMINI_API_KEY nas configurações do projeto
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

export const generateGameInsight = async (stats: any, games: number[][]) => {
  if (!API_KEY || API_KEY === "") {
    return "Insight indisponível: Configure sua chave API do Gemini para receber análises inteligentes. Seus jogos foram gerados com base em filtros estatísticos de 100 concursos.";
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      Você é um especialista em análise estatística da Lotofácil.
      Dados atuais (últimos 100 concursos):
      - Soma média: ${Math.round(stats.somaMedia)}
      - Média de pares: ${Math.round(stats.paresMedia)}
      - Números mais quentes: ${JSON.stringify(Object.entries(stats.freqTotal).sort(([,a]: any, [,b]: any) => b - a).slice(0, 5))}
      - Números mais atrasados: ${JSON.stringify(Object.entries(stats.atraso).sort(([,a]: any, [,b]: any) => b - a).slice(0, 5))}

      Jogos gerados: ${JSON.stringify(games)}

      Com base nesses dados, forneça um insight curto (máximo 3 parágrafos) explicando a estratégia por trás desses jogos. 
      Mencione por que o equilíbrio entre números quentes e atrasados é importante. 
      Seja profissional, técnico e motivador. Responda em Português do Brasil.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Erro Gemini:", error);
    return "O motor de IA encontrou um problema, mas seus jogos seguem os padrões de soma (160-220) e equilíbrio de pares (7-9) detectados no banco de dados.";
  }
};