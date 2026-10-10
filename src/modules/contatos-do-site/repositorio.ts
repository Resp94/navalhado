import { supabase } from '../../lib/supabase';
import { ContatosDoSiteRepository } from './ContatosDoSiteRepository';
import { WorkerContatosDoSiteAdapter } from './adapters/WorkerContatosDoSiteAdapter';

const tokenDaSessao = async () => (await supabase.auth.getSession()).data.session?.access_token ?? null;

// Um repositório só, com o adaptador do Worker, para todos os hooks do módulo.
export const contatosDoSiteRepository = new ContatosDoSiteRepository(new WorkerContatosDoSiteAdapter(tokenDaSessao));
