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
  valor_estimado?: number;
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

    const { data: jogos } = await supabase
      .from('jogos')
      .select('*')
      .eq('user_id', user.id);

    if (!jogos || jogos.length === 0) return;

    for (const jogo of jogos) {
      const targetConcurso = jogo.concurso_referencia + 1;

      const { data: concurso } = await supabase
        .from('concursos')
        .select('*')
        .eq('concurso', targetConcurso)
        .maybeSingle();

      if (concurso && concurso.dezenas) {
        const pontos = calculatePoints(jogo.dezenas, concurso.dezenas);
        
        await supabase
          .from('jogos')
          .update({ pontos })
          .eq('id', jogo.id);

        if (pontos >= 11) {
          const premioInfo = concurso.premiacao_json?.find((p: any) => 
            (p.descricao?.toLowerCase().includes(`${pontos} acertos`)) || 
            (p.faixa === (16 - pontos))
          );
          const valorPremiado = premioInfo?.valor || 0;

          if (valorPremiado > 0) {
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
  const dezenas = data.dezenas?.map(Number).sort((a: number, b: number) => a - b) || [];
  const soma = dezenas.reduce((acc: number, curr: number) => acc + curr, 0);
  const pares = dezenas.filter((n: number) => n % 2 === 0).length;
  const impares = 15 - pares;
  
  let repetidas_anterior = 0;
  if (anterior && dezenas.length > 0) {
    repetidas_anterior = dezenas.filter((n: number) => anterior.dezenas.includes(n)).length;
  }

  // A API pode retornar 'premiacoes' ou 'listaRateio'
  let rawPremiacoes = data.premiacoes || data.listaRateio || [];
  
  const premiacao_json = rawPremiacoes.map((p: any) => {
    // Tenta capturar o valor de várias propriedades possíveis
    const valor = p.valorPremio || p.valor || p.valor_estimado || 0;
    const ganhadores = p.ganhadores || p.numero_ganhadores || p.quantidade_ganhadores || 0;
    
    return {
      faixa: p.faixa,
      descricao: p.descricao,
      valor: Number(valor),
      ganhadores: Number(ganhadores)
    };
  });

  return {
    concurso: Number(data.concurso),
    data: formatDateForDb(data.data),
    dezenas,
    soma,
    pares,
    impares,
    repetidas_anterior,
    premiacao_json,
    valor_estimado: Number(data.valorEstimadoProximoConcurso || 0)
  };
};

export const syncLatestResults = async () => {
  try {
    const latestApi = await fetchLatestConcurso();
    const latestNum = Number(latestApi.concurso);

    // Buscamos o último salvo para saber de onde começar
    const { data: lastSaved } = await supabase
      .from('concursos')
      .select('concurso')
      .order('concurso', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Começamos do último salvo ou de 10 concursos atrás para garantir preenchimento de rateio
    const startFrom = lastSaved ? Math.max(1, lastSaved.concurso - 5) : Math.max(1, latestNum - 20);

    let count = 0;
    // Sincronizamos os últimos 10 concursos para garantir que prêmios que chegaram depois sejam salvos
    for (let i = startFrom; i <= latestNum; i++) {
      try {
        const data = await fetchConcursoByNumber(i);
        
        const { data: anterior } = await supabase
          .from('concursos')
          .select('*')
          .eq('concurso', i - 1)
          .maybeSingle();

        const processed = processConcursoData(data, anterior || undefined);
        
        // Só faz o upsert se tivermos dezenas (evita salvar lixo se a API falhar)
        if (processed.dezenas.length === 15) {
          await supabase.from('concursos').upsert(processed, { onConflict: 'concurso' });
          count++;
        }
      } catch (err) {
        console.warn(`Erro ao processar concurso ${i}:`, err);
      }
    }

    await updateAllGamesPoints();

    return { 
      message: count > 0 
        ? `Sincronizados ${count} concursos com sucesso!` 
        : 'Sincronização concluída (sem novos dados).' 
    };
  } catch (error) {
    console.error('Erro na sincronização global:', error);
    throw error;
  }
};