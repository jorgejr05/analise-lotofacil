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
    // Atualiza apenas os jogos do usuário logado para performance, 
    // mas os resultados (concursos) são globais.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: jogos } = await supabase
      .from('jogos')
      .select('*')
      .eq('user_id', user.id);

    if (!jogos || jogos.length === 0) return;

    for (const jogo of jogos) {
      const targetConcurso = jogo.concurso_referencia + 1;

      const { data: concurso } = await supabase
        .from('concursos')
        .select('dezenas')
        .eq('concurso', targetConcurso)
        .maybeSingle();

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
    data: formatDateForDb(data.data),
    dezenas,
    soma,
    pares,
    impares,
    repetidas_anterior
  };
};

export const syncLatestResults = async () => {
  try {
    // 1. Busca o último resultado na API
    const latestApi = await fetchLatestConcurso();
    const latestNum = Number(latestApi.concurso);

    // 2. Verifica o último resultado salvo GLOBALMENTE no banco
    const { data: lastSaved } = await supabase
      .from('concursos')
      .select('concurso')
      .order('concurso', { ascending: false })
      .limit(1)
      .maybeSingle();

    const startFrom = lastSaved ? lastSaved.concurso + 1 : 1;

    // Se o banco já estiver em dia com a API, apenas atualiza os pontos dos jogos
    if (startFrom > latestNum) {
      await updateAllGamesPoints();
      return { message: 'Sistema global já está atualizado.' };
    }

    // 3. Sincroniza apenas o que falta (incremental)
    const limit = 15; // Pequenos lotes para não sobrecarregar
    let count = 0;

    for (let i = startFrom; i <= latestNum && count < limit; i++) {
      const data = await fetchConcursoByNumber(i);
      
      const { data: anterior } = await supabase
        .from('concursos')
        .select('*')
        .eq('concurso', i - 1)
        .maybeSingle();

      const processed = processConcursoData(data, anterior || undefined);
      await supabase.from('concursos').upsert(processed, { onConflict: 'concurso' });
      count++;
    }

    // 4. Atualiza pontos dos jogos do usuário atual
    await updateAllGamesPoints();

    return { 
      message: count > 0 
        ? `Sincronizados ${count} novos concursos para todos os usuários!` 
        : 'Dados globais conferidos.' 
    };
  } catch (error) {
    console.error('Erro na sincronização global:', error);
    throw error;
  }
};