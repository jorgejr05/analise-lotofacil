"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, Trophy, Calendar, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

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

  if (loading) return <div className="p-8 text-center">Carregando seu histórico...</div>;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Meus Jogos</h1>
        <p className="text-slate-500">Histórico de apostas geradas e desempenho</p>
      </header>

      {jogos.length === 0 ? (
        <Card className="border-none shadow-sm">
          <CardContent className="py-12 text-center text-slate-400">
            Você ainda não salvou nenhum jogo. Vá ao Gerador para começar!
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {jogos.map((jogo) => (
            <Card key={jogo.id} className="border-none shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="bg-indigo-50 text-indigo-600 border-indigo-100">
                        <Hash className="h-3 w-3 mr-1" /> Concurso {jogo.concurso_referencia}
                      </Badge>
                      <span className="text-xs text-slate-400 flex items-center">
                        <Calendar className="h-3 w-3 mr-1" /> {new Date(jogo.criado_em).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {jogo.dezenas.map((num: number) => (
                        <span key={num} className="w-7 h-7 flex items-center justify-center bg-slate-100 text-slate-700 rounded-full text-xs font-bold">
                          {num.toString().padStart(2, '0')}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-slate-400 uppercase font-semibold">Pontuação</p>
                      <div className="flex items-center gap-2">
                        <Trophy className={cn("h-5 w-5", jogo.pontos >= 11 ? "text-yellow-500" : "text-slate-300")} />
                        <span className="text-2xl font-bold text-slate-700">{jogo.pontos || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}