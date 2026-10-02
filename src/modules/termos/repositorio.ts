import { supabase } from '../../lib/supabase';
import { TermosRepository } from './TermosRepository';
import { SupabaseTermosAdapter } from './adapters/SupabaseTermosAdapter';

// Um repositório só, com o adaptador Supabase, para o hook do módulo.
export const termosRepository = new TermosRepository(new SupabaseTermosAdapter(supabase));
