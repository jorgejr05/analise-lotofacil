"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Beaker, Play, BarChart2, CheckCircle2, Loader2, Info, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { runBacktestBatch } from "@/lib/lab-service";
import { cn } from "@/lib/utils";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from "recharts";

export default function LabPage() {
  const [backtests, setBacktests] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const fetchBacktests = async () => {
    const { data } = await supabase
      .from('backtests')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setBacktests(data);
  };

  useEffect(() => {
    fetchBacktests();
    const sub = supabase.channel('backtests_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'backtests' }, fetchBacktests)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const startTest = async (model: 'gemini' | 'random') => {
    setIsRunning(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: latest } = await supabase.from('concursos').select('concurso').order('concurso', { ascending: false }).limit(1).single();
      
      if (!latest) {
        toast.error("Nenhum concurso encontrado para iniciar o teste.");
        return;
      }

      const end = latest.concurso;
      const start = end - 100; // Testar janela de 100 concursos

      const { data: bt, error } = await supabase.from('backtests').insert({
        user_id: user.id,
        modelo_usado: model,
        quantidade_concursos: 100,
        jogos_por_concurso: 6,
        status: 'processando'
      }).select().single();

      if (error) throw error;

      toast.info(`Iniciando backtest ${model}...`);
      await runBacktestBatch({
        userId: user.id,
        startConcurso: start,
        endConcurso: end,
        gamesPerContest: 6,
        model: model
      }, bt.id);

      toast.success("Backtest concluído!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao rodar backtest");
    } finally {
      setIsRunning(false);
    }
  };

  const getComparisonData = () => {
    const gemini = backtests.find(b => b.modelo_usado === 'gemini' && b.status === 'concluido');
    const random = backtests.find(b => b.modelo_usado === 'random' && b.status === 'concluido');
    if (!gemini || !random) return null;

    return [
      { name: '11 Pts', Gemini: gemini.resultado_json.p11.toFixed(2), Baseline: random.resultado_json.p11.toFixed(2) },
      { name: '12 Pts', Gemini: gemini.resultado_json.p12.toFixed(2), Baseline: random.resultado_json.p12.toFixed(2) },
      { name: '13 Pts', Gemini: gemini.resultado_json.p13.toFixed(2), Baseline: random.resultado_json.p13.toFixed(2) },
    ];
  };

  const chartData = getComparisonData();

  return (
    <div className="min-h-screen bg-[#F8FAFC] md:pl-64 pb-32">
      <div className="p-5 md:p-10 max-w-6xl mx-auto space-y-8">
        <header className="space-y-1">
          <span className="text-[10px] font-black tracking-widest text-indigo-500 uppercase italic">Laboratório de Testes</span>
          <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">
            Validação de <span className="text-indigo-600">Eficiência</span>
          </h1>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-6">
            <Card className="border-none shadow-2xl rounded-[2rem] bg-white overflow-hidden">
              <CardHeader className="bg-slate-900 text-white p-6">
                <CardTitle className="text-sm font-black uppercase tracking-tighter flex items-center gap-2">
                  <Play className="h-4 w-4 text-indigo-400" /> Iniciar Teste
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <Button onClick={() => startTest('gemini')} disabled={isRunning} className="w-full bg-indigo-600 hover:bg-indigo-700 h-14 font-black uppercase italic tracking-wider text-xs rounded-xl">
                  {isRunning ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Beaker className="mr-2 h-4 w-4" />}
                  Testar Motor Atual
                </Button>
                <Button onClick={() => startTest('random')} disabled={isRunning} variant="outline" className="w-full border-2 border-slate-100 h-14 font-black uppercase italic tracking-wider text-xs rounded-xl text-slate-600">
                  Testar Baseline (Random)
                </Button>
              </CardContent>
            </Card>

            <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100 flex gap-4 items-start">
              <Info className="h-6 w-6 text-indigo-600 shrink-0 mt-1" />
              <p className="text-indigo-700 text-[10px] leading-relaxed font-bold uppercase italic">
                O backtest simula a geração de jogos no passado usando apenas estatísticas disponíveis na época.
              </p>
            </div>
          </div>

          <div className="lg:col-span-2">
            <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden h-full">
              <CardHeader className="p-8 pb-0">
                <CardTitle className="text-sm font-black uppercase tracking-tighter flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="h-5 w-5 text-indigo-600" /> Comparação de Performance (%)
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 h-[350px]">
                {chartData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" fontSize={10} fontWeight="bold" axisLine={false} />
                      <YAxis fontSize={10} fontWeight="bold" axisLine={false} unit="%" />
                      <Tooltip contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Legend />
                      <Bar dataKey="Gemini" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Baseline" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-3">
                    <TrendingUp className="h-12 w-12 opacity-20" />
                    <p className="text-[10px] font-black uppercase italic">Rode os dois testes para ver a comparação</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">Monitor de Execução</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {backtests.map((bt) => (
              <Card key={bt.id} className="border-none shadow-lg rounded-2xl bg-white overflow-hidden">
                <CardContent className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      bt.modelo_usado === 'gemini' ? "bg-indigo-50 text-indigo-600" : "bg-slate-50 text-slate-400"
                    )}>
                      {bt.status === 'processando' ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="text-xs font-black uppercase tracking-tighter">Motor {bt.modelo_usado === 'gemini' ? 'IA' : 'Random'}</div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase">{bt.quantidade_concursos} Concursos</div>
                    </div>
                  </div>
                  <div className="text-sm font-black text-indigo-600 italic">
                    {bt.status === 'processando' ? `${bt.progresso}%` : 'OK'}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}