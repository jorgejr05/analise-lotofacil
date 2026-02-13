"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

export const generateGameInsight = async (stats: any, games: number[][]) => {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error("[LotoExpert-IA] GEMINI_API_KEY não configurada.");
    return "Aguardando ativação da IA: Configure a Secret 'GEMINI_API_KEY' no servidor.";
  }

  // Lista de modelos priorizando a geração 2.0 Flash
  const modelsToTry = [
    "gemini-2.0-flash", 
    "gemini-2.0-flash-exp", 
    "gemini-1.5-flash"
  ];
  
  const quentes = Object.entries(stats.freqTotal || {})
    .sort(([,a]: any, [,b]: any) => b - a)
    .slice(0, 5)
    .map(([num]) => num)
    .join(", ");

  const prompt = `
    Analise estes 3 jogos da Lotofácil (base 100 concursos):
    - Soma média histórica: ${Math.round(stats.somaMedia)}
    - Dezenas frequentes: ${quentes}
    - Jogos sugeridos: ${JSON.stringify(games)}
    
    Explique por que esses jogos são equilibrados (fale sobre soma e dezenas repetidas). 
    Seja breve (2 parágrafos). Use Português do Brasil.
  `;

  const genAI = new GoogleGenerativeAI(apiKey);

  for (const modelName of modelsToTry) {
    try {
      console.log(`[LotoExpert-IA] Tentando o modelo solicitado: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      if (text) {
        console.log(`[LotoExpert-IA] Sucesso com o modelo: ${modelName}`);
        return text;
      }
    } catch (error: any) {
      console.warn(`[LotoExpert-IA] Falha no modelo ${modelName}:`, error.message);
      
      // Se for o último modelo da lista (1.5 flash) e ainda falhar, aí lançamos o erro
      if (modelName === modelsToTry[modelsToTry.length - 1]) {
        throw error;
      }
    }
  }

  return "Análise técnica concluída via filtros estatísticos.";
};