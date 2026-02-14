"use client";

import { useState, useCallback } from "react";
import { useLotofacilStats } from "@/hooks/use-lotofacil-stats";
import { generateProbabilisticGames } from "@/lib/generator-service";
import { generateGameInsight } from "@/lib/gemini";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dices, Sparkles, Save, Loader2, BrainCircuit, Rocket, Plus, Minus, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ChatInterface } from "@/components/chat-interface";

export default function GeneratorPage() {
  const { stats, loading } = useLotofacilStats();
  const [generatedGames, setGeneratedGames] = useState<number[][]>([]);
  const [insight, setInsight] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const handleGenerate = useCallback(async (qtyOverride?: number) => {
    if (!stats) return;
    const finalQty = qtyOverride || quantity;
    setIsGenerating(true);
    setInsight("");
    
    try {
      const games = generateProbabilisticGames(stats, finalQty);
      setGeneratedGames(games);
      
      const aiInsight = await generateGameInsight(stats, games);
      setInsight(aiInsight);
      toast.success(`${finalQty} ${finalQty === 1 ? 'jogo gerado' : 'jogos gerados'} com sucesso!`);
    } catch (error) {
      toast.error("Falha ao gerar jogos");
    } finally {
      setIsGenerating(false);
    }
  }, [stats, quantity]);

  const handleSaveGames = async () => {
    if (generatedGames.length === 0) return;
    setIsSaving(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Acesse sua conta para salvar");
        return;
      }

      const gamesToSave = generatedGames.map(dezenas => ({
        user_id: user.id,
        dezenas,
        concurso_referencia: stats.ultimoConcurso.concurso
      }));

      const { error } = await supabase.from('jogos').insert(gamesToSave);
      if (error) throw error;

      toast.success("Jogos salvos no histórico!");
      setGeneratedGames([]);
      setInsight("");
    } catch (error) {
      toast.error("Erro ao salvar jogos");
    } finally {
      setIsSaving(false);
    }
  };

  const increment = () => setQuantity(prev => Math.min(prev + 1, 10));
  const decrement = () => setQuantity(prev => Math.max(prev - 1, 1));

  if (loading) return null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] md:pl-64 pb-32">
      <div className="p-5 md:p-10 max-w-7xl mx-auto space-y-8">
        <header className="space-y-1">
          <span className="text-[10px] font-black tracking-widest text-indigo-500 uppercase italic">Algoritmo Ativo</span>
          <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">
            Motor <span className="text-indigo-600">Inteligente</span>
          </h1>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            <Card className="border-none shadow-2xl rounded-[2rem] bg-white overflow-hidden">
              <CardHeader className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-50 p-6 gap-4">
                <CardTitle className="text-sm font-black uppercase tracking-tighter flex items-center gap-2">
                  <Dices className="h-5 w-5 text-indigo-600" /> Configuração
                </CardTitle>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center bg-slate-50 rounded-2xl p-1 border border-slate-100">
                    <button onClick={decrement} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-slate-400 hover:text-indigo-600">
                      <Minus className="h-4 w-4" />
                    </button>
                    <div className="w-12 text-center">
                      <span className="text-lg font-black text-slate-900 italic">{quantity}</span>
                    </div>
                    <button onClick={increment} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-slate-400 hover:text-indigo-600">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <Button onClick={() => handleGenerate()} disabled={isGenerating} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-tr-2xl rounded-bl-2xl px-6 h-12 shadow-lg shadow-indigo-100 font-black uppercase italic text-[10px] tracking-widest">
                    {isGenerating ? <Loader2 className="animate-spin h-4 w-4" /> : <Rocket className="mr-2 h-4 w-4" />}
                    Gerar {quantity > 1 ? `${quantity} Jogos` : 'Jogo'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {generatedGames.length === 0 ? (
                  <div className="py-20 text-center flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center">
                      <Sparkles className="h-8 w-8 text-slate-200" />
                    </div>
                    <p className="text-slate-400 font-bold text-sm uppercase italic">Aguardando comando...</p>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {generatedGames.map((game, idx) => (
                        <div key={idx} className="p-5 bg-slate-50/50 rounded-[1.5rem] border border-slate-100/50 relative overflow-hidden group">
                          <div className="absolute top-0 right-0 p-2 opacity-5 text-[8px] font-black uppercase">Probabilidade: 84%</div>
                          <div className="grid grid-cols-5 gap-2">
                            {game.map(num => (
                              <span key={num} className="aspect-square flex items-center justify-center bg-white border border-indigo-100 text-indigo-700 rounded-xl text-xs font-black shadow-sm group-hover:scale-110 transition-transform">
                                {num.toString().padStart(2, '0')}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button onClick={handleSaveGames} disabled={isSaving} variant="outline" className="w-full mt-4 h-14 border-2 border-indigo-100 rounded-tl-2xl rounded-br-2xl text-indigo-600 font-black uppercase italic text-xs tracking-widest hover:bg-indigo-50">
                      {isSaving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                      Fixar {generatedGames.length} {generatedGames.length === 1 ? 'Jogo' : 'Jogos'} no Histórico
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {insight && (
              <div className="animate-in fade-in zoom-in duration-700">
                <Card className="border-none shadow-2xl rounded-[2rem] bg-indigo-950 text-white overflow-hidden">
                  <CardHeader className="bg-indigo-900/50 p-6">
                    <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2 text-indigo-300">
                      <BrainCircuit className="h-4 w-4" /> Análise por IA
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8">
                    <p className="text-indigo-100 text-sm leading-relaxed font-medium italic">{insight}</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center gap-2 px-2">
              <MessageSquare className="h-4 w-4 text-indigo-600" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Consultoria em Tempo Real</span>
            </div>
            <ChatInterface stats={stats} onGenerateRequest={handleGenerate} />
          </div>
        </div>
      </div>
    </div>
  );
}