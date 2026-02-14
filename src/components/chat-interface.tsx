"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Mic, Square, Loader2, Bot, Check, CheckCheck } from "lucide-react";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { processChatInteraction, transcribeAudio } from "@/lib/gemini-chat";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { toast } from "sonner";

interface ChatInterfaceProps {
  stats: any;
  onGenerateRequest?: (quantity: number) => void;
}

type ChatStatus = "lendo" | "analisando" | "digitando" | null;

export const ChatInterface = ({ stats, onGenerateRequest }: ChatInterfaceProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [userGames, setUserGames] = useState<any[]>([]);
  const [backtests, setBacktests] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<ChatStatus>(null);
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      const [gamesRes, backtestsRes] = await Promise.all([
        supabase.from('jogos').select('*').order('criado_em', { ascending: false }).limit(20),
        supabase.from('backtests').select('*').order('created_at', { ascending: false }).limit(5)
      ]);
      if (gamesRes.data) setUserGames(gamesRes.data);
      if (backtestsRes.data) setBacktests(backtestsRes.data);
    };
    fetchData();
  }, [user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, status]);

  const sendMessage = async (content: string, type: 'text' | 'audio' = 'text') => {
    if (!content.trim() || !user) return;

    const newMessage = { 
      user_id: user.id, 
      role: 'user', 
      content, 
      type, 
      created_at: new Date().toISOString() 
    };
    
    setMessages(prev => [...prev, newMessage]);
    setInput("");

    // Sequência de Status Estilo WhatsApp
    setStatus("lendo");
    
    setTimeout(async () => {
      setStatus("analisando");
      
      try {
        // Inicia a chamada da IA
        const responsePromise = processChatInteraction(
          [...messages, newMessage], 
          stats, 
          userGames, 
          backtests,
          user.id
        );

        // Após um tempo analisando, muda para digitando
        setTimeout(() => setStatus("digitando"), 1500);

        const response = await responsePromise;
        
        const genMatch = response.match(/\[GENERATE:(\d+)\]/);
        let cleanResponse = response.replace(/\[GENERATE:\d+\]/g, "").trim();

        if (genMatch && onGenerateRequest) {
          const qty = parseInt(genMatch[1]);
          onGenerateRequest(qty);
          cleanResponse += `\n\n*Comando executado: Gerando ${qty} jogos agora...*`;
        }

        const assistantMessage = {
          user_id: user.id,
          role: 'assistant',
          content: cleanResponse,
          type: 'text',
          created_at: new Date().toISOString()
        };
        
        setMessages(prev => [...prev, assistantMessage]);
      } catch (error) {
        console.error(error);
        toast.error("Erro ao processar resposta da IA.");
      } finally {
        setStatus(null);
      }
    }, 1000);
  };

  const handleAudio = async () => {
    if (!user) return;
    
    if (isRecording) {
      setStatus("lendo");
      try {
        const base64 = await stopRecording();
        if (base64) {
          const transcription = await transcribeAudio(base64, user.id);
          if (transcription && transcription !== "Não consegui entender o áudio.") {
            sendMessage(transcription, 'audio');
          } else {
            setStatus(null);
            toast.error("Não foi possível transcrever o áudio.");
          }
        }
      } catch (error) {
        setStatus(null);
        toast.error("Erro ao processar áudio.");
      }
    } else {
      startRecording();
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-[#E5DDD5] dark:bg-slate-950 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors relative">
      {/* Wallpaper Pattern Overlay (Simulado) */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] dark:invert" />

      {/* Header WhatsApp Style */}
      <div className="bg-[#075E54] dark:bg-slate-900 p-4 flex items-center gap-3 z-10 shadow-md">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
            <Bot className="text-white h-6 w-6" />
          </div>
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#075E54] dark:border-slate-900 rounded-full" />
        </div>
        <div>
          <h3 className="text-white font-black text-sm uppercase italic tracking-widest">LotoExpert AI</h3>
          <p className="text-[9px] text-emerald-100/70 font-bold uppercase tracking-tighter">
            {status === "lendo" && "Lendo sua mensagem..."}
            {status === "analisando" && "Analisando laboratório..."}
            {status === "digitando" && "Digitando..."}
            {!status && "Online agora"}
          </p>
        </div>
      </div>

      {/* Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 z-10 scrollbar-hide">
        {messages.length === 0 && (
          <div className="flex justify-center my-10">
            <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 px-6 py-3 rounded-2xl text-[10px] font-bold uppercase text-center border border-amber-200 dark:border-amber-800/50 shadow-sm max-w-[80%]">
              🔒 As mensagens são processadas com criptografia de ponta a ponta pela sua chave API privada.
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div 
            key={i} 
            className={cn(
              "flex flex-col max-w-[85%] animate-in fade-in slide-in-from-bottom-2 duration-300", 
              msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
            )}
          >
            <div className={cn(
              "p-3 rounded-2xl text-xs font-medium shadow-sm relative min-w-[80px]", 
              msg.role === 'user' 
                ? "bg-[#DCF8C6] dark:bg-indigo-600 text-slate-800 dark:text-white rounded-tr-none" 
                : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-100 dark:border-slate-700"
            )}>
              <div className="whitespace-pre-wrap pb-4">{msg.content}</div>
              
              <div className="absolute bottom-1 right-2 flex items-center gap-1">
                <span className="text-[8px] font-bold opacity-50">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.role === 'user' && (
                  <CheckCheck className="h-3 w-3 text-sky-500" />
                )}
              </div>
            </div>
          </div>
        ))}

        {status && (
          <div className="flex flex-col items-start max-w-[85%] animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-tl-none shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
              </div>
              <span className="text-[9px] font-black uppercase text-slate-400 italic">
                {status === "lendo" && "Lendo..."}
                {status === "analisando" && "Analisando..."}
                {status === "digitando" && "Digitando..."}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input Area WhatsApp Style */}
      <div className="p-3 bg-[#F0F0F0] dark:bg-slate-900 flex items-center gap-2 z-10">
        <div className="flex-1 flex items-center bg-white dark:bg-slate-800 rounded-full px-4 py-1 shadow-sm border border-slate-200 dark:border-slate-700">
          <Input 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)} 
            placeholder={isRecording ? "Gravando áudio..." : "Mensagem"} 
            disabled={isRecording || !!status}
            className="border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400" 
          />
          <button 
            onClick={handleAudio} 
            className={cn(
              "p-2 rounded-full transition-all", 
              isRecording ? "text-rose-500 animate-pulse" : "text-slate-400 hover:text-indigo-600"
            )}
          >
            {isRecording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
        </div>
        
        <Button 
          onClick={() => sendMessage(input)} 
          disabled={!input.trim() || isRecording || !!status} 
          className="rounded-full h-12 w-12 bg-[#128C7E] hover:bg-[#075E54] dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white shadow-md shrink-0 p-0"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};