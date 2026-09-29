import { PlanosRepository } from './PlanosRepository';
import { SupabasePlanosAdapter } from './adapters/SupabasePlanosAdapter';

// Um repositório só, com o adaptador Supabase, para todos os hooks do módulo.
export const planosRepository = new PlanosRepository(new SupabasePlanosAdapter());
