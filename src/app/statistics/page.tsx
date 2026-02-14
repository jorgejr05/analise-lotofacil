"use client";

import { useLotofacilStats } from "@/hooks/use-lotofacil-stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from "recharts";
import { BarChart3, PieChart as PieIcon, Activity, Info } from "lucide-react";

export default function StatisticsPage() {
  const { stats, loading } = useLotofacilStats();

  if (loading || !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-white">
        <Activity className="h-12 w-12 animate-pulse text-indigo-200" />
        <p className="text-slate-900 font-black tracking-tighter text-xl italic uppercase">Processando Big Data...</p>
      </div>
    );
  }

  // Preparar dados para o gráfico de frequência
  const freqData = Object.entries(stats.freqTotal)
    .map(([num, freq]) => ({
      name: num.toString().padStart(2, '0'),
      frequencia: freq as number,
    }))
    .sort((a, b) => Number(a.name) - Number(b.name));

  // Preparar dados para o gráfico de atraso
  const atrasoData = Object.entries(stats.atraso)
    .map(([num, atr]) => ({
      name: num.toString().padStart(2, '0'),
      atraso: atr as number,
    }))
    .sort((a, b) => Number(a.name) - Number(b.name));

  // Dados para Par/Ímpar
  const pares = Math.round(stats.paresMedia);
  const impares = 15 - pares;
  const pieData = [
    { name: 'Pares', value: pares, color: '#4f46e5' },
    { name: 'Ímpares', value: impares, color: '#f97316' },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] md:pl-64 pb-32">
      <div className="p-5 md:p-10 max-w-6xl mx-auto space-y-8">
        <header className="space-y-1">
          <span className="text-[10px] font-black tracking-widest text-indigo-500 uppercase italic">Análise de Tendências</span>
          <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">
            Estatísticas <span className="text-indigo-600">Avançadas</span>
          </h1>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Gráfico de Frequência */}
          <Card className="lg:col-span-2 border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
            <CardHeader className="bg-slate-900 text-white p-6">
              <CardTitle className="text-sm font-black uppercase tracking-tighter flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-indigo-400" /> Frequência das Dezenas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={freqData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="frequencia" radius={[4, 4, 0, 0]}>
                    {freqData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.frequencia > 65 ? '#4f46e5' : '#94a3b8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Distribuição Par/Ímpar */}
          <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
            <CardHeader className="bg-slate-900 text-white p-6">
              <CardTitle className="text-sm font-black uppercase tracking-tighter flex items-center gap-2">
                <PieIcon className="h-5 w-5 text-orange-400" /> Equilíbrio P/I
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 flex flex-col items-center justify-center h-[350px]">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2 w-full">
                {pieData.map((item) => (
                  <div key={item.name} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                    <span className="text-[10px] font-black uppercase text-slate-500">{item.name}</span>
                    <span className="text-sm font-black" style={{ color: item.color }}>{item.value} de 15</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Gráfico de Atraso */}
          <Card className="lg:col-span-3 border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
            <CardHeader className="bg-slate-900 text-white p-6">
              <CardTitle className="text-sm font-black uppercase tracking-tighter flex items-center gap-2">
                <Activity className="h-5 w-5 text-rose-400" /> Mapa de Atraso (Concursos sem sair)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={atrasoData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="atraso" radius={[4, 4, 0, 0]}>
                    {atrasoData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.atraso > 3 ? '#f43f5e' : '#cbd5e1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100 flex gap-4 items-start">
          <Info className="h-6 w-6 text-indigo-600 shrink-0 mt-1" />
          <div>
            <h4 className="font-black text-indigo-900 uppercase italic text-xs mb-1">Dica do Especialista</h4>
            <p className="text-indigo-700 text-xs leading-relaxed font-medium">
              Números com atraso superior a 4 concursos têm alta probabilidade de aparecer no próximo sorteio. 
              Combine-os com as dezenas de maior frequência para um jogo equilibrado.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}