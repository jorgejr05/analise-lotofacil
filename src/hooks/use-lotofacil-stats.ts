import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useLotofacilStats = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const calculateStats = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    
    try {
      const { data: concursos } = await supabase
        .from('concursos')
        .select('*')
        .order('concurso', { ascending: false })
        .limit(500);

      if (!concursos || concursos.length === 0) {
        setLoading(false);
        return;
      }

      const calcFreq = (list: any[]) => {
        const freq: Record<number, number> = {};
        for (let i = 1; i <= 25; i++) freq[i] = 0;
        list.forEach(c => c.dezenas.forEach((d: number) => freq[d]++));
        Object.keys(freq).forEach(k => freq[Number(k)] = (freq[Number(k)] / list.length) * 100);
        return freq;
      };

      const freq50 = calcFreq(concursos.slice(0, 50));
      const freq200 = calcFreq(concursos.slice(0, 200));
      const freqTotal = calcFreq(concursos);

      const atraso: Record<number, number> = {};
      for (let i = 1; i <= 25; i++) {
        const lastIndex = concursos.findIndex((c: any) => c.dezenas.includes(i));
        atraso[i] = lastIndex === -1 ? 100 : lastIndex;
      }

      const somaMedia = concursos.slice(0, 100).reduce((acc: number, c: any) => acc + c.soma, 0) / 100;
      const paresMedia = concursos.slice(0, 100).reduce((acc: number, c: any) => acc + c.pares, 0) / 100;
      
      const concursosComRepetidas = concursos.filter((c: any) => c.repetidas_anterior !== null);
      const repetidasMedia = concursosComRepetidas.length > 0
        ? concursosComRepetidas.slice(0, 100).reduce((acc: number, c: any) => acc + (c.repetidas_anterior || 0), 0) / 100
        : 9;

      setStats({
        freq50,
        freq200,
        freqTotal,
        atraso,
        somaMedia,
        paresMedia,
        repetidasMedia,
        ultimoConcurso: concursos[0],
        historicoRecente: concursos.slice(0, 5)
      });
    } catch (error) {
      console.error("Erro ao calcular estatísticas:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    calculateStats(true);
  }, [calculateStats]);

  return { stats, loading, refresh: () => calculateStats(false) };
};