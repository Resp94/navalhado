import { useCallback, useEffect, useRef, useState } from 'react';
import { RelatoriosRepository, RelatoriosValidationError } from './RelatoriosRepository';
import type { RelatorioClientesSemRetorno, RelatorioClientesSemRetornoBand } from './types';

export interface UseClientesSemRetornoParams {
  tenantId: string;
  /** Filtra só a lista paginada -- totais e faixas ignoram este filtro. */
  overdueBand?: RelatorioClientesSemRetornoBand;
  /** Filtra totais, faixas e lista, pela última Visita do cliente. */
  professionalId?: string;
  /** Página 1-based; convertida em `offset` aqui dentro. */
  page: number;
  pageSize: number;
}

/**
 * Hook da página Clientes sem Retorno (spec 038, ticket 09), mesmo formato
 * de `useAgenda`/`useEquipeServicos`: repositório injetado, dados,
 * carregamento, erro e recarga. SEM parâmetro de período -- o contrato é
 * uma fotografia de hoje -- e COM paginação própria (`page`/`pageSize`,
 * convertidos em `limit`/`offset` na chamada ao repositório). Guarda a
 * chamada mais recente: uma resposta atrasada de uma chamada anterior
 * (página, faixa ou profissional trocados antes dela resolver) é
 * descartada. Recarrega ao mudar qualquer parâmetro, ao voltar o foco para
 * a janela e pelo botão "Atualizar" (via `reload`).
 */
export function useClientesSemRetorno(repository: RelatoriosRepository, params: UseClientesSemRetornoParams) {
  const { tenantId, overdueBand, professionalId, page, pageSize } = params;

  const [data, setData] = useState<RelatorioClientesSemRetorno | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const latestRequestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!tenantId) return;

    const requestId = ++latestRequestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const offset = (Math.max(page, 1) - 1) * pageSize;
      const result = await repository.obterClientesSemRetorno({
        tenantId,
        overdueBand,
        professionalId,
        limit: pageSize,
        offset,
      });
      if (latestRequestIdRef.current !== requestId) return;
      setData(result);
    } catch (err: any) {
      if (latestRequestIdRef.current !== requestId) return;
      const message =
        err instanceof RelatoriosValidationError
          ? err.message
          : 'Não foi possível carregar o relatório de Clientes sem Retorno.';
      setError(message);
    } finally {
      if (latestRequestIdRef.current === requestId) setLoading(false);
    }
  }, [repository, tenantId, overdueBand, professionalId, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleFocus = () => {
      void load();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [load]);

  return { data, loading, error, reload: load };
}
