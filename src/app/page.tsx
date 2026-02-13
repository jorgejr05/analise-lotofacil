"use client";

import { useEffect, useState } from "react";
import { useLotofacilStats } from "@/hooks/use-lotofacil-stats";
import { syncLatestResults } from "@/lib/lotofacil-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp, Hash, Calendar } from "lucide-react";
import { toast } from "sonner";
import { MadeWithDyad } from "@/components/made-with-dyad";

export default function Dashboard() {
  const { stats, loading, refresh } = useLotofacilStats();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await syncLatestResults();
      toast.success(res.message);
      refresh();
    } catch (error) {
      toast.error("Erro ao sincronizar dados");
    } finally {
      setSyncing(false);
    }
  };

  if (loading && !stats) {
    return <div className="flex items-center justify-center min-h-screen">Carregando dados...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Lotofácil Probabilidades</h1>
            <p className="text-slate-500">Análise inteligente e geração de jogos</p>
          </div>
          <Button 
            onClick={handleSync} 
            disabled={syncing}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-6"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            Sincronizar Dados
          </Button>
        </header>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 flex items-center">
                <Hash className="mr-2 h-4 w-4 text-indigo-500" /> Último Concurso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.ultimoConcurso?.concurso || '---'}</div>
              <p className="text-xs text-slate-400 flex items-center mt-1">
                <Calendar className="mr-1 h-3 w-3" /> {stats?.ultimoConcurso?.data || '---'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 flex items-center">
                <TrendingUp className="mr-2 h-4 w-4 text-emerald-500" /> Soma Média
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(stats?.somaMedia || 0)}</div>
              <p className="text-xs text-slate-400 mt-1">Últimos 100 concursos</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 flex items-center">
                <Hash className="mr-2 h-4 w-4 text-orange-500" /> Pares/Ímpares
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round(stats?.paresMedia)} / {15 - Math.round(stats?.paresMedia)}
              </div>
              <p className="text-xs text-slate-400 mt-1">Distribuição média</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 flex items-center">
                <TrendingUp className="mr-2 h-4 w-4 text-rose-500" /> Repetidas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">9.2</div>
              <p className="text-xs text-slate-400 mt-1">Média do concurso anterior</p>
            </CardContent>
          </Card>
        </div>

        {/* Último Resultado */}
        <Card className="border-none shadow-md overflow-hidden">
          <CardHeader className="bg-indigo-900 text-white">
            <CardTitle className="flex justify-between items-center">
              <span>Dezenas Sorteadas - Concurso {stats?.ultimoConcurso?.concurso}</span>
              <span className="text-sm font-normal opacity-80">{stats?.ultimoConcurso?.data}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 bg-white">
            <div className="flex flex-wrap gap-3 justify-center">
              {stats?.ultimoConcurso?.dezenas.map((num: number) => (
                <div 
                  key={num} 
                  className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg shadow-sm border border-indigo-200"
                >
                  {num.toString().padStart(2, '0')}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Números Quentes e Atrasados */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Números Mais Frequentes (Quentes)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(stats?.freqTotal || {})
                  .sort(([, a]: any, [, b]: any) => b - a)
                  .slice(0, 5)
                  .map(([num, freq]: any) => (
                    <div key={num} className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold">
                        {num.padStart(2, '0')}
                      </div>
                      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-orange-500 h-full rounded-full" 
                          style={{ width: `${(freq / 100) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-slate-600">{freq}%</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Números Mais Atrasados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(stats?.atraso || {})
                  .sort(([, a]: any, [, b]: any) => b - a)
                  .slice(0, 5)
                  .map(([num, atr]: any) => (
                    <div key={num} className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-slate-700 text-white flex items-center justify-center font-bold">
                        {num.padStart(2, '0')}
                      </div>
                      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-slate-700 h-full rounded-full" 
                          style={{ width: `${(atr / 20) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-slate-600">{atr} concursos</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-center pt-8">
          <MadeWithDyad />
        </div>
      </div>
    </div>
  );
}