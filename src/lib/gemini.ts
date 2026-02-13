import { GoogleGenerativeAI } from "@google/generative-ai";

// A chave deve ser configurada nas variáveis de ambiente do projeto
const getApiKey = () => {
  return process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
};

export const generateGameInsight = async (stats: any, games: number[][]) => {
  const apiKey = getApiKey();
  
  if (!apiKey || apiKey === "sua_chave_aqui") {
    return "Insight em modo de segurança: Seus jogos foram gerados com base em padrões de soma (160-220) e equilíbrio de pares (7-9). Para análises personalizadas por IA, configure a variável NEXT_PUBLIC_GEMINI_API_KEY.";
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Preparar dados simplificados para o prompt
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
    const text = result.response.text();
    
    return text || "Análise concluída com sucesso baseada em filtros de alta probabilidade.";
  } catch (error: any) {
    console.error("Erro na API Gemini:", error);
    
    // Se for erro de quota ou chave inválida, retornar mensagem específica
    if (error.message?.includes("API key not valid")) {
      return "Erro: A chave de API do Gemini configurada é inválida. Verifique suas credenciais no Google AI Studio.";
    }
    
    return "O motor de IA encontrou um problema técnico. No entanto, seus jogos foram validados pelos filtros estatísticos de soma ideal (160-220) e repetitividade histórica.";
  }
};