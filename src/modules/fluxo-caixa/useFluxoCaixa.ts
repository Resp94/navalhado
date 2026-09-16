import { useCallback, useEffect, useRef, useState } from 'react';
import { FluxoCaixaRepository, FluxoCaixaValidationError } from './FluxoCaixaRepository';
import type { FluxoCaixaGranularity, FluxoCaixaProjetado } from './types';

export interface UseFluxoCaixaParams {
  tenantId: string;
  startDate: string;
  endDate: string;
  granularity: FluxoCaixaGranularity;
  /** Dia de hoje no fuso do tenant (nunca a data local do navegador). */
  today: string;
}

/**
 * Hook do Fluxo de Caixa Projetado (spec 037, ticket 01). Recebe o
 * repositório injetado (produção usa `SupabaseFluxoCaixaAdapter`, testes
 * usam um `vi.fn()`) e expõe dados, carregamento, erro e recarga. Recarrega
 * ao mudar qualquer parâmetro do filtro e ao a janela voltar o foco. Sem
 * assinatura em tempo real: o contrato agrega várias tabelas.
 */
export function useFluxoCaixa(repository: FluxoCaixaRepository, params: UseFluxoCaixaParams) {
  const { tenantId, startDate, endDate, granularity, today } = params;

  const [data, setData] = useState<FluxoCaixaProjetado | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Guarda a chamada mais recente: uma resposta de uma chamada anterior que
  // chega depois de uma mais nova (filtro trocado antes da primeira
  // resolver) é descartada, para nunca sobrescrever dados de um período
  // diferente do que a tela mostra no momento.
  const latestRequestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!tenantId || !startDate || !endDate || !today) return;

    const requestId = ++latestRequestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await repository.obterFluxoCaixaProjetado({
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
        err instanceof FluxoCaixaValidationError
          ? err.message
          : 'Não foi possível carregar o fluxo de caixa projetado.';
      setError(message);
    } finally {
      if (latestRequestIdRef.current === requestId) setLoading(false);
    }
  }, [repository, tenantId, startDate, endDate, granularity, today]);

  useEffect(() => {
    void load();
  }, [load]);

  // Recarrega ao voltar o foco para a janela, sem assinatura em tempo real.
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
