import { useCallback, useEffect, useRef, useState } from 'react';
import { RelatoriosRepository, RelatoriosValidationError } from './RelatoriosRepository';
import type { RelatorioFaturamento, RelatoriosGranularity } from './types';

export interface UseRelatorioFaturamentoParams {
  tenantId: string;
  startDate: string;
  endDate: string;
  granularity: RelatoriosGranularity;
  /** Dia de hoje no fuso do tenant (nunca a data local do navegador). */
  today: string;
}

/**
 * Hook do relatório de Faturamento por período (spec 038, ticket 01).
 * Recebe o repositório injetado (produção usa `SupabaseRelatoriosAdapter`,
 * testes usam um `vi.fn()`) e expõe dados, carregamento, erro e recarga.
 * Guarda a chamada mais recente: uma resposta atrasada de uma chamada
 * anterior (filtro trocado antes dela resolver) é descartada, para nunca
 * sobrescrever dados de um período diferente do que a tela mostra agora.
 * Recarrega ao mudar qualquer parâmetro do filtro, ao voltar o foco para a
 * janela e pelo botão "Atualizar" (via `reload`). Sem tempo real: o
 * contrato agrega várias tabelas numa única chamada.
 */
export function useRelatorioFaturamento(repository: RelatoriosRepository, params: UseRelatorioFaturamentoParams) {
  const { tenantId, startDate, endDate, granularity, today } = params;

  const [data, setData] = useState<RelatorioFaturamento | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const latestRequestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!tenantId || !startDate || !endDate || !today) return;

    const requestId = ++latestRequestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await repository.obterFaturamentoPorPeriodo({
        tenantId,
        startDate,
        endDate,
        granularity,
        today,
      });
      if (latestRequestIdRef.current !== requestId) return;
      setData(result);
    } catch (err: any) {
      if (latestRequestIdRef.current !== requestId) return;
      const message =
        err instanceof RelatoriosValidationError
          ? err.message
          : 'Não foi possível carregar o faturamento por período.';
      setError(message);
    } finally {
      if (latestRequestIdRef.current === requestId) setLoading(false);
    }
  }, [repository, tenantId, startDate, endDate, granularity, today]);

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
