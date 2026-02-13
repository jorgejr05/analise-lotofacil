import { GoogleGenerativeAI } from "@google/generative-ai";

// Nota: O usuário precisará configurar a variável de ambiente NEXT_PUBLIC_GEMINI_API_KEY no futuro
// Por enquanto, usaremos uma estrutura que permite passar a chave ou usar uma padrão se disponível
const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");

export const generateGameInsight = async (stats: any, games: number[][]) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      Você é um especialista em análise estatística da Lotofácil.
      Dados atuais (últimos 100 concursos):
      - Soma média: ${stats.somaMedia}
      - Média de pares: ${stats.paresMedia}
      - Números mais quentes: ${JSON.stringify(Object.entries(stats.freqTotal).sort(([,a]: any, [,b]: any) => b - a).slice(0, 5))}
      - Números mais atrasados: ${JSON.stringify(Object.entries(stats.atraso).sort(([,a]: any, [,b]: any) => b - a).slice(0, 5))}

      Jogos gerados: ${JSON.stringify(games)}

      Com base nesses dados, forneça um insight curto (máximo 3 parágrafos) explicando a estratégia por trás desses jogos, por que esses números foram escolhidos e qual a tendência para o próximo concurso. Seja profissional e motivador.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Erro Gemini:", error);
    return "Não foi possível gerar o insight do especialista no momento, mas seus jogos foram baseados em cálculos estatísticos precisos de frequência e atraso.";
  }
};