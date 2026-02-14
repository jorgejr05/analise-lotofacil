"use client";

import React, { useEffect, useState } from "react";
import { useLotofacilStats } from "@/hooks/use-lotofacil-stats";
import { syncLatestResults } from "@/lib/lotofacil-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp, Hash, Clock, Sparkles, Flame, Snowflake, Banknote, Trophy } from "lucide-react";
import { toast } from "sonner";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

export default function Dashboard() {
  const { stats, loading, refresh } = useLotofacilStats();
  const [syncing, setSyncing] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const autoSync = async () => {
      try {
        await syncLatestResults();
        refresh();
      } catch (e) {
        console.error("Sincronização automática falhou", e);
      }
    };
    autoSync();
  }, [refresh]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await syncLatestResults();
      toast.success(res.message);
      refresh();
    } catch (error) {
      toast.error("Erro ao sincronizar dados.");
    } finally {
      setSyncing(false);
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-white">
        <div className="relative">
          <RefreshCw className="h-12 w-12 animate-spin text-indigo-600 opacity-20" />
          <Sparkles className="h-6 w-6 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
        <p className="text-slate-900 font-black tracking-tighter text-xl italic uppercase">Iniciando Motor...</p>
      </div>
    );
  }

  const getTopNumbers = (freqs: Record<number, number>, count: number, ascending = false) => {
    return Object.entries(freqs)
      .map(([num, freq]) => ({ num: Number(num), freq }))
      .sort((a, b) => ascending ? a.freq - b.freq : b.freq - a.freq)
      .slice(0, count);
  };

  const quentes = stats ? getTopNumbers(stats.freqTotal, 10) : [];
  const frios = stats ? getTopNumbers(stats.freqTotal, 10, true) : [];

  // Extrair prêmios
  const getPrize = (desc: string) => {
    const p = stats?.ultimoConcurso?.premiacao_json?.find((p: any) => p.descricao.includes(desc));
    return p?.valor?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || "R$ ---";
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] md:pl-64 pb-32">
      <div className="p-5 md:p-10 max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col gap-1">
          <div className="flex items-center justify-end">
            <div className="flex items-center gap-2 text-slate-400">
              <Clock className="h-3 w-3" />
              <span className="text-[10px] font-bold">{formatDateTime(now)}</span>
            </div>
          </div>
          <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter leading-none italic uppercase">
            Visão <span className="text-indigo-600">Geral</span>
          </h1>
          <Button 
            onClick={handleSync} 
            disabled={syncing}
            className="w-fit mt-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-tr-2xl rounded-bl-2xl px-6 py-4 md:px-8 md:py-6 shadow-xl shadow-indigo-100 transition-all font-black uppercase italic tracking-wider text-[10px] md:text-xs"
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", syncing && "animate-spin")} />
            {syncing ? 'Atualizando...' : 'Atualizar Dados'}
          </Button>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-tl-[3rem] rounded-br-[3rem] shadow-sm border border-slate-100 flex flex-col justify-between h-32">
            <Hash className="h-5 w-5 text-indigo-500" />
            <div>
              <div className="text-2xl font-black tracking-tighter">#{stats?.ultimoConcurso?.concurso}</div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Concurso</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-tr-[3rem] rounded-bl-[3rem] shadow-sm border border-slate-100 flex flex-col justify-between h-32">
            <Banknote className="h-5 w-5 text-emerald-500" />
            <div>
              <div className="text-lg md:text-xl font-black tracking-tighter text-emerald-600">{getPrize("15 acertos")}</div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Prêmio 15 Pts</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-tr-[3rem] rounded-bl-[3rem] shadow-sm border border-slate-100 flex flex-col justify-between h-32">
            <Hash className="h-5 w-5 text-orange-500" />
            <div>
              <div className="text-2xl font-black tracking-tighter">
                {Math.round(stats?.paresMedia)}<span className="text-slate-300 text-lg">P</span>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pares Ideais</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-tl-[3rem] rounded-br-[3rem] shadow-sm border border-slate-100 flex flex-col justify-between h-32">
            <Sparkles className="h-5 w-5 text-rose-500" />
            <div>
              <div className="text-2xl font-black tracking-tighter">
                {stats?.repetidasMedia?.toFixed(1) || "---"}
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Repetidas</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[3rem] blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
              <Card className="relative border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white">
                <CardHeader className="bg-slate-900 text-white p-8">
                  <CardTitle className="flex justify-between items-center">
                    <span className="text-lg md:text-xl font-black italic uppercase tracking-tighter">Último Sorteio</span>
                    <span className="bg-indigo-600 px-4 py-1 rounded-full text-[10px] font-black uppercase">
                      {formatDate(stats?.ultimoConcurso?.data)}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-10">
                  <div className="grid grid-cols-5 gap-3 md:flex md:flex-wrap md:justify-center">
                    {stats?.ultimoConcurso?.dezenas.map((num: number) => (
                      <div 
                        key={num} 
                        className="aspect-square w-full md:w-14 md:h-14 rounded-2xl bg-slate-50 border-2 border-slate-100 text-slate-900 flex items-center justify-center font-black text-lg md:text-xl shadow-inner"
                      >
                        {num.toString().padStart(2, '0')}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="border-none shadow-xl rounded-[3rem] overflow-hidden bg-white transition-transform hover:scale-[1.01] duration-500">
                <CardHeader className="bg-slate-900 text-white p-6">
                  <CardTitle className="flex items-center gap-3">
                    <div className="bg-orange-500 p-2 rounded-xl">
                      <Flame className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-black italic uppercase tracking-tighter">Tendência: Quentes</div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Mais sorteados (100 jogos)</div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {quentes.map((item) => (
                      <div key={item.num} className="flex flex-col items-center gap-2 group">
                        <div className="w-12 h-12 rounded-xl bg-orange-50 border-2 border-orange-100 text-orange-700 flex items-center justify-center font-black text-lg shadow-sm group-hover:bg-orange-500 group-hover:text-white transition-all duration-300">
                          {item.num.toString().padStart(2, '0')}
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter italic">
                          {item.freq.toFixed(1).replace(/\.0$/, '')}%
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-xl rounded-[3rem] overflow-hidden bg-white transition-transform hover:scale-[1.01] duration-500">
                <CardHeader className="bg-slate-900 text-white p-6">
                  <CardTitle className="flex items-center gap-3">
                    <div className="bg-indigo-500 p-2 rounded-xl">
                      <Snowflake className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-black italic uppercase tracking-tighter">Tendência: Frios</div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Menos sorteados (100 jogos)</div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {frios.map((item) => (
                      <div key={item.num} className="flex flex-col items-center gap-2 group">
                        <div className="w-12 h-12 rounded-xl bg-indigo-50 border-2 border-indigo-100 text-indigo-700 flex items-center justify-center font-black text-lg shadow-sm group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300">
                          {item.num.toString().padStart(2, '0')}
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter italic">
                          {item.freq.toFixed(1).replace(/\.0$/, '')}%
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="space-y-6">
            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
              <CardHeader className="bg-indigo-600 text-white p-6">
                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <Trophy className="h-4 w-4" /> Tabela de Prêmios
                </CardTitle>
              </Header>
              <CardContent className="p-6 space-y-4">
                {[15, 14, 13, 12, 11].map((pts) => (
                  <div key={pts} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:bg-indigo-50 transition-colors">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{pts} Pontos</span>
                      <span className="text-sm font-black text-slate-900 italic">{getPrize(`${pts} acertos`)}</span>
                    </div>
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black",
                      pts === 15 ? "bg-yellow-100 text-yellow-700" : "bg-slate-200 text-slate-500"
                    )}>
                      {pts}
                    </div>
                  </div>
                ))}
                <p className="text-[8px] font-bold text-slate-400 uppercase text-center mt-4">
                  Valores baseados no concurso #{stats?.ultimoConcurso?.concurso}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}