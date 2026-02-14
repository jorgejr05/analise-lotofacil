"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Send, 
  Mic, 
  Square, 
  Loader2, 
  Bot, 
  CheckCheck, 
  Trash2, 
  Maximize2, 
  Minimize2, 
  Play, 
  X,
  Clock
} from "lucide-react";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { processChatInteraction, transcribeAudio } from "@/lib/gemini-chat";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { toast } from "sonner";

interface ChatInterfaceProps {
  stats: any;
  onGenerateRequest?: (quantity: number) => void;
}

type ChatStatus = "lendo" | "analisando" | "digitando" | "transcrevendo" | null;

export const ChatInterface = ({ stats, onGenerateRequest }: ChatInterfaceProps) => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [userGames, setUserGames] = useState<any[]>([]);
  const [backtests, setBacktests] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<ChatStatus>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [pendingAudio, setPendingAudio] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const userName = profile?.first_name || "Você";

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      const [messagesRes, gamesRes, backtestsRes] = await Promise.all([
        supabase.from('chat_messages').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
        supabase.from('jogos').select('*').order('criado_em', { ascending: false }).limit(20),
        supabase.from('backtests').select('*').order('created_at', { ascending: false }).limit(5)
      ]);
      if (messagesRes.data) setMessages(messagesRes.data);
      if (gamesRes.data) setUserGames(gamesRes.data);
      if (backtestsRes.data) setBacktests(backtestsRes.data);
    };
    fetchData();
  }, [user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status, isExpanded]);

  // Timer de Gravação
  useEffect(() => {
    if (isRecording) {
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const cleanMarkdown = (text: string) => text.replace(/[*#_~`]/g, '').trim();

  const handleClearChat = async () => {
    if (!user) return;
    try {
      await supabase.from('chat_messages').delete().eq('user_id', user.id);
      setMessages([]);
      toast.success("Conversa limpa.");
    } catch (error) {
      toast.error("Erro ao limpar.");
    }
  };

  const sendMessage = async (content: string, type: 'text' | 'audio' = 'text') => {
    if (!content.trim() || !user) return;

    const userMessage = { user_id: user.id, role: 'user', content, type, created_at: new Date().toISOString() };
    await supabase.from('chat_messages').insert(userMessage);
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setPendingAudio(null);
    setStatus("lendo");
    
    try {
      const response = await processChatInteraction([...messages, userMessage], stats, userGames, backtests, user.id);
      
      const genMatch = response.match(/\[GENERATE:(\d+)\]/);
      let cleanResponse = cleanMarkdown(response.replace(/\[GENERATE:\d+\]/g, ""));

      if (genMatch && onGenerateRequest) {
        onGenerateRequest(parseInt(genMatch[1]));
      }

      const assistantMessage = { user_id: user.id, role: 'assistant', content: cleanResponse, type: 'text', created_at: new Date().toISOString() };
      await supabase.from('chat_messages').insert(assistantMessage);
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      toast.error("Erro na IA.");
    } finally {
      setStatus(null);
    }
  };

  const handleStartRecording = () => {
    if (!user || status) return;
    setPendingAudio(null);
    startRecording();
  };

  const handleStopRecording = async () => {
    const base64 = await stopRecording();
    if (base64) {
      setPendingAudio(base64);
    }
  };

  const handleSendPendingAudio = async () => {
    if (!pendingAudio || !user) return;
    setStatus("transcrevendo");
    const trans = await transcribeAudio(pendingAudio, user.id);
    if (trans.trim()) {
      sendMessage(trans, 'audio');
    } else {
      toast.info("Não consegui entender o áudio. Tente falar mais claro.");
      setPendingAudio(null);
      setStatus(null);
    }
  };

  return (
    <div className={cn(
      "flex flex-col bg-[#E5DDD5] dark:bg-slate-950 shadow-2xl transition-all duration-300 relative",
      isExpanded 
        ? "fixed inset-0 z-[100] h-screen w-screen" 
        : "h-[650px] rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden"
    )}>
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] dark:invert" />

      {/* Header */}
      <div className="bg-[#075E54] dark:bg-slate-900 p-4 flex items-center justify-between z-10 shadow-md">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
              <Bot className="text-white h-6 w-6" />
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#075E54] dark:border-slate-900 rounded-full" />
          </div>
          <div>
            <h3 className="text-white font-black text-xs uppercase italic tracking-widest">IA LotoExpert</h3>
            <p className="text-[9px] text-emerald-100/70 font-bold uppercase">{status || "Online"}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 text-white/50 hover:text-white transition-colors">
            {isExpanded ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>
          <button onClick={handleClearChat} className="p-2 text-white/50 hover:text-rose-400 transition-colors">
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 z-10 scrollbar-hide">
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex flex-col max-w-[90%]", msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start")}>
            <span className={cn("text-[9px] font-black uppercase italic mb-1 px-2 tracking-widest", msg.role === 'user' ? "text-slate-500" : "text-indigo-600 dark:text-indigo-400")}>
              {msg.role === 'user' ? userName : "IA LotoExpert"}
            </span>
            <div className={cn("p-4 rounded-2xl text-xs font-medium shadow-sm relative", msg.role === 'user' ? "bg-[#DCF8C6] dark:bg-indigo-600 text-slate-800 dark:text-white rounded-tr-none" : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none")}>
              <div className="whitespace-pre-wrap pb-4 leading-relaxed">{msg.content}</div>
              <div className="absolute bottom-1.5 right-2.5 flex items-center gap-1 opacity-40">
                <span className="text-[8px] font-bold">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                {msg.role === 'user' && <CheckCheck className="h-3 w-3 text-sky-500" />}
              </div>
            </div>
          </div>
        ))}
        {status === "transcrevendo" && (
          <div className="flex flex-col mr-auto items-start max-w-[90%]">
            <span className="text-[9px] font-black uppercase italic mb-1 px-2 tracking-widest text-indigo-600 dark:text-indigo-400">IA LotoExpert</span>
            <div className="p-4 rounded-2xl text-xs font-medium shadow-sm bg-white dark:bg-slate-800 text-slate-400 italic flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Transcrevendo áudio...
            </div>
          </div>
        )}
      </div>

      {/* Input / Recording Bar */}
      <div className="p-3 bg-[#F0F0F0] dark:bg-slate-900 flex items-center gap-2 z-10 border-t dark:border-slate-800">
        <div className="flex-1 h-12 flex items-center bg-white dark:bg-slate-800 rounded-full px-4 shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          
          {isRecording ? (
            <div className="flex-1 flex items-center justify-between px-2 animate-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse" />
                <span className="text-sm font-black italic text-slate-600 dark:text-slate-300">{formatTime(recordingTime)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-slate-400 animate-pulse">Gravando áudio...</span>
                <button onClick={handleStopRecording} className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-full transition-colors">
                  <Square className="h-5 w-5 fill-current" />
                </button>
              </div>
            </div>
          ) : pendingAudio ? (
            <div className="flex-1 flex items-center justify-between px-2 animate-in zoom-in duration-300">
              <button onClick={() => setPendingAudio(null)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
                <Trash2 className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-700 px-4 py-1.5 rounded-full">
                <Play className="h-4 w-4 text-indigo-500 fill-current" />
                <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-300">Áudio Gravado</span>
              </div>
              <button onClick={handleSendPendingAudio} disabled={!!status} className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-full transition-colors">
                <Send className="h-5 w-5 fill-current" />
              </button>
            </div>
          ) : (
            <>
              <Input 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)} 
                placeholder="Diga algo..." 
                disabled={!!status}
                className="border-none bg-transparent focus-visible:ring-0 h-10 text-sm" 
              />
              <button 
                onClick={handleStartRecording} 
                disabled={!!status}
                className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
              >
                <Mic className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        {!isRecording && !pendingAudio && (
          <Button 
            onClick={() => sendMessage(input)} 
            disabled={!input.trim() || !!status} 
            className="rounded-full h-12 w-12 bg-[#128C7E] p-0 hover:bg-[#075E54] transition-colors"
          >
            <Send className="h-5 w-5 text-white" />
          </Button>
        )}
      </div>
    </div>
  );
};