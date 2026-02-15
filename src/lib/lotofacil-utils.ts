export const calculatePoints = (jogoDezenas: number[], sorteioDezenas: number[]) => {
  if (!jogoDezenas || !sorteioDezenas) return 0;
  const j = Array.isArray(jogoDezenas) ? jogoDezenas.map(Number) : [];
  const s = Array.isArray(sorteioDezenas) ? sorteioDezenas.map(Number) : [];
  return j.filter(num => s.includes(num)).length;
};

/**
 * Processa os dados brutos da API Guidi para o formato do nosso banco de dados.
 */
export const processConcursoData = (data: any, anterior?: any) => {
  // A API Guidi usa 'listaDezenas' e 'numero'
  const rawDezenas = data.listaDezenas || data.dezenas || [];
  const dezenas = rawDezenas.map((n: any) => Number(n)).sort((a: number, b: number) => a - b);
  
  const concursoNum = Number(data.numero || data.concurso);
  const dataSorteio = data.data;

  const soma = dezenas.reduce((acc: number, curr: number) => acc + curr, 0);
  const pares = dezenas.filter((n: number) => n % 2 === 0).length;
  const impares = 15 - pares;
  
  let repetidas_anterior = 0;
  if (anterior && dezenas.length === 15) {
    const dezenasAnterior = Array.isArray(anterior.dezenas) ? anterior.dezenas.map(Number) : [];
    repetidas_anterior = dezenas.filter((n: number) => dezenasAnterior.includes(n)).length;
  }

  // Processamento do Rateio (API Guidi usa 'listaRateio')
  let rawRateio = data.listaRateio || [];
  const prizesMap: Record<number, { valor: number, ganhadores: number }> = {};
  
  if (Array.isArray(rawRateio)) {
    rawRateio.forEach((p: any) => {
      // A API Guidi retorna faixas de 1 a 5 (15 a 11 acertos)
      const hits = p.numeroDeAcertos || (16 - (p.faixa || 0));
      const numHits = Number(hits);
      
      if (numHits >= 11 && numHits <= 15) {
        prizesMap[numHits] = {
          valor: Number(p.valor || p.valorPremio || 0),
          ganhadores: Number(p.numeroDeGanhadores || p.ganhadores || 0)
        };
      }
    });
  }

  // Fallbacks de valores fixos da Lotofácil
  if (!prizesMap[11] || prizesMap[11].valor <= 0) prizesMap[11] = { valor: 7, ganhadores: prizesMap[11]?.ganhadores || 0 };
  if (!prizesMap[12] || prizesMap[12].valor <= 0) prizesMap[12] = { valor: 14, ganhadores: prizesMap[12]?.ganhadores || 0 };
  if (!prizesMap[13] || prizesMap[13].valor <= 0) prizesMap[13] = { valor: 35, ganhadores: prizesMap[13]?.ganhadores || 0 };

  const premiacao_json = [15, 14, 13, 12, 11].map(hits => ({
    faixa: 16 - hits,
    descricao: `${hits} acertos`,
    valor: prizesMap[hits]?.valor || 0,
    ganhadores: prizesMap[hits]?.ganhadores || 0
  }));

  // Normalização de data (DD/MM/YYYY -> YYYY-MM-DD)
  let formattedDate = "2024-01-01";
  if (typeof dataSorteio === 'string' && dataSorteio.includes('/')) {
    const parts = dataSorteio.split('/');
    if (parts.length === 3) formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
  } else if (typeof dataSorteio === 'string' && dataSorteio.includes('-')) {
    formattedDate = dataSorteio.split('T')[0];
  }

  return {
    concurso: concursoNum,
    data: formattedDate,
    dezenas,
    soma,
    pares,
    impares,
    repetidas_anterior,
    premiacao_json,
    valor_estimado: Number(data.valorEstimadoProximoConcurso || 0)
  };
};