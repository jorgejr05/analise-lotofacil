import { supabase } from "@/integrations/supabase/client";

export interface Concurso {
  concurso: number;
  data: string;
  dezenas: number[];
  soma: number;
  pares: number;
  impares: number;
  repetidas_anterior?: number;
  premiacao_json?: any;
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Buscar jogos que ainda não foram conferidos ou que precisam de atualização
    const { data: jogos } = await supabase
      .from('jogos')
      .select('*')
      .eq('user_id', user.id);

    if (!jogos || jogos.length === 0) return;

    for (const jogo of jogos) {
      // O jogo é para o concurso seguinte ao de referência (ou o próprio, dependendo da lógica de geração)
      // Aqui assumimos que concurso_referencia é o último que a IA viu, então o jogo é para o concurso_referencia + 1
      const targetConcurso = jogo.concurso_referencia + 1;

      const { data: concurso } = await supabase
        .from('concursos')
        .select('*')
        .eq('concurso', targetConcurso)
        .maybeSingle();

      if (concurso) {
        const pontos = calculatePoints(jogo.dezenas, concurso.dezenas);
        
        // Atualizar pontos no jogo
        await supabase
          .from('jogos')
          .update({ pontos })
          .eq('id', jogo.id);

        // Calcular prêmio se houver
        if (pontos >= 11) {
          const premioInfo = concurso.premiacao_json?.find((p: any) => p.descricao.includes(`${pontos} acertos`));
          const valorPremiado = premioInfo?.valor || 0;

          if (valorPremiado > 0) {
            // Buscar registro na banca para este concurso
            const { data: historyEntry } = await supabase
              .from('bankroll_history')
              .select('*')
              .eq('user_id', user.id)
              .eq('concurso_id', targetConcurso)
              .maybeSingle();

            if (historyEntry) {
              const novoValorPremiado = Number(historyEntry.valor_premiado || 0) + valorPremiado;
              const novoLucro = novoValorPremiado - Number(historyEntry.valor_apostado);
              const roi = (novoLucro / Number(historyEntry.valor_apostado)) * 100;

              await supabase
                .from('bankroll_history')
                .update({ 
                  valor_premiado: novoValorPremiado,
                  lucro_prejuizo: novoLucro,
                  roi_percentual: roi
                })
                .eq('id', historyEntry.id);

              // Atualizar saldo atual na banca
              const { data: settings } = await supabase
                .from('user_bankroll_settings')
                .select('bankroll_atual')
                .eq('user_id', user.id)
                .single();

              if (settings) {
                await supabase
                  .from('user_bankroll_settings')
                  .update({ bankroll_atual: Number(settings.bankroll_atual) + valorPremiado })
                  .eq('user_id', user.id);
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Erro ao atualizar pontos e prêmios:', error);
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
    repetidas_anterior,
    premiacao_json: data.premiacoes
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
      .maybeSingle();

    const startFrom = lastSaved ? lastSaved.concurso + 1 : 1;
    const syncStart = Math.max(1, startFrom - 1);

    const limit = 10; 
    let count = 0;

    for (let i = syncStart; i <= latestNum && count < limit; i++) {
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

    // Após sincronizar novos concursos, conferir todos os jogos pendentes
    await updateAllGamesPoints();

    return { 
      message: count > 0 
        ? `Sincronizados ${count} concursos com dados de premiação!` 
        : 'Dados globais conferidos.' 
    };
  } catch (error) {
    console.error('Erro na sincronização global:', error);
    throw error;
  }
};