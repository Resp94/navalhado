import { supabase } from '../../../lib/supabase';
import type { IPlanosAdapter, Plano } from '../types';

const paraPlano = (row: { id: string; name: string; price: unknown; max_professionals: number }): Plano => ({
  id: row.id,
  name: row.name,
  price: Number(row.price),
  max_professionals: row.max_professionals,
});

type PlanoDaLinha = Parameters<typeof paraPlano>[0];

// O embed do PostgREST chega como objeto, ou como lista de um elemento.
const primeiro = (relacao: unknown): PlanoDaLinha | null => {
  const plano = Array.isArray(relacao) ? relacao[0] : relacao;
  return plano ? (plano as PlanoDaLinha) : null;
};

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

  // A barbearia tem uma única assinatura (unique por tenant_id desde o ticket 03).
  async obterDoTenant(tenantId: string): Promise<Plano | null> {
    const { data, error } = await supabase
      .from('tenant_subscriptions')
      .select(
        'plans!tenant_subscriptions_plan_id_fkey(id, name, price, max_professionals), ' +
          'scheduled_plan:plans!tenant_subscriptions_scheduled_plan_id_fkey(id, name, price, max_professionals)',
      )
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao ler o plano da barbearia: ${error.message}`);
    }

    const linha = data as { plans?: unknown; scheduled_plan?: unknown } | null;
    const atual = primeiro(linha?.plans);
    if (!atual) return null;

    // Com uma descida agendada o banco já aplica o limite do plano menor (o menor entre o atual e o agendado): é o plano
    // que a cota mostra.
    const plano = paraPlano(atual);
    const agendado = primeiro(linha?.scheduled_plan);
    if (agendado) {
      const menor = paraPlano(agendado);
      if (menor.max_professionals < plano.max_professionals) return menor;
    }
    return plano;
  }
}
