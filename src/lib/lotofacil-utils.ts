export const calculatePoints = (jogoDezenas: number[], sorteioDezenas: number[]) => {
  if (!jogoDezenas || !sorteioDezenas) return 0;
  const j = Array.isArray(jogoDezenas) ? jogoDezenas.map(Number) : [];
  const s = Array.isArray(sorteioDezenas) ? sorteioDezenas.map(Number) : [];
  return j.filter(num => s.includes(num)).length;
};

/**
 * Processa os dados brutos da API Guidi para o formato do nosso banco de dados.
 * Baseado no JSON real: numero, dataApuracao, listaDezenas, listaRateioPremio.
 */
export const processConcursoData = (data: any, anterior?: any) => {
  const dezenas = (data.listaDezenas || []).map((n: any) => Number(n)).sort((a: number, b: number) => a - b);
  const concursoNum = Number(data.numero);
  const dataSorteio = data.dataApuracao; // "14/02/2026"

  const soma = dezenas.reduce((acc: number, curr: number) => acc + curr, 0);
  const pares = dezenas.filter((n: number) => n % 2 === 0).length;
  const impares = 15 - pares;
  
  let repetidas_anterior = 0;
  if (anterior && dezenas.length === 15) {
    const dezenasAnterior = Array.isArray(anterior.dezenas) ? anterior.dezenas.map(Number) : [];
    repetidas_anterior = dezenas.filter((n: number) => dezenasAnterior.includes(n)).length;
  }

  // Mapeamento do Rateio conforme o JSON da Guidi
  const rawRateio = data.listaRateioPremio || [];
  const premiacao_json = rawRateio.map((p: any) => ({
    faixa: p.faixa,
    descricao: p.descricaoFaixa,
    valor: Number(p.valorPremio || 0),
    ganhadores: Number(p.numeroDeGanhadores || 0)
  }));

  // Normalização de data (DD/MM/YYYY -> YYYY-MM-DD)
  let formattedDate = "2024-01-01";
  if (typeof dataSorteio === 'string' && dataSorteio.includes('/')) {
    const parts = dataSorteio.split('/');
    if (parts.length === 3) formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
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