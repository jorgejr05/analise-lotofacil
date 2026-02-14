"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Dices, History, BarChart3, LogOut, LineChart, List, Beaker, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "./auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

export const Navigation = () => {
  const pathname = usePathname();
  const { signOut, user, profile } = useAuth();

  if (pathname === "/login") return null;

  const menuItems = [
    { name: "Painel", href: "/", icon: LayoutDashboard },
    { name: "Gerador", href: "/generator", icon: Dices },
    { name: "Estatísticas", href: "/statistics", icon: LineChart },
    { name: "Resultados", href: "/results", icon: List },
    { name: "Meus Jogos", href: "/my-games", icon: History },
    { name: "Laboratório", href: "/lab", icon: Beaker },
    { name: "Perfil", href: "/profile", icon: UserCircle },
  ];

  return (
    <>
      <nav className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-64 bg-white border-r z-50">
        <div className="p-6 pb-4 flex flex-col gap-4">
          <h2 className="text-2xl font-black text-indigo-600 flex items-center gap-2 tracking-tighter">
            <BarChart3 className="h-7 w-7" /> LOTOEXPERT
          </h2>
          
          {user && (
            <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-2xl border border-slate-100">
              <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                <AvatarImage src={profile?.avatar_url} className="object-cover object-center" />
                <AvatarFallback className="bg-indigo-600 text-white text-xs font-black">
                  {profile?.first_name?.[0] || user.email?.[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <p className="text-xs font-black text-slate-900 truncate uppercase italic">
                  {profile?.first_name ? `${profile.first_name}` : 'Especialista'}
                </p>
                <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">Online</span>
              </div>
            </div>
          )}
        </div>
        
        <ScrollArea className="flex-1 px-4">
          <ul className="space-y-2 py-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-5 py-4 transition-all duration-300",
                      isActive 
                        ? "bg-indigo-600 text-white rounded-tr-3xl rounded-bl-3xl shadow-lg shadow-indigo-100 font-bold translate-x-1" 
                        : "text-slate-500 hover:bg-slate-50 rounded-xl"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-sm">{item.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </ScrollArea>

        <div className="p-6 pt-4 border-t border-slate-100 mt-auto">
          <button
            onClick={() => signOut()}
            className="flex items-center gap-3 px-5 py-4 w-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all duration-300 group"
          >
            <LogOut className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-bold uppercase tracking-wider">Sair</span>
          </button>
        </div>
      </nav>

      <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-50">
        <nav className="bg-white/80 backdrop-blur-xl border border-white/40 shadow-lg rounded-[2.5rem] p-2 flex justify-around items-center">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center justify-center p-3 transition-all duration-300 relative",
                  isActive ? "text-indigo-600" : "text-slate-400"
                )}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-indigo-50/50 rounded-2xl -z-10 animate-in fade-in zoom-in duration-300" />
                )}
                <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5px]")} />
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
};