import { supabase } from "@/integrations/supabase/client";

export interface Concurso {
  concurso: number;
  data: string;
  dezenas: number[];
  soma: number;
  pares: number;
  impares: number;
  repetidas_anterior?: number;
}

export const fetchLatestConcurso = async () => {
  const response = await fetch('https://loteriascaixa-api.herokuapp.com/api/lotofacil/latest');
  if (!response.ok) throw new Error('Falha ao buscar último concurso');
  return response.json();
};

export const fetchConcursoByNumber = async (num: number) => {
  const response = await fetch(`https://loteriascaixa-api.herokuapp.com/api/lotofacil/${num}`);
  if (!response.ok) throw new Error(`Falha ao buscar concurso ${num}`);
  return response.json();
};

export const processConcursoData = (data: any, anterior?: Concurso): Concurso => {
  const dezenas = data.dezenas.map(Number).sort((a: number, b: number) => a - b);
  const soma = dezenas.reduce((acc: number, curr: number) => acc + curr, 0);
  const pares = dezenas.filter((n: number) => n % 2 === 0).length;
  const impares = 15 - pares;
  
  let repetidas_anterior = 0;
  if (anterior) {
    repetidas_anterior = dezenas.filter((n: number) => anterior.dezenas.includes(n)).length;
  }

  return {
    concurso: Number(data.concurso),
    data: data.data,
    dezenas,
    soma,
    pares,
    impares,
    repetidas_anterior
  };
};

export const syncLatestResults = async () => {
  try {
    const latestApi = await fetchLatestConcurso();
    const latestNum = Number(latestApi.concurso);

    const { data: lastSaved } = await supabase
      .from('concursos')
      .select('concurso')
      .order('concurso', { ascending: false })
      .limit(1)
      .single();

    const startFrom = lastSaved ? lastSaved.concurso + 1 : 1;

    if (startFrom > latestNum) return { message: 'Já está atualizado' };

    // Para carga inicial, vamos limitar para não estourar o tempo de execução
    // Em um cenário real, isso seria feito em lotes ou via Edge Function
    const limit = 50; 
    let count = 0;

    for (let i = startFrom; i <= latestNum && count < limit; i++) {
      const data = await fetchConcursoByNumber(i);
      
      // Buscar o anterior para calcular repetidas
      const { data: anterior } = await supabase
        .from('concursos')
        .select('*')
        .eq('concurso', i - 1)
        .single();

      const processed = processConcursoData(data, anterior || undefined);
      
      await supabase.from('concursos').upsert(processed);
      count++;
    }

    return { message: `Sincronizados ${count} concursos` };
  } catch (error) {
    console.error('Erro na sincronização:', error);
    throw error;
  }
};