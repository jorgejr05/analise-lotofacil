"use client";

import { useState, useCallback, useEffect } from "react";
import { useLotofacilStats } from "@/hooks/use-lotofacil-stats";
import { generateAdvancedGames } from "@/lib/generator-service";
import { generateClosingGames } from "@/lib/closing-service";
import { generateGameInsight, suggestPoolViaIA } from "@/lib/gemini";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dices, Sparkles, Save, Loader2, BrainCircuit, Rocket, Plus, Minus, MessageSquare, Cpu, Target, Layers, Wand2, Info, Wallet, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ChatInterface } from "@/components/chat-interface";
import { registerBet } from "@/lib/finance-service";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth-provider";

export default function GeneratorPage() {
  const { user } = useAuth();
  const { stats, loading } = useLotofacilStats();
  const [generatedGames, setGeneratedGames] = useState<number[][]>([]);
  const [insight, setInsight] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [quantity, setQuantity] = useState(6);
  const [mode, setMode] = useState<'ia' | 'fechamento'>('ia');
  const [selectedPool, setSelectedPool] = useState<number[]>([]);
  const [isRealBet, setIsRealBet] = useState(false);

  const lastContestNum = stats?.ultimoConcurso?.concurso || 0;
  const nextContestNum = lastContestNum + 1;

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
    if (!stats || !user) return;
    setIsSuggesting(true);
    try {
      const suggestion = await suggestPoolViaIA(stats, user.id);
      if (suggestion) {
        setSelectedPool(suggestion.sort((a: number, b: number) => a - b));
        toast.success("IA selecionou as 20 dezenas com maior potencial!");
      } else {
        toast.error("IA ocupada ou chave inválida. Tente novamente.");
      }
    } catch (error) {
      toast.error("Erro ao consultar a IA.");
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleGenerate = useCallback(async (qtyOverride?: number) => {
    if (!stats || !user) return;
    const finalQty = qtyOverride || quantity;
    setIsGenerating(true);
    setInsight("");
    
    try {
      let games: number[][] = [];
      
      if (mode === 'ia') {
        games = await generateAdvancedGames(finalQty);
      } else {
        if (selectedPool.length < 16) {
          toast.error("Para fechamento, selecione pelo menos 16 dezenas.");
          setIsGenerating(false);
          return;
        }
        games = await generateClosingGames(selectedPool, finalQty);
      }

      setGeneratedGames(games);
      const aiInsight = await generateGameInsight(stats, games, mode, user.id);
      setInsight(aiInsight);
      toast.success(`${finalQty} jogos gerados para o concurso #${nextContestNum}!`);
    } catch (error) {
      toast.error("Falha ao simular jogos");
    } finally {
      setIsGenerating(false);
    }
  }, [stats, quantity, mode, selectedPool, user, nextContestNum]);

  const handleSaveGames = async () => {
    if (generatedGames.length === 0 || !user || !lastContestNum) {
      toast.error("Estatísticas não carregadas ou nenhum jogo gerado.");
      return;
    }
    
    setIsSaving(true);
    try {
      const valorTotal = generatedGames.length * 3.5;
      const generationMethod = mode === 'ia' ? 'IA Preditiva' : 'Fechamento';
      
      const gamesToSave = generatedGames.map(dezenas => ({
        user_id: user.id,
        dezenas,
        concurso_referencia: lastContestNum,
        metodo: generationMethod
      }));

      const { error: insertError } = await supabase.from('jogos').insert(gamesToSave);
      if (insertError) throw insertError;

      const financeResult = await registerBet(user.id, lastContestNum, valorTotal, !isRealBet);
      if (!financeResult.success) throw new Error(financeResult.error);

      toast.success(isRealBet ? "Aposta REAL registrada!" : "Simulação registrada com sucesso!");
      setGeneratedGames([]);
    } catch (error: any) {
      console.error("Erro ao salvar jogos:", error);
      toast.error("Erro técnico: " + (error.message || "Verifique se a coluna 'metodo' foi adicionada no banco."));
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 md:pl-64 pb-32 transition-colors">
      <div className="p-5 md:p-10 max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-black tracking-widest text-indigo-500 uppercase italic">Alvo: Concurso #{nextContestNum}</span>
            <h1 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tighter uppercase italic leading-none">
              Motor de <span className="text-indigo-600">Alta Precisão</span>
            </h1>
          </div>
          
          <div className="flex bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <button 
              onClick={() => setMode('ia')}
              className={cn("px-6 py-2 rounded-xl text-[10px] font-black uppercase italic transition-all", mode === 'ia' ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300")}
            >
              Modo IA Preditiva
            </button>
            <button 
              onClick={() => setMode('fechamento')}
              className={cn("px-6 py-2 rounded-xl text-[10px] font-black uppercase italic transition-all", mode === 'fechamento' ? "bg-emerald-600 text-white shadow-lg" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300")}
            >
              Modo Fechamento
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            {mode === 'fechamento' && (
              <Card className="border-none shadow-xl rounded-[2rem] bg-white dark:bg-slate-900 overflow-hidden animate-in slide-in-from-top-4 duration-500">
                <CardHeader className="bg-emerald-50 dark:bg-emerald-900/10 p-6 border-b border-emerald-100 dark:border-emerald-900/20 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                      <Target className="h-4 w-4" /> Seletor de Grupo (Pool)
                    </CardTitle>
                    <p className="text-[9px] font-bold text-emerald-600/70 dark:text-emerald-500/70 uppercase">Escolha as dezenas para o concurso #{nextContestNum}</p>
                  </div>
                  <Button 
                    onClick={handleIASuggestion} 
                    disabled={isSuggesting}
                    variant="outline" 
                    className="border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl h-10 text-[9px] font-black uppercase italic"
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
                            : "bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-emerald-200 dark:hover:border-emerald-800"
                        )}
                      >
                        {num.toString().padStart(2, '0')}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 italic">Selecionadas: {selectedPool.length}</span>
                    <Button variant="ghost" onClick={() => setSelectedPool([])} className="text-[9px] font-black uppercase text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20">Limpar Tudo</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-none shadow-2xl rounded-[2rem] bg-white dark:bg-slate-900 overflow-hidden">
              <CardHeader className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-50 dark:border-slate-800 p-6 gap-4">
                <CardTitle className="text-sm font-black uppercase tracking-tighter flex items-center gap-2 text-slate-900 dark:text-slate-100">
                  <Layers className="h-5 w-5 text-indigo-600" /> Configuração de Jogos
                </CardTitle>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center bg-slate-50 dark:bg-slate-800 rounded-2xl p-1 border border-slate-100 dark:border-slate-700">
                    <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600"><Minus className="h-4 w-4" /></button>
                    <span className="w-10 text-center font-black italic text-slate-900 dark:text-slate-100">{quantity}</span>
                    <button onClick={() => setQuantity(q => q + 1)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600"><Plus className="h-4 w-4" /></button>
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
                    <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                      <Cpu className="h-8 w-8 text-slate-200 dark:text-slate-700" />
                    </div>
                    <p className="text-slate-400 dark:text-slate-500 font-bold text-[10px] uppercase italic tracking-widest">Aguardando comando para o concurso #{nextContestNum}...</p>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {generatedGames.map((game, idx) => (
                        <div key={idx} className="p-5 bg-slate-50/50 dark:bg-slate-800/50 rounded-[1.5rem] border border-slate-100/50 dark:border-slate-700/50 relative group">
                          <div className="absolute -top-2 -left-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-2 py-1 rounded-lg text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase shadow-sm">Jogo {idx + 1} (Alvo #{nextContestNum})</div>
                          <div className="grid grid-cols-5 gap-2 mt-2">
                            {game.map(num => (
                              <span key={num} className="aspect-square flex items-center justify-center bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-xl text-xs font-black shadow-sm group-hover:scale-110 transition-transform">
                                {num.toString().padStart(2, '0')}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="p-6 bg-slate-900 dark:bg-slate-950 rounded-[2rem] border border-slate-800 dark:border-slate-900 space-y-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Wallet className="h-4 w-4 text-indigo-400" />
                          <span className="text-[10px] font-black text-white uppercase italic">Investimento Total:</span>
                        </div>
                        <span className="text-sm font-black text-indigo-400">R$ {(generatedGames.length * 3.5).toFixed(2).replace('.', ',')}</span>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-slate-800/50 dark:bg-slate-900/50 rounded-2xl border border-slate-700 dark:border-slate-800">
                        <div className="flex flex-col">
                          <Label htmlFor="real-bet" className="text-[10px] font-black text-white uppercase italic">Modo de Registro</Label>
                          <span className="text-[8px] font-bold text-slate-400 uppercase">{isRealBet ? "Aposta Real (Desconta da Banca)" : "Simulação (Apenas ROI)"}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={cn("text-[8px] font-black uppercase", !isRealBet ? "text-indigo-400" : "text-slate-500")}>Simulado</span>
                          <Switch 
                            id="real-bet" 
                            checked={isRealBet} 
                            onCheckedChange={setIsRealBet}
                            className="data-[state=checked]:bg-emerald-500"
                          />
                          <span className={cn("text-[8px] font-black uppercase", isRealBet ? "text-emerald-400" : "text-slate-500")}>Real</span>
                        </div>
                      </div>

                      <Button 
                        onClick={handleSaveGames} 
                        disabled={isSaving} 
                        className={cn(
                          "w-full h-14 rounded-xl font-black uppercase italic text-xs tracking-widest transition-all",
                          isRealBet 
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/20" 
                            : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-900/20"
                        )}
                      >
                        {isSaving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                        {isRealBet ? "Confirmar Aposta Real" : "Registrar Simulação"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {insight && (
              <Card className="border-none shadow-2xl rounded-[2rem] bg-indigo-950 dark:bg-indigo-950/50 text-white overflow-hidden animate-in zoom-in duration-500">
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