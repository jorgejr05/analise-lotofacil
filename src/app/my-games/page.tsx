"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, Trophy, Calendar, Hash, Sparkles } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

export default function MyGamesPage() {
  const [jogos, setJogos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJogos = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('jogos')
        .select('*, concursos(data, dezenas)')
        .order('criado_em', { ascending: false });

      if (!error) setJogos(data || []);
      setLoading(false);
    };

    fetchJogos();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-white">
        <History className="h-12 w-12 animate-pulse text-indigo-200" />
        <p className="text-slate-900 font-black tracking-tighter text-xl italic uppercase">Acessando Arquivos...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] md:pl-64 pb-32">
      <div className="p-5 md:p-10 max-w-5xl mx-auto space-y-8">
        <header className="space-y-1">
          <span className="text-[10px] font-black tracking-widest text-indigo-500 uppercase italic">Registro de Atividade</span>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">
            Meus <span className="text-indigo-600">Jogos</span>
          </h1>
        </header>

        {jogos.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center gap-3 bg-white rounded-[3rem] border border-slate-100 shadow-sm">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-slate-200" />
            </div>
            <p className="text-slate-400 font-bold text-sm uppercase italic px-10">
              Nenhum jogo registrado. Use o Motor Inteligente para gerar suas apostas.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {jogos.map((jogo, idx) => (
              <Card 
                key={jogo.id} 
                className={cn(
                  "border-none shadow-xl overflow-hidden bg-white group transition-all duration-500 hover:scale-[1.01]",
                  idx % 2 === 0 ? "rounded-tl-[3rem] rounded-br-[3rem]" : "rounded-tr-[3rem] rounded-bl-[3rem]"
                )}
              >
                <div className="flex flex-col md:flex-row">
                  {/* Status Sidebar */}
                  <div className={cn(
                    "w-full md:w-24 p-6 flex md:flex-col items-center justify-center gap-4 text-white",
                    jogo.pontos >= 11 ? "bg-emerald-500" : "bg-slate-900"
                  )}>
                    <div className="text-center">
                      <div className="text-3xl font-black leading-none">{jogo.pontos || 0}</div>
                      <div className="text-[10px] font-black uppercase tracking-tighter opacity-80">Pontos</div>
                    </div>
                    {jogo.pontos >= 11 && <Trophy className="h-6 w-6 animate-bounce" />}
                  </div>

                  {/* Content */}
                  <CardContent className="flex-1 p-8 space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="bg-indigo-50 text-indigo-600 border-indigo-100 font-black italic rounded-lg">
                          CONCURSO {jogo.concurso_referencia}
                        </Badge>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center">
                          <Calendar className="h-3 w-3 mr-1" /> {new Date(jogo.criado_em).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <div className="text-[10px] font-black uppercase text-slate-300 italic">
                        Ref: {jogo.id.slice(0, 8)}
                      </div>
                    </div>

                    <div className="grid grid-cols-5 gap-2 max-w-sm">
                      {jogo.dezenas.map((num: number) => (
                        <div 
                          key={num} 
                          className="aspect-square flex items-center justify-center bg-slate-50 border border-slate-100 text-slate-700 rounded-xl text-xs font-black shadow-inner group-hover:bg-indigo-50 group-hover:border-indigo-100 group-hover:text-indigo-600 transition-colors"
                        >
                          {num.toString().padStart(2, '0')}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}