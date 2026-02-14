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
  KeyRound
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/components/auth-provider";

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
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
      });
    }
  }, [user, profile]);

  const handleUploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) return;

      const file = event.target.files[0];
      if (!user) return;

      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await refreshProfile();
      toast.success("Foto de perfil atualizada!");
    } catch (error: any) {
      toast.error("Erro no upload: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    try {
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;
      await refreshProfile();
      toast.success("Perfil atualizado com sucesso!");
    } catch (error) {
      toast.error("Erro ao atualizar perfil.");
    } finally {
      setUpdating(false);
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
        toast.info("Nenhuma alteração de segurança detectada.");
        setUpdating(false);
        return;
      }

      const { error } = await supabase.auth.updateUser(updates);
      if (error) throw error;

      toast.success("Dados de segurança atualizados!");
      setNewPassword("");
    } catch (error: any) {
      toast.error("Erro: " + error.message);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-white">
        <UserCircle className="h-12 w-12 animate-pulse text-indigo-200" />
        <p className="text-slate-900 font-black tracking-tighter text-xl italic uppercase">Carregando Identidade...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] md:pl-64 pb-32">
      <div className="p-5 md:p-10 max-w-4xl mx-auto space-y-8">
        <header className="space-y-1">
          <span className="text-[10px] font-black tracking-widest text-indigo-500 uppercase italic">Configurações de Conta</span>
          <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">
            Perfil do <span className="text-indigo-600">Especialista</span>
          </h1>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-6">
            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
              <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                <div className="relative group">
                  <Avatar className="h-32 w-32 border-4 border-slate-50 shadow-2xl overflow-hidden">
                    <AvatarImage 
                      src={profile?.avatar_url} 
                      className="object-cover object-center w-full h-full" 
                    />
                    <AvatarFallback className="bg-indigo-600 text-white text-3xl font-black">
                      {formData.first_name?.[0] || user?.email?.[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer text-white gap-1"
                  >
                    {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
                    <span className="text-[8px] font-black uppercase">Alterar</span>
                  </button>

                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleUploadAvatar} 
                    accept="image/*" 
                    className="hidden" 
                  />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 italic uppercase tracking-tighter">
                    {formData.first_name} {formData.last_name}
                  </h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{user?.email}</p>
                </div>
                <div className="pt-4 w-full">
                  <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100 flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-emerald-500" />
                    <span className="text-[9px] font-black text-emerald-700 uppercase italic">Conta Verificada</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
              <CardHeader className="bg-slate-900 text-white p-6">
                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <User className="h-4 w-4 text-indigo-400" /> Dados Pessoais
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nome</Label>
                      <Input 
                        value={formData.first_name} 
                        onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                        placeholder="Seu nome"
                        className="h-12 rounded-xl border-slate-100 bg-slate-50 focus-visible:ring-indigo-600 font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Sobrenome</Label>
                      <Input 
                        value={formData.last_name} 
                        onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                        placeholder="Seu sobrenome"
                        className="h-12 rounded-xl border-slate-100 bg-slate-50 focus-visible:ring-indigo-600 font-bold"
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    disabled={updating}
                    className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-black uppercase italic tracking-widest text-xs shadow-lg shadow-indigo-100"
                  >
                    {updating ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                    Salvar Alterações
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
              <CardHeader className="bg-slate-900 text-white p-6">
                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-rose-400" /> Segurança da Conta
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <form onSubmit={handleUpdateSecurity} className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">E-mail de Acesso</Label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input 
                        type="email"
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-12 pl-12 rounded-xl border-slate-100 bg-slate-50 focus-visible:ring-indigo-600 font-bold"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nova Senha (deixe em branco para manter)</Label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input 
                        type="password"
                        value={newPassword} 
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="h-12 pl-12 rounded-xl border-slate-100 bg-slate-50 focus-visible:ring-indigo-600 font-bold"
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    disabled={updating}
                    variant="outline"
                    className="w-full h-14 border-2 border-slate-100 rounded-xl font-black uppercase italic tracking-widest text-xs text-slate-600 hover:bg-slate-50"
                  >
                    {updating ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
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