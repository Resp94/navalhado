import { useCallback, useEffect, useState } from 'react';
import type { PlanoContasRepository } from './PlanoContasRepository';
import type { CategoriaDespesa } from './types';

/**
 * Hook do Plano de Contas. Diferente de `useClientes`, recebe o repositório
 * injetado em vez de instanciá-lo por dentro: a aba cria o repositório com o
 * adaptador Supabase uma vez por montagem, e os testes passam o adaptador em
 * memória. Sem assinatura realtime (cadastro de baixa concorrência, alterado
 * pela própria tela que o exibe).
 *
 * Ticket 04: expõe as ações de escrita de Categoria de Despesa (criar,
 * renomear, arquivar, reativar). Cada uma refaz a leitura depois de uma
 * escrita bem-sucedida, para que a lista na tela nunca divirja do banco por
 * causa de uma atualização otimista.
 *
 * `CategoriaDespesaForm` (criar/renomear) chama o repositório injetado
 * diretamente, não estas ações — é um componente autônomo, independente da
 * aba, que só recebe o repositório. A aba refaz a leitura com `reload()`
 * depois que o Drawer fecha. As ações deste hook seguem expostas mesmo
 * assim, porque a spec pede o contrato completo (criar, renomear, arquivar,
 * reativar) e um futuro consumidor do hook sem formulário próprio — fora da
 * aba, sem Drawer — usaria estas diretamente.
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

  const criarCategoriaDespesa = useCallback(
    async (name: string) => {
      const categoria = await repository.criarCategoriaDespesa(tenantId, name);
      await loadCategoriasDespesa();
      return categoria;
    },
    [tenantId, repository, loadCategoriasDespesa]
  );

  const renomearCategoriaDespesa = useCallback(
    async (categoriaId: string, name: string) => {
      const categoria = await repository.renomearCategoriaDespesa(tenantId, categoriaId, name);
      await loadCategoriasDespesa();
      return categoria;
    },
    [tenantId, repository, loadCategoriasDespesa]
  );

  const arquivarCategoriaDespesa = useCallback(
    async (categoriaId: string) => {
      const categoria = await repository.arquivarCategoriaDespesa(tenantId, categoriaId);
      await loadCategoriasDespesa();
      return categoria;
    },
    [tenantId, repository, loadCategoriasDespesa]
  );

  const reativarCategoriaDespesa = useCallback(
    async (categoriaId: string) => {
      const categoria = await repository.reativarCategoriaDespesa(tenantId, categoriaId);
      await loadCategoriasDespesa();
      return categoria;
    },
    [tenantId, repository, loadCategoriasDespesa]
  );

  return {
    categoriasDespesa,
    loading,
    error,
    reload: loadCategoriasDespesa,
    criarCategoriaDespesa,
    renomearCategoriaDespesa,
    arquivarCategoriaDespesa,
    reativarCategoriaDespesa,
  };
}
