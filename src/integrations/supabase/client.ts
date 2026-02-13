import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://jkjjuicthxcmiidaiiof.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impramp1aWN0aHhjbWlpZGFpaW9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3MDc4NTIsImV4cCI6MjA4NDI4Mzg1Mn0.agrZLPsQDS2q9tjd3YE4IfTi5z3aH5uhsT9fhCN7obk";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);