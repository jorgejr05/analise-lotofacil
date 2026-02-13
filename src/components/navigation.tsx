"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Dices, History, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Navigation = () => {
  const pathname = usePathname();

  const menuItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Gerador", href: "/generator", icon: Dices },
    { name: "Meus Jogos", href: "/my-games", icon: History },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t md:relative md:border-t-0 md:border-r md:w-64 md:min-h-screen p-4 z-50">
      <div className="hidden md:block mb-8 px-2">
        <h2 className="text-xl font-bold text-indigo-600 flex items-center gap-2">
          <BarChart3 className="h-6 w-6" /> LotoExpert
        </h2>
      </div>
      <ul className="flex md:flex-col justify-around md:justify-start gap-2">
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
    </nav>
  );
};