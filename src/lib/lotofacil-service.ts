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

export const calculatePoints = (jogoDezenas: number[], sorteioDezenas: number[]) => {
  return jogoDezenas.filter(num => sorteioDezenas.includes(num)).length;
};

export const updateAllGamesPoints = async () => {
  try {
    const { data: jogos } = await supabase
      .from('jogos')
      .select('*');

    if (!jogos || jogos.length === 0) return;

    for (const jogo of jogos) {
      const targetConcurso = jogo.concurso_referencia + 1;

      const { data: concurso } = await supabase
        .from('concursos')
        .select('dezenas')
        .eq('concurso', targetConcurso)
        .single();

      if (concurso) {
        const pontos = calculatePoints(jogo.dezenas, concurso.dezenas);
        await supabase
          .from('jogos')
          .update({ pontos })
          .eq('id', jogo.id);
      }
    }
  } catch (error) {
    console.error('Erro ao atualizar pontos:', error);
  }
};

// Função auxiliar para converter DD/MM/YYYY para YYYY-MM-DD
const formatDateForDb = (dateStr: string) => {
  if (!dateStr || !dateStr.includes('/')) return dateStr;
  const [day, month, year] = dateStr.split('/');
  return `${year}-${month}-${day}`;
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
    data: formatDateForDb(data.data), // Conversão aqui
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
      .maybeSingle(); // Usar maybeSingle para evitar erro se a tabela estiver vazia

    const startFrom = lastSaved ? lastSaved.concurso + 1 : 1;

    if (startFrom > latestNum) {
      await updateAllGamesPoints();
      return { message: 'Já está atualizado. Pontos conferidos.' };
    }

    // Limite de 20 por vez para evitar timeouts
    const limit = 20; 
    let count = 0;

    for (let i = startFrom; i <= latestNum && count < limit; i++) {
      const data = await fetchConcursoByNumber(i);
      
      const { data: anterior } = await supabase
        .from('concursos')
        .select('*')
        .eq('concurso', i - 1)
        .maybeSingle();

      const processed = processConcursoData(data, anterior || undefined);
      
      // Especificar onConflict para garantir que o upsert funcione na coluna 'concurso'
      await supabase.from('concursos').upsert(processed, { onConflict: 'concurso' });
      count++;
    }

    await updateAllGamesPoints();

    return { message: `Sincronizados ${count} concursos e pontos atualizados!` };
  } catch (error) {
    console.error('Erro na sincronização:', error);
    throw error;
  }
};