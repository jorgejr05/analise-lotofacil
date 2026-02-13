import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useLotofacilStats = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const calculateStats = async () => {
    setLoading(true);
    try {
      const { data: concursos } = await supabase
        .from('concursos')
        .select('*')
        .order('concurso', { ascending: false })
        .limit(100);

      if (!concursos || concursos.length === 0) return;

      const freqTotal: Record<number, number> = {};
      const atraso: Record<number, number> = {};
      
      // Inicializar
      for (let i = 1; i <= 25; i++) {
        freqTotal[i] = 0;
        atraso[i] = 0;
      }

      concursos.forEach((c, idx) => {
        c.dezenas.forEach((d: number) => {
          freqTotal[d]++;
        });
      });

      // Calcular atraso (concursos desde a última aparição)
      for (let i = 1; i <= 25; i++) {
        const lastIndex = concursos.findIndex(c => c.dezenas.includes(i));
        atraso[i] = lastIndex === -1 ? 100 : lastIndex;
      }

      const somaMedia = concursos.reduce((acc, c) => acc + c.soma, 0) / concursos.length;
      const paresMedia = concursos.reduce((acc, c) => acc + c.pares, 0) / concursos.length;

      setStats({
        freqTotal,
        atraso,
        somaMedia,
        paresMedia,
        ultimoConcurso: concursos[0],
        historicoRecente: concursos.slice(0, 5)
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateStats();
  }, []);

  return { stats, loading, refresh: calculateStats };
};