import { createClient } from '@supabase/supabase-js';

// Inicializa o cliente com variáveis de ambiente ou fallbacks vazios
// O Vite expõe variáveis do arquivo .env via import.meta.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
