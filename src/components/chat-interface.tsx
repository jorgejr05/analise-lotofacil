"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Mic, Square, Loader2, Bot } from "lucide-react";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { processChatInteraction, transcribeAudio } from "@/lib/gemini-chat";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";

interface ChatInterfaceProps {
  stats: any;
  onGenerateRequest?: (quantity: number) => void;
}

export const ChatInterface = ({ stats, onGenerateRequest }: ChatInterfaceProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [userGames, setUserGames] = useState<any[]>([]);
  const [backtests, setBacktests] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const scrollRef = useRef<HTMLDivElement>(null);
  const batchTimer = useRef<NodeJS.Timeout | null>(null);

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
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async (content: string, type: 'text' | 'audio' = 'text') => {
    if (!content.trim() || !user) return;

    const newMessage = { user_id: user.id, role: 'user', content, type, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, newMessage]);
    setInput("");

    if (batchTimer.current) clearTimeout(batchTimer.current);
    
    batchTimer.current = setTimeout(async () => {
      setIsTyping(true);
      try {
        const response = await processChatInteraction(
          [...messages, newMessage], 
          stats, 
          userGames, 
          backtests,
          user.id
        );
        
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
      } finally {
        setIsTyping(false);
      }
    }, 2000);
  };

  const handleAudio = async () => {
    if (!user) return;
    if (isRecording) {
      const base64 = await stopRecording();
      setIsTyping(true);
      const transcription = await transcribeAudio(base64, user.id);
      setIsTyping(false);
      sendMessage(transcription, 'audio');
    } else {
      startRecording();
    }
  };

  return (
    <div className="flex flex-col h-[500px] bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors">
      <div className="bg-slate-900 dark:bg-slate-950 p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center">
          <Bot className="text-white h-6 w-6" />
        </div>
        <div>
          <h3 className="text-white font-black text-xs uppercase italic tracking-widest">Agente Estrategista</h3>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase">Consultoria Ativa</span>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50 dark:bg-slate-950/50">
        {messages.length === 0 && (
          <div className="text-center py-10 space-y-2">
            <p className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase italic">Consultoria Estratégica</p>
            <p className="text-slate-300 dark:text-slate-600 text-[9px] font-medium px-10">Fale comigo por áudio ou texto. Eu sei tudo o que aconteceu no laboratório e nos seus jogos!</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex flex-col max-w-[85%]", msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start")}>
            <div className={cn("p-4 rounded-2xl text-xs font-medium shadow-sm whitespace-pre-wrap", 
              msg.role === 'user' ? "bg-indigo-600 text-white rounded-tr-none" : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-tl-none")}>
              {msg.content}
            </div>
            <span className="text-[8px] font-black text-slate-300 dark:text-slate-600 uppercase mt-1 px-1">
              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        {isTyping && (
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="text-[9px] font-black uppercase italic">Analisando dados do laboratório...</span>
          </div>
        )}
      </div>

      <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-50 dark:border-slate-800 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={handleAudio} className={cn("rounded-full h-12 w-12 shrink-0 transition-all", isRecording ? "bg-rose-500 text-white animate-pulse" : "bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400")}>
          {isRecording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>
        <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)} placeholder="Ex: Baseado no laboratório, qual a melhor estratégia?" className="h-12 rounded-2xl border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus-visible:ring-indigo-600 dark:focus-visible:ring-indigo-400 font-medium text-xs text-slate-900 dark:text-slate-100" />
        <Button onClick={() => sendMessage(input)} disabled={!input.trim()} className="rounded-full h-12 w-12 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20 shrink-0">
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};