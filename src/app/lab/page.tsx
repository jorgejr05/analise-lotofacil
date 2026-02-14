"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Beaker, 
  Play, 
  BarChart2, 
  CheckCircle2, 
  Loader2, 
  Info, 
  TrendingUp,
  Settings2
} from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { toast } from "sonner";
import { runBacktestBatch } from "@/lib/lab-service";
import { cn } from "@/lib/utils";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from "recharts";

export default function LabPage() {
  const [backtests, setBacktests] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [testCount, setTestCount] = useState("100");

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
    const count = parseInt(testCount);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: latest } = await supabase
        .from('concursos')
        .select('concurso')
        .order('concurso', { ascending: false })
        .limit(1)
        .single();
      
      if (!latest) {
        toast.error("Nenhum concurso encontrado para iniciar o teste.");
        return;
      }

      const end = latest.concurso;
      const start = end - count;

      const { data: bt, error } = await supabase.from('backtests').insert({
        user_id: user.id,
        modelo_usado: model,
        quantidade_concursos: count,
        jogos_por_concurso: 6,
        status: 'processando'
      }).select().single();

      if (error) throw error;

      const modelLabel = model === 'gemini' ? 'IA' : 'Aleatório';
      toast.info(`Iniciando backtest ${modelLabel} (${count} concursos)...`);
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
      { name: '11 Pts', Gemini: gemini.resultado_json.p11.toFixed(2), Aleatório: random.resultado_json.p11.toFixed(2) },
      { name: '12 Pts', Gemini: gemini.resultado_json.p12.toFixed(2), Aleatório: random.resultado_json.p12.toFixed(2) },
      { name: '13 Pts', Gemini: gemini.resultado_json.p13.toFixed(2), Aleatório: random.resultado_json.p13.toFixed(2) },
    ];
  };

  const chartData = getComparisonData();

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 md:pl-64 pb-32 transition-colors">
      <div className="p-5 md:p-10 max-w-6xl mx-auto space-y-8">
        <header className="space-y-1">
          <span className="text-[10px] font-black tracking-widest text-indigo-500 uppercase italic">Laboratório de Testes</span>
          <h1 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tighter uppercase italic leading-none">
            Validação de <span className="text-indigo-600">Eficiência</span>
          </h1>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-6">
            <Card className="border-none shadow-2xl rounded-[2rem] bg-white dark:bg-slate-900 overflow-hidden">
              <CardHeader className="bg-slate-900 dark:bg-slate-800 text-white p-6">
                <CardTitle className="text-sm font-black uppercase tracking-tighter flex items-center gap-2">
                  <Play className="h-4 w-4 text-indigo-400" /> Configurar & Rodar
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-2">
                    <Settings2 className="h-3 w-3" /> Janela de Teste (Concursos)
                  </label>
                  <Select value={testCount} onValueChange={setTestCount}>
                    <SelectTrigger className="h-12 bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-slate-100">
                      <SelectValue placeholder="Selecione a quantidade" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-100 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900">
                      <SelectItem value="10" className="font-bold">Últimos 10 concursos</SelectItem>
                      <SelectItem value="20" className="font-bold">Últimos 20 concursos</SelectItem>
                      <SelectItem value="50" className="font-bold">Últimos 50 concursos</SelectItem>
                      <SelectItem value="100" className="font-bold">Últimos 100 concursos</SelectItem>
                      <SelectItem value="200" className="font-bold">Últimos 200 concursos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3 pt-2">
                  <Button 
                    onClick={() => startTest('gemini')} 
                    disabled={isRunning} 
                    className="w-full bg-indigo-600 hover:bg-indigo-700 h-14 font-black uppercase italic tracking-wider text-xs rounded-xl shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20"
                  >
                    {isRunning ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Beaker className="mr-2 h-4 w-4" />}
                    Testar Motor IA
                  </Button>
                  <Button 
                    onClick={() => startTest('random')} 
                    disabled={isRunning} 
                    variant="outline" 
                    className="w-full border-2 border-slate-100 dark:border-slate-800 h-14 font-black uppercase italic tracking-wider text-xs rounded-xl text-slate-600 dark:text-slate-400"
                  >
                    Testar Motor Aleatório
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="bg-indigo-50 dark:bg-indigo-900/10 p-6 rounded-[2rem] border border-indigo-100 dark:border-indigo-900/20 flex gap-4 items-start">
              <Info className="h-6 w-6 text-indigo-600 dark:text-indigo-400 shrink-0 mt-1" />
              <p className="text-indigo-700 dark:text-indigo-400 text-[10px] leading-relaxed font-bold uppercase italic">
                Simulação cega: o sistema volta no tempo e tenta prever o concurso X usando apenas dados anteriores a ele.
              </p>
            </div>
          </div>

          <div className="lg:col-span-2">
            <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white dark:bg-slate-900 overflow-hidden h-full">
              <CardHeader className="p-8 pb-0">
                <CardTitle className="text-sm font-black uppercase tracking-tighter flex items-center justify-between text-slate-900 dark:text-slate-100">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="h-5 w-5 text-indigo-600" /> Comparação de Performance (%)
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 h-[380px]">
                {chartData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:opacity-10" />
                      <XAxis dataKey="name" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                      <YAxis fontSize={10} fontWeight="bold" axisLine={false} unit="%" />
                      <Tooltip 
                        contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} 
                      />
                      <Legend verticalAlign="top" align="right" />
                      <Bar dataKey="Gemini" fill="#4f46e5" radius={[6, 6, 0, 0]} name="Inteligência IA" />
                      <Bar dataKey="Aleatório" fill="#94a3b8" radius={[6, 6, 0, 0]} name="Aposta Aleatória" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 gap-3">
                    <TrendingUp className="h-12 w-12 opacity-20" />
                    <p className="text-[10px] font-black uppercase italic text-center px-10">
                      Rode os testes IA e Aleatório para visualizar a comparação de eficácia estatística.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 px-2">Histórico de Experimentos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {backtests.map((bt) => (
              <Card key={bt.id} className="border-none shadow-lg rounded-2xl bg-white dark:bg-slate-900 overflow-hidden hover:shadow-xl transition-shadow">
                <CardContent className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      bt.modelo_usado === 'gemini' ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400" : "bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                    )}>
                      {bt.status === 'processando' ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="text-xs font-black uppercase tracking-tighter text-slate-900 dark:text-slate-100">Motor {bt.modelo_usado === 'gemini' ? 'IA' : 'Aleatório'}</div>
                      <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">{bt.quantidade_concursos} Concursos • {new Date(bt.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className="text-sm font-black text-indigo-600 dark:text-indigo-400 italic">
                    {bt.status === 'processando' ? `${bt.progresso}%` : 'Finalizado'}
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