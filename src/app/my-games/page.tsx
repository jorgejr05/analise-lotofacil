"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  History, 
  Trophy, 
  Calendar, 
  Sparkles, 
  Search,
  CheckCircle2,
  Wallet
} from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { calculatePoints } from "@/lib/lotofacil-service";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function MyGamesPage() {
  const [jogos, setJogos] = useState<any[]>([]);
  const [concursos, setConcursos] = useState<any[]>([]);
  const [selectedConcurso, setSelectedConcurso] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: gamesData } = await supabase
        .from('jogos')
        .select('*')
        .order('criado_em', { ascending: false });

      const { data: contestsData } = await supabase
        .from('concursos')
        .select('concurso, dezenas, data')
        .order('concurso', { ascending: false })
        .limit(20);

      if (gamesData) setJogos(gamesData);
      if (contestsData) {
        setConcursos(contestsData);
        setSelectedConcurso(contestsData[0]?.concurso.toString());
      }
      
      setLoading(false);
    };

    fetchData();
  }, []);

  const currentContestData = concursos.find(c => c.concurso.toString() === selectedConcurso);

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
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1 w-full">
            <span className="text-[10px] font-black tracking-widest text-indigo-500 uppercase italic">Registro de Atividade</span>
            <div className="flex items-center justify-between gap-4 w-full">
              <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">
                Meus <span className="text-indigo-600">Jogos</span>
              </h1>
              <Link href="/bankroll" className="md:hidden">
                <Button size="icon" variant="outline" className="rounded-full h-10 w-10 border-indigo-100 bg-white text-indigo-600 shadow-sm">
                  <Wallet className="h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-stretch md:items-end gap-4 w-full md:w-auto">
            <div className="w-full md:w-72 space-y-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Conferir com Resultado:</label>
              <Select value={selectedConcurso} onValueChange={setSelectedConcurso}>
                <SelectTrigger className="h-12 bg-white border-2 border-slate-100 rounded-xl font-bold text-slate-700 shadow-sm">
                  <SelectValue placeholder="Selecione o concurso" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-100 shadow-2xl">
                  {concursos.map((c) => (
                    <SelectItem key={c.concurso} value={c.concurso.toString()} className="font-bold py-3">
                      Concurso {c.concurso} ({new Date(c.data).toLocaleDateString('pt-BR')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Link href="/bankroll" className="hidden md:block">
              <Button className="h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black uppercase italic tracking-widest text-[10px] px-6 shadow-lg shadow-slate-200">
                <Wallet className="h-4 w-4 mr-2" /> Minha Banca
              </Button>
            </Link>
          </div>
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
            {jogos.map((jogo, idx) => {
              const pontos = currentContestData 
                ? calculatePoints(jogo.dezenas, currentContestData.dezenas)
                : 0;
              
              const isWinner = pontos >= 11;

              return (
                <Card 
                  key={jogo.id} 
                  className={cn(
                    "border-none shadow-xl overflow-hidden bg-white group transition-all duration-500 hover:scale-[1.01]",
                    idx % 2 === 0 ? "rounded-tl-[3rem] rounded-br-[3rem]" : "rounded-tr-[3rem] rounded-bl-[3rem]"
                  )}
                >
                  <div className="flex flex-col md:flex-row">
                    <div className={cn(
                      "w-full md:w-28 p-6 flex md:flex-col items-center justify-center gap-4 text-white transition-colors duration-500",
                      isWinner ? "bg-emerald-500" : "bg-slate-900"
                    )}>
                      <div className="text-center">
                        <div className="text-4xl font-black leading-none">{pontos}</div>
                        <div className="text-[10px] font-black uppercase tracking-tighter opacity-80">Acertos</div>
                      </div>
                      {isWinner && <Trophy className="h-6 w-6 animate-bounce" />}
                    </div>

                    <CardContent className="flex-1 p-8 space-y-6">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="bg-indigo-50 text-indigo-600 border-indigo-100 font-black italic rounded-lg">
                            CRIADO EM {new Date(jogo.criado_em).toLocaleDateString('pt-BR')}
                          </Badge>
                          {currentContestData && (
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center">
                              <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" /> 
                              Comparando com #{currentContestData.concurso}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-black uppercase text-slate-300 italic">
                          ID: {jogo.id.slice(0, 8)}
                        </div>
                      </div>

                      <div className="grid grid-cols-5 md:grid-cols-8 lg:grid-cols-15 gap-2">
                        {jogo.dezenas.map((num: number) => {
                          const isHit = currentContestData?.dezenas.includes(num);
                          return (
                            <div 
                              key={num} 
                              className={cn(
                                "aspect-square flex items-center justify-center rounded-xl text-xs font-black shadow-inner transition-all duration-300",
                                isHit 
                                  ? "bg-emerald-500 text-white border-emerald-400 scale-110 shadow-emerald-100" 
                                  : "bg-slate-50 border border-slate-100 text-slate-400"
                              )}
                            >
                              {num.toString().padStart(2, '0')}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );