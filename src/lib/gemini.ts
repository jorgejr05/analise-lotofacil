"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

export const generateGameInsight = async (stats: any, games: number[][]) => {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error("[LotoExpert-IA] GEMINI_API_KEY não configurada.");
    return "Aguardando ativação da IA: Configure a Secret 'GEMINI_API_KEY' no servidor.";
  }

  /** 
   * Lista de modelos em ordem de prioridade. 
   * Incluindo 2.0 Flash como padrão de alta performance e 
   * deixando o gancho para versões futuras.
   */
  const modelsToTry = [
    "gemini-2.0-flash",           // O mais rápido e moderno atual
    "gemini-2.0-flash-thinking",  // Versão com raciocínio aprimorado
    "gemini-1.5-flash",           // Fallback estável
    "gemini-1.5-pro"              // Fallback de alta precisão
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
    Seja breve (máximo 2 parágrafos). Use Português do Brasil.
  `;

  const genAI = new GoogleGenerativeAI(apiKey);

  for (const modelName of modelsToTry) {
    try {
      console.log(`[LotoExpert-IA] Solicitando processamento: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      if (text) {
        console.log(`[LotoExpert-IA] Inteligência ativa via: ${modelName}`);
        return text;
      }
    } catch (error: any) {
      console.warn(`[LotoExpert-IA] Modelo ${modelName} indisponível:`, error.message);
      
      // Se for o último modelo da lista, reportamos o erro final
      if (modelName === modelsToTry[modelsToTry.length - 1]) {
        throw error;
      }
    }
  }

  return "Análise estatística concluída. (IA em modo de espera)";
};