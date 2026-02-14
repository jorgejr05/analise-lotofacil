"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { getBankrollStats, updateBankrollSettings } from "@/lib/finance-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  History, 
  Activity,
  Target,
  BarChart3,
  Settings2,
  Loader2,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function BankrollPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [newInitial, setNewInitial] = useState("");

  const loadData = async () => {
    if (user) {
      const data = await getBankrollStats(user.id);
      setStats(data);
      setNewInitial(data.initialBankroll.toString());
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleUpdateInitial = async () => {
    if (!user || !newInitial) return;
    setUpdating(true);
    try {
      const { error } = await updateBankrollSettings(user.id, parseFloat(newInitial));
      if (error) throw error;
      toast.success("Banca inicial atualizada!");
      await loadData();
    } catch (error) {
      toast.error("Erro ao atualizar banca.");
    } finally {
      setUpdating(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-white">
        <Wallet className="h-12 w-12 animate-pulse text-indigo-200" />
        <p className="text-slate-900 font-black tracking-tighter text-xl italic uppercase">Processando Transações...</p>
      </div>
    );
  }

  const isPositive = stats.roiGeral >= 0;

  const chartData = stats.history.map((h: any, idx: number) => {
    let balance = stats.initialBankroll;
    for (let i = 0; i <= idx; i++) {
      balance += (Number(stats.history[i].valor_premiado) - Number(stats.history[i].valor_apostado));
    }
    return {
      name: `C${h.concurso_id}`,
      balance: balance
    };
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] md:pl-64 pb-32">
      <div className="p-5 md:p-10 max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-black tracking-widest text-indigo-500 uppercase italic">Gestão Financeira</span>
            <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">
              Minha <span className="text-indigo-600">Banca</span>
            </h1>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-xl border-2 border-slate-100 font-black uppercase italic text-[10px] tracking-widest h-11">
                <Settings2 className="h-4 w-4 mr-2" /> Ajustar Capital
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2rem] border-none shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-sm font-black uppercase italic">Configurar Banca Inicial</DialogTitle>
              </DialogHeader>
              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400">Valor de Aporte Inicial (R$)</label>
                  <Input 
                    type="number" 
                    value={newInitial} 
                    onChange={(e) => setNewInitial(e.target.value)}
                    className="h-12 rounded-xl border-slate-100 bg-slate-50 font-bold"
                  />
                </div>
                <Button 
                  onClick={handleUpdateInitial} 
                  disabled={updating}
                  className="w-full h-12 bg-indigo-600 rounded-xl font-black uppercase italic"
                >
                  {updating ? <Loader2 className="animate-spin h-4 w-4" /> : "Confirmar Novo Saldo"}
                </Button>
                <p className="text-[9px] font-bold text-slate-400 uppercase leading-relaxed">
                  * O saldo atual será recalculado com base neste valor somado ao lucro/prejuízo histórico.
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-none shadow-lg rounded-[2rem] bg-slate-900 text-white p-6 flex flex-col justify-between h-40">
            <div className="flex justify-between items-start">
              <Wallet className="h-6 w-6 text-indigo-400" />
              <div className="bg-indigo-500/20 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest">Saldo Atual</div>
            </div>
            <div>
              <div className="text-xl md:text-2xl font-black tracking-tighter truncate">
                {stats.currentBankroll.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Capital em Operação</p>
            </div>
          </Card>

          <Card className="border-none shadow-lg rounded-[2rem] bg-white p-6 flex flex-col justify-between h-40">
            <div className="flex justify-between items-start">
              <Activity className={cn("h-6 w-6", isPositive ? "text-emerald-500" : "text-rose-500")} />
              <div className={cn("px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest", isPositive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
                ROI Global
              </div>
            </div>
            <div>
              <div className={cn("text-2xl font-black tracking-tighter", isPositive ? "text-emerald-600" : "text-rose-600")}>
                {isPositive ? "+" : ""}{stats.roiGeral.toFixed(2)}%
              </div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Retorno sobre Investimento</p>
            </div>
          </Card>

          <Card className="border-none shadow-lg rounded-[2rem] bg-white p-6 flex flex-col justify-between h-40">
            <div className="flex justify-between items-start">
              <Target className="h-6 w-6 text-indigo-500" />
              <div className="bg-slate-50 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest">Volume</div>
            </div>
            <div>
              <div className="text-xl md:text-2xl font-black tracking-tighter truncate">
                {stats.totalApostado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Total Apostado</p>
            </div>
          </Card>

          <Card className="border-none shadow-lg rounded-[2rem] bg-white p-6 flex flex-col justify-between h-40">
            <div className="flex justify-between items-start">
              <TrendingDown className="h-6 w-6 text-rose-400" />
              <div className="bg-rose-50 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest text-rose-600">Queda Máxima</div>
            </div>
            <div>
              <div className="text-xl md:text-2xl font-black tracking-tighter text-rose-600 truncate">
                {stats.maxDrawdown.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Pior Oscilação</p>
            </div>
          </Card>
        </div>

        <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
          <CardHeader className="p-8 pb-0">
            <CardTitle className="text-sm font-black uppercase tracking-tighter flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-indigo-600" /> Curva de Equidade
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 h-[300px] md:h-[400px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} hide={window.innerWidth < 768} />
                  <YAxis fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} 
                  />
                  <Area type="monotone" dataKey="balance" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorBalance)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-3">
                <TrendingUp className="h-12 w-12 opacity-20" />
                <p className="text-[10px] font-black uppercase italic text-center px-10">
                  Nenhum histórico de apostas para gerar o gráfico de performance.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2 flex items-center gap-2">
            <History className="h-3 w-3" /> Histórico de Transações
          </h2>
          
          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-[2rem] shadow-xl overflow-hidden border border-slate-100">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Concurso</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Aposta</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Prêmio</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Resultado</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Tipo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stats.history.slice().reverse().map((h: any) => (
                  <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-xs font-black text-slate-900 italic">#{h.concurso_id}</div>
                      <div className="text-[8px] font-bold text-slate-400 uppercase">{new Date(h.data_aposta).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-600">
                      {Number(h.valor_apostado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-emerald-600">
                      {Number(h.valor_premiado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest",
                        Number(h.lucro_prejuizo) >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                      )}>
                        {Number(h.lucro_prejuizo) >= 0 ? "+" : ""}{Number(h.lucro_prejuizo).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "text-[8px] font-black uppercase tracking-tighter",
                        h.is_simulado ? "text-indigo-400" : "text-emerald-500"
                      )}>
                        {h.is_simulado ? "Simulado" : "Real"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Layout (Card Based) */}
          <div className="md:hidden space-y-3">
            {stats.history.slice().reverse().map((h: any) => (
              <Card key={h.id} className="border-none shadow-sm rounded-2xl bg-white overflow-hidden p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-900 italic">Concurso #{h.concurso_id}</span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase">{new Date(h.data_aposta).toLocaleDateString()}</span>
                  </div>
                  <span className={cn(
                    "text-[8px] font-black uppercase px-2 py-1 rounded-lg",
                    h.is_simulado ? "bg-indigo-50 text-indigo-500" : "bg-emerald-50 text-emerald-500"
                  )}>
                    {h.is_simulado ? "Simulado" : "Real"}
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-300 uppercase">Aposta</span>
                    <span className="text-[10px] font-bold text-slate-600">
                      {Number(h.valor_apostado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-300 uppercase">Prêmio</span>
                    <span className="text-[10px] font-bold text-emerald-600">
                      {Number(h.valor_premiado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[8px] font-black text-slate-300 uppercase">Resultado</span>
                    <span className={cn(
                      "text-[10px] font-black",
                      Number(h.lucro_prejuizo) >= 0 ? "text-emerald-600" : "text-rose-600"
                    )}>
                      {Number(h.lucro_prejuizo) >= 0 ? "+" : ""}{Number(h.lucro_prejuizo).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}