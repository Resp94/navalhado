import { useCallback, useEffect, useState } from 'react';
import type { PlanoContasRepository } from './PlanoContasRepository';
import type { CategoriaDespesa } from './types';

/**
 * Hook do Plano de Contas. Diferente de `useClientes`, recebe o repositório
 * injetado em vez de instanciá-lo por dentro: a aba cria o repositório com o
 * adaptador Supabase uma vez por montagem, e os testes passam o adaptador em
 * memória. Sem assinatura realtime (cadastro de baixa concorrência, alterado
 * pela própria tela que o exibe).
 */
export function usePlanoContas(tenantId: string, repository: PlanoContasRepository) {
  const [categoriasDespesa, setCategoriasDespesa] = useState<CategoriaDespesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCategoriasDespesa = useCallback(async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      setError(null);
      const lista = await repository.listarCategoriasDespesa(tenantId);
      setCategoriasDespesa(lista);
    } catch (err) {
      console.error('Erro ao carregar categorias de despesa:', err);
      setError('Não foi possível carregar as categorias de despesa.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, repository]);

  useEffect(() => {
    void loadCategoriasDespesa();
  }, [loadCategoriasDespesa]);

  return {
    categoriasDespesa,
    loading,
    error,
    reload: loadCategoriasDespesa,
  };
}
