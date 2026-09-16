import { useCallback, useEffect, useRef, useState } from 'react';
import { RelatoriosRepository, RelatoriosValidationError } from './RelatoriosRepository';
import type { RelatorioEquipeServicos } from './types';

export interface UseEquipeServicosParams {
  tenantId: string;
  startDate: string;
  endDate: string;
  /** Filtra só `services[]` -- o ranking de profissionais nunca é filtrado. */
  professionalId?: string;
  /** Dia de hoje no fuso do tenant (nunca a data local do navegador). */
  today: string;
}

/**
 * Hook da página Equipe e Serviços (spec 038, ticket 05), mesmo formato do
 * `useRelatorioFaturamento`: repositório injetado (produção usa
 * `SupabaseRelatoriosAdapter`, testes usam um `vi.fn()`), dados,
 * carregamento, erro e recarga. Guarda a chamada mais recente: uma
 * resposta atrasada de uma chamada anterior (filtro ou profissional
 * trocado antes dela resolver) é descartada. Recarrega ao mudar qualquer
 * parâmetro (inclusive `professionalId`, que refaz a busca ao trocar o
 * filtro de serviços), ao voltar o foco para a janela e pelo botão
 * "Atualizar" (via `reload`).
 */
export function useEquipeServicos(repository: RelatoriosRepository, params: UseEquipeServicosParams) {
  const { tenantId, startDate, endDate, professionalId, today } = params;

  const [data, setData] = useState<RelatorioEquipeServicos | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const latestRequestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!tenantId || !startDate || !endDate || !today) return;

    const requestId = ++latestRequestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await repository.obterEquipeEServicos({
        tenantId,
        startDate,
        endDate,
        professionalId,
        today,
      });
      if (latestRequestIdRef.current !== requestId) return;
      setData(result);
    } catch (err: any) {
      if (latestRequestIdRef.current !== requestId) return;
      const message =
        err instanceof RelatoriosValidationError
          ? err.message
          : 'Não foi possível carregar o relatório de Equipe e Serviços.';
      setError(message);
    } finally {
      if (latestRequestIdRef.current === requestId) setLoading(false);
    }
  }, [repository, tenantId, startDate, endDate, professionalId, today]);

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
