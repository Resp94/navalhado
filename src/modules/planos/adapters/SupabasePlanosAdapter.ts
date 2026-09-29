import { supabase } from '../../../lib/supabase';
import type { IPlanosAdapter, Plano } from '../types';

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

    return (data || []).map((row) => ({
      id: row.id,
      name: row.name,
      price: Number(row.price),
      max_professionals: row.max_professionals,
    }));
  }
}
