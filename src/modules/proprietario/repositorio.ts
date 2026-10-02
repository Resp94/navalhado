import { supabase } from '../../lib/supabase';
import { ProprietarioRepository } from './ProprietarioRepository';
import { SupabaseProprietarioAdapter } from './adapters/SupabaseProprietarioAdapter';

// Um repositório só, com o adaptador Supabase, para todos os hooks do módulo.
export const proprietarioRepository = new ProprietarioRepository(new SupabaseProprietarioAdapter(supabase));
