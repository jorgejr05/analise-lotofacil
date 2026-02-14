"use server";

import { supabase } from "@/integrations/supabase/client";

export async function updateProfileSafe(userId: string, data: { first_name: string, last_name: string, gemini_api_key?: string }) {
  try {
    const updateData: any = {
      first_name: data.first_name,
      last_name: data.last_name,
      updated_at: new Date().toISOString()
    };

    if (data.gemini_api_key && data.gemini_api_key !== "••••••••••••••••") {
      updateData.gemini_api_key = data.gemini_api_key;
    }

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getInternalApiKey(userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('gemini_api_key')
    .eq('id', userId)
    .single();
  return data?.gemini_api_key;
}