"use client";

import { useState } from "react";
import { useLotofacilStats } from "@/hooks/use-lotofacil-stats";
import { generateProbabilisticGames } from "@/lib/generator-service";
import { generateGameInsight } from "@/lib/gemini";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dices, Sparkles, Save, Loader2, BrainCircuit } from "lucide-react";
import { toast } from "sonner";

export default function GeneratorPage() {
  const { stats, loading } = useLotofacilStats();
  const [generatedGames, setGeneratedGames] = useState<number[][]>([]);
  const [insight, setInsight] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleGenerate = async () => {
    if (!stats) return;
    setIsGenerating(true);
    setInsight("");
    
    try {
      const games = generateProbabilisticGames(stats, 3);
      setGeneratedGames(games);
      
      const aiInsight = await generateGameInsight(stats, games);
      setInsight(aiInsight);
      toast.success("Jogos gerados com sucesso!");
    } catch (error) {
      toast.error("Erro ao gerar jogos");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveGames = async () => {
    if (generatedGames.length === 0) return;
    setIsSaving(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado para salvar jogos");
        return;
      }

      const gamesToSave = generatedGames.map(dezenas => ({
        user_id: user.id,
        dezenas,
        concurso_referencia: stats.ultimoConcurso.concurso
      }));

      const { error } = await supabase.from('jogos').insert(gamesToSave);
      if (error) throw error;

      toast.success("Jogos salvos no seu histórico!");
      setGeneratedGames([]);
      setInsight("");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar jogos");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Carregando motor estatístico...</div>;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Gerador Inteligente</h1>
        <p className="text-slate-500">Algoritmo probabilístico + Insight de IA</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Dices className="h-5 w-5 text-indigo-600" /> Jogos Sugeridos
              </CardTitle>
              <Button 
                onClick={handleGenerate} 
                disabled={isGenerating}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {isGenerating ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Gerar 3 Jogos
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {generatedGames.length === 0 ? (
                <div className="py-12 text-center text-slate-400 border-2 border-dashed rounded-xl">
                  Clique em gerar para criar novos jogos baseados em estatísticas.
                </div>
              ) : (
                generatedGames.map((game, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex flex-wrap gap-2">
                      {game.map(num => (
                        <span key={num} className="w-8 h-8 flex items-center justify-center bg-white border border-indigo-200 text-indigo-700 rounded-full text-sm font-bold shadow-sm">
                          {num.toString().padStart(2, '0')}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}

              {generatedGames.length > 0 && (
                <Button 
                  onClick={handleSaveGames} 
                  disabled={isSaving}
                  variant="outline" 
                  className="w-full mt-4 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                >
                  {isSaving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                  Salvar Jogos no Histórico
                </Button>
              )}
            </CardContent>
          </Card>

          {insight && (
            <Card className="border-none shadow-md bg-indigo-900 text-white">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BrainCircuit className="h-5 w-5 text-indigo-300" /> Análise do Especialista (IA)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-indigo-100 leading-relaxed whitespace-pre-wrap">
                  {insight}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">Filtros Aplicados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Pares / Ímpares</span>
                <span className="text-sm font-bold text-indigo-600">7-9 / 6-8</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Soma Total</span>
                <span className="text-sm font-bold text-indigo-600">160 - 220</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Repetidas Anterior</span>
                <span className="text-sm font-bold text-indigo-600">8 - 10</span>
              </div>
              <div className="pt-4 border-t">
                <p className="text-xs text-slate-400 italic">
                  Os jogos são gerados priorizando dezenas com maior score de frequência e menor atraso, respeitando os padrões matemáticos mais comuns da Lotofácil.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}