"use server";

import { supabase } from "@/integrations/supabase/client";

export const getBankrollStats = async (userId: string) => {
  // Busca as configurações de banca do usuário
  let { data: settings } = await supabase
    .from('user_bankroll_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  // Se não existir, criamos o registro inicial
  if (!settings) {
    const { data: newSettings, error: insertError } = await supabase
      .from('user_bankroll_settings')
      .insert({ 
        user_id: userId, 
        bankroll_inicial: 1000, 
        bankroll_atual: 1000 
      })
      .select()
      .single();
    
    if (insertError) console.error("[Finance] Erro ao criar banca inicial:", insertError);
    settings = newSettings;
  }

  const { data: history } = await supabase
    .from('bankroll_history')
    .select('*')
    .eq('user_id', userId)
    .order('data_aposta', { ascending: true });

  const historyList = history || [];
  const totalApostado = historyList.reduce((acc, curr) => acc + Number(curr.valor_apostado), 0);
  const totalPremiado = historyList.reduce((acc, curr) => acc + Number(curr.valor_premiado), 0);
  const roiGeral = totalApostado > 0 ? ((totalPremiado - totalApostado) / totalApostado) * 100 : 0;

  // Cálculo de Max Drawdown e Curva de Equidade
  let initial = Number(settings?.bankroll_inicial || 1000);
  let current = initial;
  let peak = initial;
  let maxDD = 0;

  historyList.forEach(h => {
    const lp = Number(h.lucro_prejuizo || (Number(h.valor_premiado) - Number(h.valor_apostado)));
    current += lp;
    if (current > peak) peak = current;
    const dd = peak - current;
    if (dd > maxDD) maxDD = dd;
  });

  return {
    totalApostado,
    totalPremiado,
    roiGeral,
    maxDrawdown: maxDD,
    totalConcursos: historyList.length,
    history: historyList,
    currentBankroll: Number(settings?.bankroll_atual || initial),
    initialBankroll: initial
  };
};

export const updateBankrollSettings = async (userId: string, initialAmount: number) => {
  try {
    // 1. Busca o histórico para saber quanto o usuário já ganhou/perdeu
    const { data: history } = await supabase
      .from('bankroll_history')
      .select('valor_apostado, valor_premiado')
      .eq('user_id', userId);
    
    const totalProfitLoss = (history || []).reduce((acc, curr) => {
      return acc + (Number(curr.valor_premiado) - Number(curr.valor_apostado));
    }, 0);

    // 2. O novo saldo atual é o NOVO aporte inicial + o que ele já operou
    const newCurrentBalance = initialAmount + totalProfitLoss;

    // 3. Usamos UPSERT para garantir que o registro seja criado ou atualizado
    const { error } = await supabase
      .from('user_bankroll_settings')
      .upsert({ 
        user_id: userId,
        bankroll_inicial: initialAmount,
        bankroll_atual: newCurrentBalance,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error("[Finance] Erro ao atualizar banca:", error.message);
    return { success: false, error: error.message };
  }
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
    lucro_prejuizo: -valorApostado,
    roi_percentual: -100,
    bankroll_snapshot: bankrollAntes,
    is_simulado: isSimulado
  });

  if (!error) {
    await supabase
      .from('user_bankroll_settings')
      .update({ bankroll_atual: bankrollAntes - valorApostado })
      .eq('user_id', userId);
  }
  
  return { error };
};