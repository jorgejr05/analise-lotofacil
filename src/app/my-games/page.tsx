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
  Wallet,
  Trash2,
  Loader2,
  BrainCircuit,
  Layers,
  MousePointer2,
  AlertTriangle
} from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { calculatePoints } from "@/lib/lotofacil-utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function MyGamesPage() {
  const [jogos, setJogos] = useState<any[]>([]);
  const [concursos, setConcursos] = useState<any[]>([]);
  const [selectedConcurso, setSelectedConcurso] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isClearingAll, setIsClearingAll] = useState(false);

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

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeleteGame = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase.from('jogos').delete().eq('id', id);
      if (error) throw error;
      
      setJogos(prev => prev.filter(j => j.id !== id));
      toast.success("Jogo removido.");
    } catch (error: any) {
      toast.error("Erro ao deletar: " + error.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    setIsClearingAll(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('jogos').delete().eq('user_id', user.id);
      if (error) throw error;
      
      setJogos([]);
      toast.success("Todos os jogos foram removidos!");
    } catch (error: any) {
      toast.error("Erro ao limpar histórico: " + error.message);
    } finally {
      setIsClearingAll(false);
    }
  };

  const currentContestData = concursos.find(c => c.concurso.toString() === selectedConcurso);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-white dark:bg-slate-950">
        <History className="h-12 w-12 animate-pulse text-indigo-200 dark:text-indigo-900" />
        <p className="text-slate-900 dark:text-slate-100 font-black tracking-tighter text-xl italic uppercase">Acessando Arquivos...</p>
      </div>
    );
  }

  const getMethodBadge = (metodo: string) => {
    if (metodo === 'IA Preditiva') {
      return (
        <Badge variant="secondary" className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/30 font-black italic rounded-lg gap-1 px-3">
          <BrainCircuit className="h-3 w-3" /> IA Preditiva
        </Badge>
      );
    }
    if (metodo === 'Fechamento') {
      return (
        <Badge variant="secondary" className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30 font-black italic rounded-lg gap-1 px-3">
          <Layers className="h-3 w-3" /> Fechamento
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-slate-400 dark:text-slate-500 font-black italic rounded-lg gap-1 px-3">
        <MousePointer2 className="h-3 w-3" /> Manual
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 md:pl-64 pb-32 transition-colors">
      <div className="p-5 md:p-10 max-w-5xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1 w-full">
            <span className="text-[10px] font-black tracking-widest text-indigo-500 uppercase italic">Registro de Atividade</span>
            <div className="flex items-center justify-between gap-4 w-full">
              <h1 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tighter uppercase italic leading-none">
                Meus <span className="text-indigo-600">Jogos</span>
              </h1>
              
              <div className="flex items-center gap-2">
                {jogos.length > 0 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 shadow-sm border border-rose-100 dark:border-rose-900/30">
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl bg-white dark:bg-slate-900">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100 uppercase italic font-black text-sm">
                          <AlertTriangle className="h-5 w-5 text-rose-500" /> Limpeza Total
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase italic leading-relaxed">
                          Você está prestes a apagar todos os {jogos.length} jogos salvos. Esta ação é irreversível e afetará seu histórico de assertividade. Deseja continuar?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="mt-4 gap-2">
                        <AlertDialogCancel className="rounded-xl border-none bg-slate-100 dark:bg-slate-800 font-black uppercase italic text-[10px] h-11">Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearAll} className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black uppercase italic text-[10px] h-11 border-none shadow-lg shadow-rose-100 dark:shadow-none">
                          Sim, Limpar Tudo
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}

                <Link href="/bankroll">
                  <Button size="icon" variant="outline" className="rounded-full h-10 w-10 border-indigo-100 dark:border-indigo-900 bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm">
                    <Wallet className="h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-stretch md:items-end gap-4 w-full md:w-auto">
            <div className="w-full md:w-72 space-y-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">Conferir com Resultado:</label>
              <Select value={selectedConcurso} onValueChange={setSelectedConcurso}>
                <SelectTrigger className="h-12 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl font-bold text-slate-700 dark:text-slate-300 shadow-sm">
                  <SelectValue placeholder="Selecione o concurso" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-100 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900">
                  {concursos.map((c) => (
                    <SelectItem key={c.concurso} value={c.concurso.toString()} className="font-bold py-3">
                      Concurso {c.concurso} ({new Date(c.data).toLocaleDateString('pt-BR')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Link href="/bankroll" className="hidden md:block">
              <Button className="h-12 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl font-black uppercase italic tracking-widest text-[10px] px-6 shadow-lg shadow-slate-200 dark:shadow-none">
                <Wallet className="h-4 w-4 mr-2" /> Minha Banca
              </Button>
            </Link>
          </div>
        </header>

        {isClearingAll && (
          <div className="flex items-center justify-center py-10 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-rose-500" />
            <span className="text-[10px] font-black uppercase italic text-rose-500">Excluindo base de dados...</span>
          </div>
        )}

        {jogos.length === 0 && !isClearingAll ? (
          <div className="py-20 text-center flex flex-col items-center gap-3 bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-slate-200 dark:text-slate-700" />
            </div>
            <p className="text-slate-400 dark:text-slate-500 font-bold text-sm uppercase italic px-10">
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
                    "border-none shadow-xl overflow-hidden bg-white dark:bg-slate-900 group transition-all duration-500 hover:scale-[1.01] relative",
                    idx % 2 === 0 ? "rounded-tl-[3rem] rounded-br-[3rem]" : "rounded-tr-[3rem] rounded-bl-[3rem]"
                  )}
                >
                  <div className="flex flex-col md:flex-row">
                    <div className={cn(
                      "w-full md:w-28 p-6 flex md:flex-col items-center justify-center gap-4 text-white transition-colors duration-500",
                      isWinner ? "bg-emerald-500" : "bg-slate-900 dark:bg-slate-800"
                    )}>
                      <div className="text-center">
                        <div className="text-4xl font-black leading-none">{pontos}</div>
                        <div className="text-[10px] font-black uppercase tracking-tighter opacity-80">Acertos</div>
                      </div>
                      {isWinner && <Trophy className="h-6 w-6 animate-bounce" />}
                    </div>

                    <CardContent className="flex-1 p-8 space-y-6 relative">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          {getMethodBadge(jogo.metodo)}
                          <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-100 dark:border-slate-800 font-black italic rounded-lg">
                            {new Date(jogo.criado_em).toLocaleDateString('pt-BR')}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDeleteGame(jogo.id)}
                            disabled={deletingId === jogo.id}
                            className="h-8 w-8 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                          >
                            {deletingId === jogo.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
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
                                  : "bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-500"
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
}