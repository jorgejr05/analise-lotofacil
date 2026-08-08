"use client";

import { useState, useRef } from "react";
import { syncHistoricalBatch, SyncProgressPayload } from "@/lib/lotofacil-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Database, 
  Download, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle,
  Hash,
  ChevronRight,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function ImportacaoHistoricaPanel() {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<SyncProgressPayload | null>(null);
  const [startNum, setStartNum] = useState("1");
  const [endNum, setEndNum] = useState("3500");
  const [log, setLog] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string) => {
    setLog(prev => {
      const next = [...prev, msg];
      // Mantém só os últimos 50 logs para não travar o DOM
      return next.slice(-50);
    });
    // Scroll automático para o final
    setTimeout(() => {
      if (logRef.current) {
        logRef.current.scrollTop = logRef.current.scrollHeight;
      }
    }, 50);
  };

  const handleImport = async () => {
    const start = parseInt(startNum, 10);
    const end = parseInt(endNum, 10);

    if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
      toast.error("Intervalo de concursos inválido.");
      return;
    }
    if (end - start > 4000) {
      toast.error("Limite máximo: 4.000 concursos por importação.");
      return;
    }

    setIsImporting(true);
    setProgress(null);
    setLog([]);
    addLog(`🚀 Iniciando importação de #${start} até #${end}...`);

    try {
      await syncHistoricalBatch(
        start,
        end,
        10, // lotes de 10 em paralelo
        (payload: SyncProgressPayload) => {
          setProgress(payload);
          if (payload.done) {
            addLog(payload.mensagem);
          } else if (payload.importados % 50 === 0 || payload.erros > 0) {
            // Log a cada 50 concursos ou quando houver erro
            addLog(payload.mensagem);
          }
        }
      );
      toast.success("Importação concluída com sucesso!");
    } catch (err: any) {
      toast.error("Erro durante a importação: " + err.message);
      addLog(`❌ Erro fatal: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const pct = progress?.percentual ?? 0;
  const isDone = progress?.done && !isImporting;
  const hasError = (progress?.erros ?? 0) > 0;

  return (
    <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white dark:bg-slate-900 overflow-hidden">
      <CardHeader className="bg-slate-900 dark:bg-slate-800 text-white p-6">
        <CardTitle className="flex items-center gap-3 text-sm font-black uppercase tracking-tighter">
          <Database className="h-5 w-5 text-indigo-400" />
          Importação Histórica em Massa
        </CardTitle>
        <p className="text-[10px] font-bold text-slate-400 mt-1">
          Popula o banco com todos os concursos via API Guidi. Necessário para o motor funcionar.
        </p>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Aviso explicativo */}
        <div className="flex gap-3 p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/20">
          <Info className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-black text-indigo-900 dark:text-indigo-300 uppercase mb-1">
              Como funciona
            </p>
            <p className="text-[11px] text-indigo-700 dark:text-indigo-400 leading-relaxed">
              Importa os concursos em lotes de 10 em paralelo com retry automático.
              O banco já detecta o que existe e pula, então é seguro rodar múltiplas vezes.
              A Lotofácil teve seu primeiro sorteio no concurso <strong>#1</strong> (2003).
              O concurso mais recente é próximo de <strong>#3.500</strong>.
            </p>
          </div>
        </div>

        {/* Inputs de intervalo */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Concurso Inicial
            </label>
            <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
              <Hash className="h-4 w-4 text-slate-400" />
              <input
                type="number"
                value={startNum}
                onChange={e => setStartNum(e.target.value)}
                disabled={isImporting}
                min="1"
                className="w-full bg-transparent text-sm font-black text-slate-900 dark:text-slate-100 outline-none"
                placeholder="1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Concurso Final
            </label>
            <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
              <Hash className="h-4 w-4 text-slate-400" />
              <input
                type="number"
                value={endNum}
                onChange={e => setEndNum(e.target.value)}
                disabled={isImporting}
                min="1"
                className="w-full bg-transparent text-sm font-black text-slate-900 dark:text-slate-100 outline-none"
                placeholder="3500"
              />
            </div>
          </div>
        </div>

        {/* Barra de progresso */}
        {(isImporting || progress) && (
          <div className="space-y-3 animate-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">
                {isDone ? "Concluído" : `Processando: ${progress?.percentual ?? 0}%`}
              </span>
              <span className={cn(
                "text-[10px] font-black uppercase",
                isDone ? "text-emerald-600 dark:text-emerald-400" : "text-indigo-600 dark:text-indigo-400"
              )}>
                {progress?.importados ?? 0} importados · {progress?.erros ?? 0} erros
              </span>
            </div>
            <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  isDone && !hasError
                    ? "bg-emerald-500"
                    : hasError
                    ? "bg-amber-500"
                    : "bg-indigo-600"
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            {progress?.mensagem && (
              <p className={cn(
                "text-[10px] font-bold",
                isDone && !hasError
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-slate-500 dark:text-slate-400"
              )}>
                {progress.mensagem}
              </p>
            )}
          </div>
        )}

        {/* Status Final */}
        {isDone && (
          <div className={cn(
            "flex items-center gap-3 p-4 rounded-2xl border",
            hasError
              ? "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800"
              : "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/20"
          )}>
            {hasError
              ? <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              : <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            }
            <div>
              <p className={cn(
                "text-[10px] font-black uppercase",
                hasError ? "text-amber-800 dark:text-amber-300" : "text-emerald-800 dark:text-emerald-300"
              )}>
                {hasError ? "Concluído com advertências" : "Base histórica atualizada!"}
              </p>
              <p className={cn(
                "text-[11px] font-medium",
                hasError ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"
              )}>
                {progress?.importados} concursos salvos · {progress?.erros} falhas
                {hasError && " — Execute novamente para tentar os que falharam."}
              </p>
            </div>
          </div>
        )}

        {/* Log em tempo real */}
        {log.length > 0 && (
          <div
            ref={logRef}
            className="h-36 overflow-y-auto bg-slate-950 dark:bg-black rounded-2xl p-4 space-y-1 font-mono"
          >
            {log.map((line, i) => (
              <div key={i} className="flex items-start gap-2">
                <ChevronRight className="h-3 w-3 text-indigo-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-300">{line}</p>
              </div>
            ))}
            {isImporting && (
              <div className="flex items-center gap-2 text-indigo-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                <p className="text-[10px]">Aguardando próximo lote...</p>
              </div>
            )}
          </div>
        )}

        {/* Botão de ação */}
        <Button
          onClick={handleImport}
          disabled={isImporting}
          className={cn(
            "w-full h-14 rounded-xl font-black uppercase italic text-xs tracking-widest transition-all shadow-lg",
            isDone
              ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20"
              : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-900/20"
          )}
        >
          {isImporting ? (
            <>
              <Loader2 className="animate-spin mr-2 h-4 w-4" />
              Importando — Não feche a aba...
            </>
          ) : isDone ? (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Reimportar / Atualizar
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Iniciar Importação Histórica
            </>
          )}
        </Button>

        <p className="text-center text-[9px] text-slate-400 dark:text-slate-600 font-bold uppercase">
          ⚠️ Mantenha a aba aberta durante a importação · Lotes de 10 · Retry automático
        </p>
      </CardContent>
    </Card>
  );
}
