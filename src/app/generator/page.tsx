"use client";

import { useState, useCallback, useEffect } from "react";
import { useLotofacilStats } from "@/hooks/use-lotofacil-stats";
import { generateAdvancedGames } from "@/lib/generator-service";
import { generateClosingGames } from "@/lib/closing-service";
import { generateGameInsight, suggestPoolViaIA } from "@/lib/gemini";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dices, Sparkles, Save, Loader2, BrainCircuit, Rocket, Plus, Minus, MessageSquare, Cpu, Target, Layers, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ChatInterface } from "@/components/chat-interface";

export default function GeneratorPage() {
  const { stats, loading } = useLotofacilStats();
  const [generatedGames, setGeneratedGames] = useState<number[][]>([]);
  const [insight, setInsight] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [quantity, setQuantity] = useState(6);
  const [mode, setMode] = useState<'ia' | 'fechamento'>('ia');
  const [selectedPool, setSelectedPool] = useState<number[]>([]);

  useEffect(() => {
    if (stats && selectedPool.length === 0) {
      const top20 = Object.entries(stats.freqTotal)
        .sort(([, a]: any, [, b]: any) => b - a)
        .slice(0, 20)
        .map(([num]) => Number(num))
        .sort((a, b) => a - b);
      setSelectedPool(top20);
    }
  }, [stats]);

  const toggleNumber = (num: number) => {
    setSelectedPool(prev => 
      prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]
    );
  };

  const handleIASuggestion = async () => {
    if (!stats) return;
    setIsSuggesting(true);
    try {
      const suggestion = await suggestPoolViaIA(stats);
      if (suggestion) {
        setSelectedPool(suggestion.sort((a: number, b: number) => a - b));
        toast.success("IA selecionou as 20 dezenas com maior potencial!");
      } else {
        toast.error("IA ocupada. Tente novamente em instantes.");
      }
    } catch (error) {
      toast.error("Erro ao consultar a IA.");
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleGenerate = useCallback(async (qtyOverride?: number) => {
    if (!stats) return;
    const finalQty = qtyOverride || quantity;
    setIsGenerating(true);
    setInsight("");
    
    try {
      let games: number[][] = [];
      
      if (mode === 'ia') {
        games = await generateAdvancedGames(finalQty);
      } else {
        if (selectedPool.length < 15) {
          toast.error("Selecione pelo menos 15 dezenas para o fechamento.");
          setIsGenerating(false);
          return;
        }
        games = await generateClosingGames(selectedPool, finalQty);
      }

      setGeneratedGames(games);
      const aiInsight = await generateGameInsight(stats, games, mode);
      setInsight(aiInsight);
      toast.success(`${finalQty} jogos gerados com sucesso!`);
    } catch (error) {
      toast.error("Falha ao simular jogos");
    } finally {
      setIsGenerating(false);
    }
  }, [stats, quantity, mode, selectedPool]);

  const handleSaveGames = async () => {
    if (generatedGames.length === 0) return;
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const gamesToSave = generatedGames.map(dezenas => ({
        user_id: user.id,
        dezenas,
        concurso_referencia: stats.ultimoConcurso.concurso
      }));
      await supabase.from('jogos').insert(gamesToSave);
      toast.success("Jogos salvos no histórico!");
      setGeneratedGames([]);
    } catch (error) {
      toast.error("Erro ao salvar");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] md:pl-64 pb-32">
      <div className="p-5 md:p-10 max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-black tracking-widest text-indigo-500 uppercase italic">Caçada ao Prêmio Máximo</span>
            <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">
              Motor de <span className="text-indigo-600">Alta Precisão</span>
            </h1>
          </div>
          
          <div className="flex bg-white p-1 rounded-2xl border border-slate-100 shadow-sm">
            <button 
              onClick={() => setMode('ia')}
              className={cn("px-6 py-2 rounded-xl text-[10px] font-black uppercase italic transition-all", mode === 'ia' ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-600")}
            >
              Modo IA Preditiva
            </button>
            <button 
              onClick={() => setMode('fechamento')}
              className={cn("px-6 py-2 rounded-xl text-[10px] font-black uppercase italic transition-all", mode === 'fechamento' ? "bg-emerald-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-600")}
            >
              Modo Fechamento
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            {mode === 'fechamento' && (
              <Card className="border-none shadow-xl rounded-[2rem] bg-white overflow-hidden animate-in slide-in-from-top-4 duration-500">
                <CardHeader className="bg-emerald-50 p-6 border-b border-emerald-100 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-emerald-700 flex items-center gap-2">
                      <Target className="h-4 w-4" /> Seletor de Grupo (Pool)
                    </CardTitle>
                    <p className="text-[9px] font-bold text-emerald-600/70 uppercase">Selecione de 18 a 22 dezenas para cercar o prêmio</p>
                  </div>
                  <Button 
                    onClick={handleIASuggestion} 
                    disabled={isSuggesting}
                    variant="outline" 
                    className="border-emerald-200 bg-white text-emerald-600 hover:bg-emerald-50 rounded-xl h-10 text-[9px] font-black uppercase italic"
                  >
                    {isSuggesting ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Wand2 className="h-3 w-3 mr-2" />}
                    Sugestão da IA
                  </Button>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-5 gap-2">
                    {Array.from({ length: 25 }, (_, i) => i + 1).map(num => (
                      <button
                        key={num}
                        onClick={() => toggleNumber(num)}
                        className={cn(
                          "aspect-square rounded-xl text-sm font-black transition-all border-2",
                          selectedPool.includes(num) 
                            ? "bg-emerald-600 border-emerald-500 text-white shadow-lg scale-105" 
                            : "bg-slate-50 border-slate-100 text-slate-400 hover:border-emerald-200"
                        )}
                      >
                        {num.toString().padStart(2, '0')}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-slate-400 italic">Selecionadas: {selectedPool.length}</span>
                    <Button variant="ghost" onClick={() => setSelectedPool([])} className="text-[9px] font-black uppercase text-rose-500">Limpar Tudo</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-none shadow-2xl rounded-[2rem] bg-white overflow-hidden">
              <CardHeader className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-50 p-6 gap-4">
                <CardTitle className="text-sm font-black uppercase tracking-tighter flex items-center gap-2">
                  <Layers className="h-5 w-5 text-indigo-600" /> Configuração de Jogos
                </CardTitle>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center bg-slate-50 rounded-2xl p-1 border border-slate-100">
                    <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="p-2 text-slate-400 hover:text-indigo-600"><Minus className="h-4 w-4" /></button>
                    <span className="w-10 text-center font-black italic">{quantity}</span>
                    <button onClick={() => setQuantity(q => q + 1)} className="p-2 text-slate-400 hover:text-indigo-600"><Plus className="h-4 w-4" /></button>
                  </div>

                  <Button onClick={() => handleGenerate()} disabled={isGenerating} className={cn("rounded-tr-2xl rounded-bl-2xl px-8 h-12 shadow-lg font-black uppercase italic text-[10px] tracking-widest", mode === 'ia' ? "bg-indigo-600 hover:bg-indigo-700" : "bg-emerald-600 hover:bg-emerald-700")}>
                    {isGenerating ? <Loader2 className="animate-spin h-4 w-4" /> : <Rocket className="mr-2 h-4 w-4" />}
                    {mode === 'ia' ? 'Gerar com IA' : 'Gerar Fechamento'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {generatedGames.length === 0 ? (
                  <div className="py-20 text-center flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center">
                      <Cpu className="h-8 w-8 text-slate-200" />
                    </div>
                    <p className="text-slate-400 font-bold text-[10px] uppercase italic tracking-widest">Aguardando comando de processamento...</p>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {generatedGames.map((game, idx) => (
                        <div key={idx} className="p-5 bg-slate-50/50 rounded-[1.5rem] border border-slate-100/50 relative group">
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
                      Salvar Jogos no Histórico
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {insight && (
              <Card className="border-none shadow-2xl rounded-[2rem] bg-indigo-950 text-white overflow-hidden animate-in zoom-in duration-500">
                <CardHeader className="bg-indigo-900/50 p-6">
                  <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2 text-indigo-300">
                    <BrainCircuit className="h-4 w-4" /> Análise de Convergência
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                  <p className="text-indigo-100 text-sm leading-relaxed font-medium italic">{insight}</p>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="lg:col-span-5">
            <ChatInterface stats={stats} onGenerateRequest={handleGenerate} />
          </div>
        </div>
      </div>
    </div>
  );
}