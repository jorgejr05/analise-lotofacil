import { GoogleGenerativeAI } from "@google/generative-ai";

const getApiKey = () => {
  // Tenta buscar com e sem o prefixo NEXT_PUBLIC_
  return process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
};

export const generateGameInsight = async (stats: any, games: number[][]) => {
  const apiKey = getApiKey();
  
  // Log para ajudar você a debugar no console do navegador (F12)
  console.log("[LotoExpert-IA] Status da Chave:", apiKey ? "Identificada" : "Não encontrada nas Secrets");

  if (!apiKey || apiKey === "sua_chave_aqui") {
    return "Insight em modo de segurança: Seus jogos foram gerados com base em padrões de soma (160-220) e equilíbrio de pares (7-9). Para ativar a inteligência artificial completa, configure a Secret 'NEXT_PUBLIC_GEMINI_API_KEY' nas configurações do projeto.";
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const quentes = Object.entries(stats.freqTotal)
      .sort(([,a]: any, [,b]: any) => b - a)
      .slice(0, 5)
      .map(([num]) => num)
      .join(", ");

    const atrasados = Object.entries(stats.atraso)
      .sort(([,a]: any, [,b]: any) => b - a)
      .slice(0, 5)
      .map(([num]) => num)
      .join(", ");

    const prompt = `
      Analise estes 3 jogos da Lotofácil baseando-se em 100 concursos:
      - Soma média histórica: ${Math.round(stats.somaMedia)}
      - Números quentes (mais frequentes): ${quentes}
      - Números mais atrasados: ${atrasados}

      Jogos sugeridos pelo sistema: ${JSON.stringify(games)}

      Explique em até 3 parágrafos curtos a lógica por trás desses jogos, focando no equilíbrio entre dezenas quentes e atrasadas e na distribuição de pares/ímpares. Seja técnico e motivador. Responda em Português do Brasil.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    return text || "Análise concluída. Seus jogos respeitam os filtros de alta probabilidade.";
  } catch (error: any) {
    console.error("[LotoExpert-IA] Erro na API Gemini:", error);
    
    if (error.message?.includes("API key not valid")) {
      return "Erro: A chave de API configurada é inválida. Verifique sua chave no Google AI Studio.";
    }
    
    return "O motor de IA encontrou um problema de conexão. No entanto, seus jogos foram validados pelos filtros estatísticos de soma ideal.";
  }
};