"use server";

import { supabase } from "@/integrations/supabase/client";

export const getBankrollStats = async (userId: string) => {
  // Ensure user has bankroll settings
  let { data: settings } = await supabase
    .from('user_bankroll_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (!settings) {
    const { data: newSettings } = await supabase
      .from('user_bankroll_settings')
      .insert({ user_id: userId, bankroll_inicial: 1000, bankroll_atual: 1000 })
      .select()
      .single();
    settings = newSettings;
  }

  const { data: history } = await supabase
    .from('bankroll_history')
    .select('*')
    .eq('user_id', userId)
    .order('data_aposta', { ascending: true });

  if (!history || history.length === 0) {
    return {
      totalApostado: 0,
      totalPremiado: 0,
      roiGeral: 0,
      maxDrawdown: 0,
      totalConcursos: 0,
      history: [],
      currentBankroll: Number(settings?.bankroll_atual || 1000),
      initialBankroll: Number(settings?.bankroll_inicial || 1000)
    };
  }

  const totalApostado = history.reduce((acc, curr) => acc + Number(curr.valor_apostado), 0);
  const totalPremiado = history.reduce((acc, curr) => acc + Number(curr.valor_premiado), 0);
  const roiGeral = totalApostado > 0 ? ((totalPremiado - totalApostado) / totalApostado) * 100 : 0;

  // Max Drawdown Calculation
  let peak = Number(settings?.bankroll_inicial || 1000);
  let current = peak;
  let maxDD = 0;

  history.forEach(h => {
    current += Number(h.lucro_prejuizo);
    if (current > peak) peak = current;
    const dd = peak - current;
    if (dd > maxDD) maxDD = dd;
  });

  return {
    totalApostado,
    totalPremiado,
    roiGeral,
    maxDrawdown: maxDD,
    totalConcursos: history.length,
    history,
    currentBankroll: Number(settings?.bankroll_atual || 1000),
    initialBankroll: Number(settings?.bankroll_inicial || 1000)
  };
};

export const updateBankrollSettings = async (userId: string, initialAmount: number) => {
  const { data: history } = await supabase
    .from('bankroll_history')
    .select('lucro_prejuizo')
    .eq('user_id', userId);
  
  const totalProfitLoss = history?.reduce((acc, curr) => acc + Number(curr.lucro_prejuizo), 0) || 0;
  const newCurrentBalance = initialAmount + totalProfitLoss;

  const { error } = await supabase
    .from('user_bankroll_settings')
    .update({ 
      bankroll_inicial: initialAmount,
      bankroll_atual: newCurrentBalance,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  return { error };
};

export const registerBet = async (userId: string, concursoId: number, valorApostado: number, isSimulado: boolean = true) => {
  const { data: settings } = await supabase
    .from('user_bankroll_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  const bankrollAntes = Number(settings?.bankroll_atual || 1000);

  const { error } = await supabase.from('bankroll_history').insert({
    user_id: userId,
    concurso_id: concursoId,
    valor_apostado: valorApostado,
    valor_premiado: 0,
    bankroll_snapshot: bankrollAntes,
    is_simulado: isSimulado
  });

  // Always update current bankroll for real or simulated if you want it tracked
  if (!error) {
    await supabase
      .from('user_bankroll_settings')
      .update({ bankroll_atual: bankrollAntes - valorApostado })
      .eq('user_id', userId);
  }
  
  return { error };
};