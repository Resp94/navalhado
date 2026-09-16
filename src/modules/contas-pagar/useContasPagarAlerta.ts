import { useCallback, useEffect, useState } from 'react';
import type { ContasPagarRepository } from './ContasPagarRepository';
import type { AlertaContasPagar } from './types';

/**
 * Alerta de vencidas (ticket 09/036): sem filtro de período, para alimentar
 * tanto o selo na navegação do Hub quanto a faixa no topo da aba. Recarrega
 * ao montar e expõe `reload`, para ser chamado de novo após qualquer escrita
 * em Contas a Pagar (Baixa, estorno, edição, cancelamento, lançamento).
 */
export function useContasPagarAlerta(tenantId: string, repository: ContasPagarRepository) {
  const [alerta, setAlerta] = useState<AlertaContasPagar | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const resultado = await repository.obterAlerta(tenantId);
      setAlerta(resultado);
    } catch {
      setAlerta(null);
    } finally {
      setLoading(false);
    }
  }, [tenantId, repository]);

  useEffect(() => {
    void load();
  }, [load]);

  return { alerta, loading, reload: load };
}
