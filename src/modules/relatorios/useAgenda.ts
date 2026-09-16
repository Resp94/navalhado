import { useCallback, useEffect, useRef, useState } from 'react';
import { RelatoriosRepository, RelatoriosValidationError } from './RelatoriosRepository';
import type { RelatorioAgenda } from './types';

export interface UseAgendaParams {
  tenantId: string;
  startDate: string;
  endDate: string;
  /** Filtra status_totals/by_origin/cancellation_reasons, mas NUNCA by_professional. */
  professionalId?: string;
  /** Dia de hoje no fuso do tenant (nunca a data local do navegador). */
  today: string;
}

/**
 * Hook da página Agenda (spec 038, ticket 07), mesmo formato do
 * `useEquipeServicos`: repositório injetado (produção usa
 * `SupabaseRelatoriosAdapter`, testes usam um `vi.fn()`), dados,
 * carregamento, erro e recarga. Guarda a chamada mais recente: uma
 * resposta atrasada de uma chamada anterior (filtro ou profissional
 * trocado antes dela resolver) é descartada. Recarrega ao mudar qualquer
 * parâmetro (inclusive `professionalId`), ao voltar o foco para a janela e
 * pelo botão "Atualizar" (via `reload`).
 */
export function useAgenda(repository: RelatoriosRepository, params: UseAgendaParams) {
  const { tenantId, startDate, endDate, professionalId, today } = params;

  const [data, setData] = useState<RelatorioAgenda | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const latestRequestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!tenantId || !startDate || !endDate || !today) return;

    const requestId = ++latestRequestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await repository.obterAgenda({
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
        err instanceof RelatoriosValidationError ? err.message : 'Não foi possível carregar o relatório de Agenda.';
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
