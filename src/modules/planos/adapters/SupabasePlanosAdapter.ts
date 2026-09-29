import { supabase } from '../../../lib/supabase';
import type { IPlanosAdapter, Plano } from '../types';

const paraPlano = (row: { id: string; name: string; price: unknown; max_professionals: number }): Plano => ({
  id: row.id,
  name: row.name,
  price: Number(row.price),
  max_professionals: row.max_professionals,
});

export class SupabasePlanosAdapter implements IPlanosAdapter {
  // O catálogo é de leitura pública: o cadastro o lê antes de existir login.
  async listar(): Promise<Plano[]> {
    const { data, error } = await supabase
      .from('plans')
      .select('id, name, price, max_professionals')
      .order('price', { ascending: true });

    if (error) {
      throw new Error(`Erro ao listar planos: ${error.message}`);
    }

    return (data || []).map(paraPlano);
  }

  // Mesma escolha do gatilho de limite no banco: a assinatura mais recente da barbearia.
  async obterDoTenant(tenantId: string): Promise<Plano | null> {
    const { data, error } = await supabase
      .from('tenant_subscriptions')
      .select('plans(id, name, price, max_professionals)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao ler o plano da barbearia: ${error.message}`);
    }

    const relacao = (data as { plans?: unknown } | null)?.plans;
    const plano = Array.isArray(relacao) ? relacao[0] : relacao;
    return plano ? paraPlano(plano as Parameters<typeof paraPlano>[0]) : null;
  }
}
