"use client";

import { useEffect, useState, useCallback } from "react";
import { useLotofacilStats } from "@/hooks/use-lotofacil-stats";
import { syncLatestResults, getNextDrawInfo } from "@/lib/lotofacil-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Hash, Clock, Sparkles, Flame, Snowflake, Trophy, Loader2, Target, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn, formatDateTime } from "@/lib/utils";

export default function Dashboard() {
  const { stats, loading, refresh } = useLotofacilStats();
  const [syncing, setSyncing] = useState(false);
  const [now, setNow] = useState(new Date());
  const [nextDraw, setNextDraw] = useState<any>(null);

  const loadNextDrawInfo = useCallback(async () => {
    const info = await getNextDrawInfo();
    setNextDraw(info);
  }, []);

  const handleSync = useCallback(async (silent = false) => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await syncLatestResults();
      if (!silent && res.success) {
        const count = (res as any).count ?? 0;
        if (count > 0) {
          toast.success(`${count} novo(s) concurso(s) sincronizado(s)!`);
        } else {
          toast.info("Nenhum resultado novo disponível na API ainda.");
        }
      }
      await refresh(); 
      await loadNextDrawInfo();
    } catch (error) {
      if (!silent) toast.error("Falha na sincronização com a API.");
    } finally {
      setSyncing(false);
    }
  }, [syncing, refresh, loadNextDrawInfo]);

  // Carga inicial de informações
  useEffect(() => {
    if (!loading) {
      loadNextDrawInfo();
    }
  }, [loading, loadNextDrawInfo]);

  // Relógio da UI
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (loading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-white dark:bg-slate-950">
        <Loader2 className="h-12 w-12 animate-spin text-indigo-600 opacity-20" />
        <p className="text-slate-900 dark:text-slate-100 font-black tracking-tighter text-xl italic uppercase">Iniciando Motor...</p>
      </div>
    );
  }

  const getTopNumbers = (freqs: Record<number, number>, count: number, ascending = false) => {
    if (!freqs) return [];
    return Object.entries(freqs)
      .map(([num, freq]) => ({ num: Number(num), freq }))
      .sort((a, b) => ascending ? a.freq - b.freq : b.freq - a.freq)
      .slice(0, count);
  };

  const quentes = getTopNumbers(stats?.freqTotal, 10);
  const frios = getTopNumbers(stats?.freqTotal, 10, true);

  const getPrizeByHits = (hits: number) => {
    if (hits === 11) return "R$ 7,00";
    if (hits === 12) return "R$ 14,00";
    if (hits === 13) return "R$ 35,00";
    const premiacao = stats?.ultimoConcurso?.premiacao_json;
    if (!premiacao || !Array.isArray(premiacao)) return "R$ ---";
    const faixa = premiacao.find((p: any) => p.faixa === (16 - hits) || p.descricao?.includes(`${hits} acertos`));
    return faixa?.valor ? faixa.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : "R$ ---";
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 md:pl-64 pb-32 transition-colors">
      <div className="p-5 md:p-10 max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
              <Clock className="h-3 w-3" />
              <span className="text-[10px] font-bold">{formatDateTime(now)}</span>
            </div>
            {syncing && (
              <div className="flex items-center gap-2 text-indigo-600 animate-pulse">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-[8px] font-black uppercase italic">Processando...</span>
              </div>
            )}
          </div>
          <h1 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tighter leading-none italic uppercase">
            Visão <span className="text-indigo-600">Geral</span>
          </h1>
          
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <Button 
              onClick={() => handleSync()} 
              disabled={syncing}
              className={cn(
                "rounded-tr-2xl rounded-bl-2xl px-6 py-4 md:px-8 md:py-6 shadow-xl transition-all font-black uppercase italic tracking-wider text-[10px] md:text-xs",
                nextDraw?.isPendingSync 
                  ? "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-100 dark:shadow-amber-900/20 animate-bounce" 
                  : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100 dark:shadow-indigo-900/20"
              )}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", syncing && "animate-spin")} />
              {syncing ? 'Sincronizando...' : nextDraw?.isPendingSync ? 'Resolver Pendência' : 'Sincronizar Base'}
            </Button>

            {nextDraw && (
              <div className={cn(
                "flex items-center gap-3 px-5 py-3 rounded-2xl border-2 transition-all",
                nextDraw.isPendingSync 
                  ? "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400" 
                  : "bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-900/10 dark:border-emerald-900/20 dark:text-emerald-400"
              )}>
                {nextDraw.isPendingSync ? <AlertCircle className="h-4 w-4 text-amber-500" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase tracking-widest">Status do Alvo #{nextDraw.nextNum}</span>
                  <span className="text-[10px] font-black italic uppercase">
                    {nextDraw.isPendingSync ? "Resultado Disponível para Sincronia" : "Base de Dados Atualizada"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-tl-[3rem] rounded-br-[3rem] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between h-32">
            <Hash className="h-5 w-5 text-indigo-500" />
            <div>
              <div className="text-2xl font-black tracking-tighter text-slate-900 dark:text-slate-100">#{stats?.ultimoConcurso?.concurso || '---'}</div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Último Concurso</p>
            </div>
          </div>

          <div className="bg-indigo-600 p-6 rounded-tr-[3rem] rounded-bl-[3rem] shadow-lg flex flex-col justify-between h-32 text-white">
            <Trophy className="h-5 w-5 text-indigo-200" />
            <div>
              <div className="text-lg md:text-xl font-black tracking-tighter truncate">
                {getPrizeByHits(15)}
              </div>
              <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest">Último Prêmio (15 pts)</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-tr-[3rem] rounded-bl-[3rem] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between h-32">
            <Hash className="h-5 w-5 text-orange-500" />
            <div>
              <div className="text-2xl font-black tracking-tighter text-slate-900 dark:text-slate-100">
                {Math.round(stats?.paresMedia || 0)}<span className="text-slate-300 dark:text-slate-600 text-lg">P</span>
              </div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Média Pares</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-tl-[3rem] rounded-br-[3rem] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between h-32">
            <Sparkles className="h-5 w-5 text-rose-500" />
            <div>
              <div className="text-2xl font-black tracking-tighter text-slate-900 dark:text-slate-100">
                {stats?.repetidasMedia?.toFixed(1) || "---"}
              </div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Média Repetidas</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Card className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white dark:bg-slate-900">
              <CardHeader className="bg-slate-900 dark:bg-slate-800 text-white p-8">
                <CardTitle className="flex justify-between items-center">
                  <span className="text-lg md:text-xl font-black italic uppercase tracking-tighter">Dezenas Sorteadas</span>
                  <span className="bg-indigo-600 px-4 py-1 rounded-full text-[10px] font-black uppercase">
                    CONCURSO {stats?.ultimoConcurso?.concurso}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-10">
                <div className="grid grid-cols-5 gap-3 md:flex md:flex-wrap md:justify-center">
                  {stats?.ultimoConcurso?.dezenas.map((num: number) => (
                    <div 
                      key={num} 
                      className="aspect-square w-full md:w-14 md:h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 text-slate-900 dark:text-slate-100 flex items-center justify-center font-black text-lg md:text-xl shadow-inner"
                    >
                      {num.toString().padStart(2, '0')}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="border-none shadow-xl rounded-[3rem] overflow-hidden bg-white dark:bg-slate-900">
                <CardHeader className="bg-slate-900 dark:bg-slate-800 text-white p-6">
                  <CardTitle className="flex items-center gap-3">
                    <Flame className="h-5 w-5 text-orange-500" />
                    <div className="text-sm font-black italic uppercase tracking-tighter">Tendência: Quentes</div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="grid grid-cols-5 gap-4">
                    {quentes.map((item) => (
                      <div key={item.num} className="flex flex-col items-center gap-1">
                        <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/30 text-orange-700 dark:text-orange-400 flex items-center justify-center font-black text-sm">
                          {item.num.toString().padStart(2, '0')}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-xl rounded-[3rem] overflow-hidden bg-white dark:bg-slate-900">
                <CardHeader className="bg-slate-900 dark:bg-slate-800 text-white p-6">
                  <CardTitle className="flex items-center gap-3">
                    <Snowflake className="h-5 w-5 text-indigo-500" />
                    <div className="text-sm font-black italic uppercase tracking-tighter">Tendência: Frios</div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="grid grid-cols-5 gap-4">
                    {frios.map((item) => (
                      <div key={item.num} className="flex flex-col items-center gap-1">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-black text-sm">
                          {item.num.toString().padStart(2, '0')}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="space-y-6">
            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white dark:bg-slate-900 overflow-hidden">
              <CardHeader className="bg-indigo-600 text-white p-6">
                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <Trophy className="h-4 w-4" /> Rateio #{stats?.ultimoConcurso?.concurso}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {[15, 14, 13, 12, 11].map((pts) => (
                  <div key={pts} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{pts} Pontos</span>
                      <span className="text-sm font-black text-slate-900 dark:text-slate-100 italic">{getPrizeByHits(pts)}</span>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-black text-slate-500 dark:text-slate-400">
                      {pts}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}