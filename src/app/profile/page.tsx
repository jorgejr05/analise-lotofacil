"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  User, 
  Mail, 
  Lock, 
  Camera, 
  Save, 
  Loader2, 
  ShieldCheck,
  UserCircle,
  KeyRound,
  BrainCircuit,
  Eye,
  EyeOff,
  LogOut
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/components/auth-provider";
import { updateProfileSafe } from "@/lib/profile-actions";

export default function ProfilePage() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    gemini_api_key: "",
  });
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setEmail(user.email || "");
      setLoading(false);
    }
    if (profile) {
      setFormData({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        gemini_api_key: "••••••••••••••••", 
      });
    }
  }, [user, profile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    try {
      if (!user) return;
      const result = await updateProfileSafe(user.id, formData);
      if (!result.success) throw new Error(result.error);
      await refreshProfile();
      toast.success("Perfil atualizado!");
      setFormData(prev => ({ ...prev, gemini_api_key: "••••••••••••••••" }));
    } catch (error: any) {
      toast.error("Erro: " + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleUploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) return;
      const file = event.target.files[0];
      if (!user) return;
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      if (updateError) throw updateError;
      await refreshProfile();
      toast.success("Foto de perfil atualizada!");
    } catch (error: any) {
      toast.error("Erro no upload: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    try {
      const updates: any = {};
      if (email !== user?.email) updates.email = email;
      if (newPassword) updates.password = newPassword;
      if (Object.keys(updates).length === 0) {
        toast.info("Nenhuma alteração detectada.");
        setUpdating(false);
        return;
      }
      const { error } = await supabase.auth.updateUser(updates);
      if (error) throw error;
      toast.success("Segurança atualizada!");
      setNewPassword("");
    } catch (error: any) {
      toast.error("Erro: " + error.message);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] md:pl-64 pb-32">
      <div className="p-5 md:p-10 max-w-4xl mx-auto space-y-8">
        <header className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-black tracking-widest text-indigo-500 uppercase italic">Configurações</span>
            <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">
              Perfil
            </h1>
          </div>
          
          <Button 
            onClick={() => signOut()} 
            variant="ghost" 
            className="text-[10px] font-black uppercase italic tracking-widest text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl h-10 px-4 transition-colors"
          >
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-6">
            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
              <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                <div className="relative group">
                  <Avatar className="h-32 w-32 border-4 border-slate-50 shadow-2xl overflow-hidden">
                    <AvatarImage src={profile?.avatar_url} className="object-cover object-center w-full h-full" />
                    <AvatarFallback className="bg-indigo-600 text-white text-3xl font-black">
                      {formData.first_name?.[0] || user?.email?.[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer text-white gap-1">
                    {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
                    <span className="text-[8px] font-black uppercase">Alterar</span>
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleUploadAvatar} accept="image/*" className="hidden" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 italic uppercase tracking-tighter">{formData.first_name} {formData.last_name}</h2>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
              <CardHeader className="bg-slate-900 text-white p-6">
                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <User className="h-4 w-4 text-indigo-400" /> Dados & IA
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nome</Label>
                      <Input value={formData.first_name} onChange={(e) => setFormData({...formData, first_name: e.target.value})} className="h-12 rounded-xl border-slate-100 bg-slate-50 font-bold" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Sobrenome</Label>
                      <Input value={formData.last_name} onChange={(e) => setFormData({...formData, last_name: e.target.value})} className="h-12 rounded-xl border-slate-100 bg-slate-50 font-bold" />
                    </div>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-slate-50">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                      <BrainCircuit className="h-3 w-3" /> Google Gemini API Key
                    </Label>
                    <Input 
                      type="password" 
                      value={formData.gemini_api_key} 
                      onChange={(e) => setFormData({...formData, gemini_api_key: e.target.value})} 
                      onFocus={(e) => formData.gemini_api_key === "••••••••••••••••" && setFormData({...formData, gemini_api_key: ""})}
                      placeholder="Cole sua nova chave aqui" 
                      className="h-12 rounded-xl border-slate-100 bg-indigo-50/30 font-mono text-xs" 
                    />
                    <p className="text-[8px] font-bold text-slate-400 uppercase leading-relaxed">
                      Por segurança, a chave atual não é exibida. Para alterar, cole a nova chave acima.
                    </p>
                  </div>

                  <Button type="submit" disabled={updating} className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-black uppercase italic tracking-widest text-xs shadow-lg shadow-indigo-100">
                    {updating ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                    Salvar Alterações
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
              <CardHeader className="bg-slate-900 text-white p-6">
                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-rose-400" /> Segurança
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <form onSubmit={handleUpdateSecurity} className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">E-mail</Label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-xl border-slate-100 bg-slate-50 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nova Senha</Label>
                    <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" className="h-12 rounded-xl border-slate-100 bg-slate-50 font-bold" />
                  </div>
                  <Button type="submit" disabled={updating} variant="outline" className="w-full h-14 border-2 border-slate-100 rounded-xl font-black uppercase italic tracking-widest text-xs text-slate-600">
                    Atualizar Credenciais
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}