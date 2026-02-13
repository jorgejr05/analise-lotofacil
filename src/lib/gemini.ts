import { GoogleGenerativeAI } from "@google/generative-ai";

const getApiKey = () => {
  return process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
};

export const generateGameInsight = async (stats: any, games: number[][]) => {
  const apiKey = getApiKey();
  
  // Log de depuração (visível no F12 do navegador)
  console.log("[LotoExpert-IA] Chave detectada (primeiros 4 dígitos):", apiKey.substring(0, 4) + "...");

  if (!apiKey || apiKey === "sua_chave_aqui") {
    return "Insight em modo de segurança: Seus jogos foram gerados com base em padrões de soma (160-220). Para ativar a IA, configure a Secret 'NEXT_PUBLIC_GEMINI_API_KEY'.";
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Usando uma versão estável do modelo
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const quentes = Object.entries(stats.freqTotal)
      .sort(([,a]: any, [,b]: any) => b - a)
      .slice(0, 5)
      .map(([num]) => num)
      .join(", ");

    const prompt = `
      Analise estes 3 jogos da Lotofácil:
      - Soma média: ${Math.round(stats.somaMedia)}
      - Quentes: ${quentes}
      - Jogos: ${JSON.stringify(games)}
      Explique a lógica técnica e o equilíbrio desses jogos em 2 parágrafos curtos. Português do Brasil.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();

  } catch (error: any) {
    // Captura o erro detalhado para diagnóstico
    const errorMessage = error.message || "Erro desconhecido";
    console.error("[LotoExpert-IA] Erro Crítico:", error);

    if (errorMessage.includes("API key not valid") || errorMessage.includes("403")) {
      return "Erro: A chave de API do Google é inválida ou não tem permissão para o Gemini. Verifique-a no Google AI Studio.";
    }
    
    if (errorMessage.includes("quota") || errorMessage.includes("429")) {
      return "Erro: Limite de uso da IA atingido. Tente novamente em alguns minutos.";
    }

    return `Falha na IA: ${errorMessage}. Seus jogos foram validados pelos filtros estatísticos de soma ideal.`;
  }
};