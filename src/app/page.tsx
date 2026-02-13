"use client";

import { useEffect, useState } from "react";
import { useLotofacilStats } from "@/hooks/use-lotofacil-stats";
import { syncLatestResults } from "@/lib/lotofacil-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp, Hash, Calendar, Clock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { MadeWithDyad } from "@/components/made-with-dyad";
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
        console.error("Auto-sync falhou", e);
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

  return (
    <div className="min-h-screen bg-[#F8FAFC] md:pl-64 pb-32">
      <div className="p-5 md:p-10 max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col gap-2">
          <div className="flex items-center justify-end">
            <div className="flex items-center gap-2 text-slate-400">
              <Clock className="h-3 w-3" />
              <span className="text-[10px] font-bold">{formatDateTime(now)}</span>
            </div>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-none italic uppercase">
            Visão <span className="text-indigo-600">Geral</span>
          </h1>
          <Button 
            onClick={handleSync} 
            disabled={syncing}
            className="w-fit mt-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-tr-2xl rounded-bl-2xl px-8 py-6 shadow-xl shadow-indigo-100 transition-all font-black uppercase italic tracking-wider text-xs"
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", syncing && "animate-spin")} />
            {syncing ? 'Atualizando...' : 'Atualizar Dados'}
          </Button>
        </header>

        {/* Grid de Stats Assimétricos */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-tl-[3rem] rounded-br-[3rem] shadow-sm border border-slate-100 flex flex-col justify-between h-32">
            <Hash className="h-5 w-5 text-indigo-500" />
            <div>
              <div className="text-2xl font-black tracking-tighter">{stats?.ultimoConcurso?.concurso}</div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Concurso</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-tr-[3rem] rounded-bl-[3rem] shadow-sm border border-slate-100 flex flex-col justify-between h-32">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            <div>
              <div className="text-2xl font-black tracking-tighter">{Math.round(stats?.somaMedia)}</div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Soma Média</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-tr-[3rem] rounded-bl-[3rem] shadow-sm border border-slate-100 flex flex-col justify-between h-32">
            <Hash className="h-5 w-5 text-orange-500" />
            <div>
              <div className="text-2xl font-black tracking-tighter">
                {Math.round(stats?.paresMedia)}<span className="text-slate-300 text-lg">P</span>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ideal Pares</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-tl-[3rem] rounded-br-[3rem] shadow-sm border border-slate-100 flex flex-col justify-between h-32">
            <Sparkles className="h-5 w-5 text-rose-500" />
            <div>
              <div className="text-2xl font-black tracking-tighter">9.2</div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Repetidas</p>
            </div>
          </div>
        </div>

        {/* Resultado Principal */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[3rem] blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
          <Card className="relative border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white">
            <CardHeader className="bg-slate-900 text-white p-8">
              <CardTitle className="flex justify-between items-center">
                <span className="text-xl font-black italic uppercase tracking-tighter">Último Sorteio</span>
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

        <div className="flex justify-center py-10 opacity-30">
          <MadeWithDyad />
        </div>
      </div>
    </div>
  );
}