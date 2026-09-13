import { useCallback, useEffect, useState } from 'react';
import type { PlanoContasRepository } from './PlanoContasRepository';
import type { CategoriaDespesa, DadosFornecedor, Fornecedor } from './types';

/**
 * Hook do Plano de Contas. Diferente de `useClientes`, recebe o repositório
 * injetado em vez de instanciá-lo por dentro: a aba cria o repositório com o
 * adaptador Supabase uma vez por montagem, e os testes passam o adaptador em
 * memória. Sem assinatura realtime (cadastro de baixa concorrência, alterado
 * pela própria tela que o exibe).
 *
 * Ticket 04: expõe arquivar/reativar Categoria de Despesa. Cada uma refaz a
 * leitura depois de uma escrita bem-sucedida, para que a lista na tela nunca
 * divirja do banco por causa de uma atualização otimista. Criar e renomear
 * não passam pelo hook: `CategoriaDespesaForm` chama o repositório
 * diretamente e a aba faz um único `reload()` depois — expor as mesmas ações
 * aqui também duplicaria esse caminho sem nenhum chamador.
 *
 * Ticket 06: o mesmo par (listagem própria + ações de arquivar/reativar) para
 * Fornecedor, com `FornecedorForm` seguindo o mesmo desenho do formulário de
 * Categoria (chama o repositório diretamente para criar/atualizar).
 */
export function usePlanoContas(tenantId: string, repository: PlanoContasRepository) {
  const [categoriasDespesa, setCategoriasDespesa] = useState<CategoriaDespesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loadingFornecedores, setLoadingFornecedores] = useState(true);
  const [errorFornecedores, setErrorFornecedores] = useState<string | null>(null);

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

  const loadFornecedores = useCallback(async () => {
    if (!tenantId) return;
    try {
      setLoadingFornecedores(true);
      setErrorFornecedores(null);
      const lista = await repository.listarFornecedores(tenantId);
      setFornecedores(lista);
    } catch (err) {
      console.error('Erro ao carregar fornecedores:', err);
      setErrorFornecedores('Não foi possível carregar os fornecedores.');
    } finally {
      setLoadingFornecedores(false);
    }
  }, [tenantId, repository]);

  useEffect(() => {
    void loadFornecedores();
  }, [loadFornecedores]);

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

  const arquivarFornecedor = useCallback(
    async (fornecedorId: string) => {
      const fornecedor = await repository.arquivarFornecedor(tenantId, fornecedorId);
      await loadFornecedores();
      return fornecedor;
    },
    [tenantId, repository, loadFornecedores]
  );

  const reativarFornecedor = useCallback(
    async (fornecedorId: string) => {
      const fornecedor = await repository.reativarFornecedor(tenantId, fornecedorId);
      await loadFornecedores();
      return fornecedor;
    },
    [tenantId, repository, loadFornecedores]
  );

  return {
    categoriasDespesa,
    loading,
    error,
    reload: loadCategoriasDespesa,
    arquivarCategoriaDespesa,
    reativarCategoriaDespesa,

    fornecedores,
    loadingFornecedores,
    errorFornecedores,
    reloadFornecedores: loadFornecedores,
    arquivarFornecedor,
    reativarFornecedor,
  };
}

export type { DadosFornecedor };
