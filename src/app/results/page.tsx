"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Calendar, Hash, ChevronRight, ChevronLeft, Banknote, Users } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

export default function ResultsPage() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('concursos')
        .select('*')
        .order('concurso', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (!error) setResults(data || []);
      setLoading(false);
    };

    fetchResults();
  }, [page]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 md:pl-64 pb-32 transition-colors">
      <div className="p-5 md:p-10 max-w-5xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-black tracking-widest text-indigo-500 uppercase italic">Arquivo Histórico</span>
            <h1 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tighter uppercase italic leading-none">
              Todos os <span className="text-indigo-600">Resultados</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-900 dark:text-slate-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-[10px] font-black uppercase px-4 text-slate-900 dark:text-slate-100">Página {page + 1}</span>
            <button 
              onClick={() => setPage(p => p + 1)}
              disabled={results.length < pageSize}
              className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-900 dark:text-slate-100"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="space-y-6">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-32 bg-slate-100 dark:bg-slate-900 animate-pulse rounded-[2rem]" />
            ))
          ) : (
            results.map((res) => (
              <Card key={res.id} className="border-none shadow-lg rounded-[2rem] bg-white dark:bg-slate-900 overflow-hidden group hover:shadow-xl transition-all">
                <CardContent className="p-0">
                  <div className="p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 border-b border-slate-50 dark:border-slate-800">
                    <div className="flex flex-col items-center md:items-start gap-1 min-w-[120px]">
                      <div className="text-2xl font-black tracking-tighter text-slate-900 dark:text-slate-100">#{res.concurso}</div>
                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                        <Calendar className="h-3 w-3" /> {formatDate(res.data)}
                      </div>
                    </div>

                    <div className="flex-1 flex flex-wrap justify-center md:justify-start gap-2">
                      {res.dezenas.map((num: number) => (
                        <div 
                          key={num} 
                          className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-sm font-black text-slate-700 dark:text-slate-300 shadow-inner group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors"
                        >
                          {num.toString().padStart(2, '0')}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-3 gap-4 md:border-l border-slate-100 dark:border-slate-800 md:pl-6">
                      <div className="text-center">
                        <div className="text-xs font-black text-slate-900 dark:text-slate-100">{res.soma}</div>
                        <div className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase">Soma</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs font-black text-slate-900 dark:text-slate-100">{res.pares}</div>
                        <div className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase">Pares</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs font-black text-slate-900 dark:text-slate-100">{res.repetidas_anterior || '-'}</div>
                        <div className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase">Repet.</div>
                      </div>
                    </div>
                  </div>

                  {res.premiacao_json && (
                    <div className="bg-slate-50/50 dark:bg-slate-950/50 p-6 grid grid-cols-2 md:grid-cols-5 gap-4">
                      {res.premiacao_json.map((premio: any, idx: number) => (
                        <div key={idx} className="space-y-1">
                          <div className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{premio.descricao}</div>
                          <div className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">
                            {premio.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </div>
                          <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400 dark:text-slate-500">
                            <Users className="h-2 w-2" /> {premio.ganhadores} ganhadores
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}