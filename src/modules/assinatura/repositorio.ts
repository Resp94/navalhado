import { AssinaturaRepository } from './AssinaturaRepository';
import { SupabaseAssinaturaAdapter } from './adapters/SupabaseAssinaturaAdapter';

// Um repositório só, com o adaptador Supabase, para todos os hooks do módulo.
export const assinaturaRepository = new AssinaturaRepository(new SupabaseAssinaturaAdapter());
