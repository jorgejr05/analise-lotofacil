"use client";

import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, ShieldCheck } from "lucide-react";
import { MadeWithDyad } from "@/components/made-with-dyad";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 md:p-6 relative overflow-hidden">
      {/* Elementos Decorativos de Fundo */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-100/50 rounded-full blur-[120px] -z-10" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-100/50 rounded-full blur-[120px] -z-10" />

      <div className="w-full max-w-md space-y-6 md:space-y-8">
        <header className="text-center space-y-1 md:space-y-2">
          <div className="flex justify-center mb-4 md:mb-6">
            <div className="bg-indigo-600 p-3 md:p-4 rounded-tr-2xl md:rounded-tr-3xl rounded-bl-2xl md:rounded-bl-3xl shadow-2xl shadow-indigo-200 rotate-3 hover:rotate-0 transition-transform duration-500">
              <BarChart3 className="h-6 w-6 md:h-10 md:w-10 text-white" />
            </div>
          </div>
          <h1 className="text-2xl md:text-5xl font-black text-slate-900 tracking-tighter italic uppercase leading-none">
            LOTO<span className="text-indigo-600">EXPERT</span>
          </h1>
          <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] text-slate-400 italic">
            Inteligência Preditiva de Elite
          </p>
        </header>

        <Card className="border-none shadow-[0_32px_64px_-12px_rgba(0,0,0,0.1)] rounded-tl-[3rem] md:rounded-tl-[4rem] rounded-br-[3rem] md:rounded-br-[4rem] bg-white overflow-hidden relative">
          <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none hidden md:block">
            <ShieldCheck className="h-32 w-32 text-slate-900" />
          </div>
          
          <CardHeader className="pt-8 md:pt-10 pb-2 px-6 md:px-8">
            <CardTitle className="text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-500 italic flex items-center gap-2">
              <div className="w-6 md:w-8 h-[2px] bg-indigo-600" /> Acesso Seguro
            </CardTitle>
          </CardHeader>
          
          <CardContent className="p-6 md:p-8 pt-2">
            <Auth
              supabaseClient={supabase}
              appearance={{ 
                theme: ThemeSupa,
                variables: {
                  default: {
                    colors: {
                      brand: '#4f46e5',
                      brandAccent: '#4338ca',
                      inputBackground: '#F8FAFC',
                      inputText: '#0f172a',
                      inputBorder: '#e2e8f0',
                      inputBorderFocus: '#4f46e5',
                      inputBorderHover: '#cbd5e1',
                    },
                    fontSizes: {
                      baseBodySize: '12px',
                      baseInputSize: '14px',
                      baseLabelSize: '10px',
                      baseButtonSize: '11px',
                    },
                    radii: {
                      borderRadiusButton: '12px',
                      buttonBorderRadius: '12px',
                      inputBorderRadius: '12px',
                    }
                  }
                },
                className: {
                  button: 'font-black uppercase italic tracking-widest h-11 md:h-12 transition-all hover:scale-[1.01] active:scale-95 shadow-md md:shadow-lg shadow-indigo-100',
                  input: 'border-2 border-slate-100 focus:border-indigo-600 transition-colors h-11 md:h-12 font-medium text-sm',
                  label: 'font-black uppercase text-[8px] md:text-[9px] tracking-widest text-slate-400 mb-1.5 md:mb-2',
                  anchor: 'text-[10px] md:text-xs text-indigo-600 hover:text-indigo-700 font-bold',
                  message: 'text-[10px] md:text-xs text-rose-500 font-bold',
                }
              }}
              providers={[]}
              localization={{
                variables: {
                  sign_in: {
                    email_label: 'Identificação (E-mail)',
                    email_input_placeholder: 'exemplo@email.com',
                    password_label: 'Chave de Acesso',
                    password_input_placeholder: 'Sua senha secreta',
                    button_label: 'Autenticar Agora',
                    loading_button_label: 'Verificando...',
                    link_text: 'Novo por aqui? Criar conta',
                  },
                  sign_up: {
                    email_label: 'Novo E-mail',
                    email_input_placeholder: 'exemplo@email.com',
                    password_label: 'Definir Senha',
                    password_input_placeholder: 'Mínimo 6 caracteres',
                    button_label: 'Criar Conta de Especialista',
                    loading_button_label: 'Registrando...',
                    link_text: 'Já possui registro? Entre aqui',
                  },
                  forgotten_password: {
                    email_label: 'E-mail de Recuperação',
                    button_label: 'Resetar Chave',
                    link_text: 'Esqueceu sua senha?',
                  }
                }
              }}
            />
          </CardContent>
        </Card>

        <footer className="pt-2 opacity-40">
          <MadeWithDyad />
        </footer>
      </div>
    </div>
  );
}