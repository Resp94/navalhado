import { useCallback, useEffect, useState } from 'react';
import { proprietarioRepository } from './repositorio';
import type { DetalhesDoTenant } from './types';

export type StatusDaLeitura = 'idle' | 'loading' | 'ready' | 'error';

const MENSAGEM_PADRAO = 'Não foi possível ler os detalhes da barbearia. Tente de novo.';

/**
 * Os detalhes da assinatura da barbearia escolhida (Admin > Tenants). Sem barbearia escolhida (`null`) não lê nada e fica `idle`.
 * Trocar de barbearia esquece a anterior (e a resposta que chega depois da troca não aparece). `recarregar` lê de novo mantendo na
 * tela o que já havia, para a tela não piscar depois de uma ação.
 */
export function useDetalhesDoTenant(tenantId: string | null) {
  const [lidos, setLidos] = useState<DetalhesDoTenant | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (!tenantId) {
      setLidos(null);
      setErro(null);
      return;
    }

    let cancelado = false;
    setErro(null);

    proprietarioRepository
      .detalhesDoTenant(tenantId)
      .then((detalhes) => {
        if (!cancelado) setLidos(detalhes);
      })
      .catch((err) => {
        if (!cancelado) setErro(err instanceof Error ? err.message : MENSAGEM_PADRAO);
      });

    return () => {
      cancelado = true;
    };
  }, [tenantId, versao]);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);

  // O que está lido pode ser de outra barbearia (a escolha mudou e a nova ainda carrega): só vale se for a escolhida.
  const detalhes = lidos && lidos.barbearia.id === tenantId ? lidos : null;
  const status: StatusDaLeitura = !tenantId ? 'idle' : erro ? 'error' : detalhes ? 'ready' : 'loading';

  return { detalhes, status, erro, recarregar };
}
