import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/navigation";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/auth-provider";
import { StatsProvider } from "@/components/stats-provider";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LotoExpert - Inteligência em Lotofácil",
  description: "Análise estatística e geração de jogos com IA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-50 dark:bg-slate-950 transition-colors duration-300`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <StatsProvider>
              <div className="flex flex-col md:flex-row min-h-screen">
                <Navigation />
                <main className="flex-1 pb-20 md:pb-0 overflow-y-auto">
                  {children}
                </main>
              </div>
              <Toaster position="top-right" />
            </StatsProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}