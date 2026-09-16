import { useCallback, useEffect, useState } from 'react';
import type { ContasPagarRepository } from './ContasPagarRepository';
import type { ContaPagarListada, FiltroEstadoContaPagar } from './types';

export interface FiltroPeriodoContasPagar {
  dueDateFrom: string | null;
  dueDateTo: string | null;
  status: FiltroEstadoContaPagar;
  categoryId: string | null;
  supplierId: string | null;
}

const FILTRO_PADRAO: FiltroPeriodoContasPagar = {
  dueDateFrom: null,
  dueDateTo: null,
  status: 'not_cancelled',
  categoryId: null,
  supplierId: null,
};

const PAGE_SIZE = 20;

/**
 * Hook de Contas a Pagar (ticket 06/036): recebe o repositório por injeção
 * (mesmo padrão de `usePlanoContas`), não o instancia internamente. Refaz a
 * leitura paginada sempre que o tenant, o filtro ou a página mudam, e expõe
 * `reload` para o formulário chamar depois de lançar uma conta avulsa.
 */
export function useContasPagar(tenantId: string, repository: ContasPagarRepository) {
  const [contas, setContas] = useState<ContaPagarListada[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroPeriodoContasPagar>(FILTRO_PADRAO);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const resultado = await repository.listarContas(tenantId, {
        dueDateFrom: filtro.dueDateFrom,
        dueDateTo: filtro.dueDateTo,
        status: filtro.status,
        page,
        pageSize: PAGE_SIZE,
        categoryId: filtro.categoryId,
        supplierId: filtro.supplierId,
      });
      setContas(resultado.contas);
      setTotalCount(resultado.totalCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar as Contas a Pagar.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, repository, filtro, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const mudarFiltro = useCallback((novo: Partial<FiltroPeriodoContasPagar>) => {
    setFiltro((atual) => ({ ...atual, ...novo }));
    setPage(1);
  }, []);

  return {
    contas,
    totalCount,
    pageSize: PAGE_SIZE,
    page,
    setPage,
    loading,
    error,
    filtro,
    mudarFiltro,
    reload: load,
  };
}
