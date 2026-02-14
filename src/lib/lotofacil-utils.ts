export const calculatePoints = (jogoDezenas: number[], sorteioDezenas: number[]) => {
  return jogoDezenas.filter(num => sorteioDezenas.includes(num)).length;
};

export const processConcursoData = (data: any, anterior?: any) => {
  const dezenas = data.dezenas || [];
  const soma = dezenas.reduce((acc: number, curr: number) => acc + curr, 0);
  const pares = dezenas.filter((n: number) => n % 2 === 0).length;
  const impares = 15 - pares;
  
  let repetidas_anterior = 0;
  if (anterior && dezenas.length > 0) {
    repetidas_anterior = dezenas.filter((n: number) => anterior.dezenas.includes(n)).length;
  }

  // Normalização do Rateio entre diferentes provedores
  let rawRateio = data.listaRateio || data.premiacoes || [];
  const prizesMap: Record<number, { valor: number, ganhadores: number }> = {};
  
  rawRateio.forEach((p: any) => {
    const numHits = p.numeroDeAcertos || (p.descricao?.match(/(\d+) acertos/)?.[1]) || (16 - p.faixa);
    const hits = Number(numHits);
    
    prizesMap[hits] = {
      valor: Number(p.valor || p.valorPremio || 0),
      ganhadores: Number(p.numeroDeGanhadores || p.ganhadores || 0)
    };
  });

  // Injeção de valores fixos (11, 12, 13)
  if (!prizesMap[11] || prizesMap[11].valor <= 0) prizesMap[11] = { valor: 7, ganhadores: prizesMap[11]?.ganhadores || 0 };
  if (!prizesMap[12] || prizesMap[12].valor <= 0) prizesMap[12] = { valor: 14, ganhadores: prizesMap[12]?.ganhadores || 0 };
  if (!prizesMap[13] || prizesMap[13].valor <= 0) prizesMap[13] = { valor: 35, ganhadores: prizesMap[13]?.ganhadores || 0 };

  const premiacao_json = [15, 14, 13, 12, 11].map(hits => ({
    faixa: 16 - hits,
    descricao: `${hits} acertos`,
    valor: prizesMap[hits]?.valor || 0,
    ganhadores: prizesMap[hits]?.ganhadores || 0
  }));

  const formattedDate = data.data?.includes('/') 
    ? data.data.split('/').reverse().join('-') 
    : data.data;

  return {
    concurso: Number(data.concurso),
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