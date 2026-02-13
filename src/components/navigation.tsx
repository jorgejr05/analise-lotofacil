"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Dices, History, BarChart3, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "./auth-provider";

export const Navigation = () => {
  const pathname = usePathname();
  const { signOut, user } = useAuth();

  if (pathname === "/login") return null;

  const menuItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Gerador", href: "/generator", icon: Dices },
    { name: "Meus Jogos", href: "/my-games", icon: History },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t md:relative md:border-t-0 md:border-r md:w-64 md:min-h-screen p-4 z-50 flex flex-col">
      <div className="hidden md:block mb-8 px-2">
        <h2 className="text-xl font-bold text-indigo-600 flex items-center gap-2">
          <BarChart3 className="h-6 w-6" /> LotoExpert
        </h2>
        {user && (
          <p className="text-[10px] text-slate-400 truncate mt-1">{user.email}</p>
        )}
      </div>
      
      <ul className="flex md:flex-col justify-around md:justify-start gap-2 flex-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <li key={item.href} className="flex-1 md:flex-none">
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col md:flex-row items-center gap-3 px-4 py-3 rounded-xl transition-all",
                  isActive 
                    ? "bg-indigo-50 text-indigo-600 font-semibold" 
                    : "text-slate-500 hover:bg-slate-50"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs md:text-sm">{item.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="hidden md:block pt-4 border-t">
        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 px-4 py-3 w-full text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-sm font-medium">Sair</span>
        </button>
      </div>
    </nav>
  );
};