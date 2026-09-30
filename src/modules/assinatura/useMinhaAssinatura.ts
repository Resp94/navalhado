import { useCallback, useEffect, useState } from 'react';
import { assinaturaRepository } from './repositorio';
import type { Cobranca, DetalhesDaAssinatura, EstadoDeAcessoStatus } from './types';

/**
 * Assinatura e histórico de cobranças da barbearia, para a tela Assinatura de Configurações.
 * O histórico vem do que o webhook gravou; a tela não consulta o Mercado Pago. Falha ao ler a
 * assinatura vira `status: 'error'`; falha só no histórico mantém a assinatura na tela e liga
 * `historicoIndisponivel`. Se uma releitura falha depois de a tela já ter dados, eles ficam.
 */
export function useMinhaAssinatura(tenantId: string) {
  const [assinatura, setAssinatura] = useState<DetalhesDaAssinatura | null>(null);
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [status, setStatus] = useState<EstadoDeAcessoStatus>('loading');
  const [historicoIndisponivel, setHistoricoIndisponivel] = useState(false);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (!tenantId) return;
    let cancelado = false;

    Promise.allSettled([
      assinaturaRepository.obterAssinatura(tenantId),
      assinaturaRepository.listarCobrancas(tenantId),
    ]).then(([lidaAssinatura, lidasCobrancas]) => {
      if (cancelado) return;

      if (lidaAssinatura.status === 'rejected') {
        console.error('Erro ao carregar a assinatura da barbearia:', lidaAssinatura.reason);
        setStatus((atual) => (atual === 'ready' ? 'ready' : 'error'));
        return;
      }

      setAssinatura(lidaAssinatura.value);
      setStatus('ready');

      if (lidasCobrancas.status === 'rejected') {
        console.error('Erro ao carregar o histórico de cobranças:', lidasCobrancas.reason);
        setHistoricoIndisponivel(true);
        return;
      }
      setCobrancas(lidasCobrancas.value);
      setHistoricoIndisponivel(false);
    });

    return () => {
      cancelado = true;
    };
  }, [tenantId, versao]);

  /** Relê agora, por exemplo para quem acabou de voltar de um pagamento. */
  const recarregar = useCallback(() => setVersao((v) => v + 1), []);

  const diasRestantes = assinatura?.testeAte
    ? assinaturaRepository.diasRestantes({ dataRelevante: assinatura.testeAte })
    : null;

  return { assinatura, cobrancas, status, historicoIndisponivel, diasRestantes, recarregar };
}
