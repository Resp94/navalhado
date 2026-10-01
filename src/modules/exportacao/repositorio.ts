import { supabase } from '../../lib/supabase';
import { ExportacaoRepository } from './ExportacaoRepository';
import { SupabaseExportacaoAdapter } from './adapters/SupabaseExportacaoAdapter';

// Um repositório só, com o adaptador Supabase, para o hook do módulo.
export const exportacaoRepository = new ExportacaoRepository(new SupabaseExportacaoAdapter(supabase));
