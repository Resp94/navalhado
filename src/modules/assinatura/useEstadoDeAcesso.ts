import { useEffect, useRef, useState } from 'react';
import { assinaturaRepository } from './repositorio';
import type { EstadoDeAcesso, EstadoDeAcessoStatus } from './types';

/** Quanto esperar para tentar de novo quando a primeira leitura do estado falha. */
export const ATRASO_DA_NOVA_TENTATIVA_MS = 30_000;

/**
 * Estado de Acesso da barbearia de quem está logado, para o porteiro dos layouts. O
 * banco resolve a barbearia pelo login, então a leitura sai assim que o layout monta,
 * em paralelo com a leitura dos dados da barbearia, sem esperar por eles.
 *
 * Relê quando a aba volta a ficar visível, para uma sessão longa (ou o retorno de um
 * pagamento) enxergar o estado novo sem recarregar a página.
 *
 * Se a leitura falha e ainda não há estado, `status` é 'error' e `estado` é nulo: o
 * painel abre, porque o bloqueio de verdade não depende do front (o banco e as funções
 * do servidor conferem o mesmo estado) e travar todo mundo por uma falha de rede seria
 * pior. Nesse caso o hook tenta de novo a cada ATRASO_DA_NOVA_TENTATIVA_MS até ler. Se a
 * releitura falha depois de um estado conhecido, o último é mantido.
 */
export function useEstadoDeAcesso() {
  const [estado, setEstado] = useState<EstadoDeAcesso | null>(null);
  const [status, setStatus] = useState<EstadoDeAcessoStatus>('loading');
  const [versao, setVersao] = useState(0);
  const jaLeuRef = useRef(false);

  useEffect(() => {
    let cancelado = false;
    let novaTentativa: ReturnType<typeof setTimeout> | undefined;

    assinaturaRepository
      .obterEstadoDeAcesso()
      .then((lido) => {
        if (cancelado) return;
        jaLeuRef.current = true;
        setEstado(lido);
        setStatus('ready');
      })
      .catch((err) => {
        console.error('Erro ao carregar o estado de acesso da barbearia:', err);
        if (cancelado) return;
        setStatus((atual) => (atual === 'ready' ? 'ready' : 'error'));
        if (!jaLeuRef.current) {
          novaTentativa = setTimeout(() => setVersao((v) => v + 1), ATRASO_DA_NOVA_TENTATIVA_MS);
        }
      });

    return () => {
      cancelado = true;
      clearTimeout(novaTentativa);
    };
  }, [versao]);

  useEffect(() => {
    const aoVoltarParaAAba = () => {
      if (document.visibilityState === 'visible') setVersao((v) => v + 1);
    };
    document.addEventListener('visibilitychange', aoVoltarParaAAba);
    return () => document.removeEventListener('visibilitychange', aoVoltarParaAAba);
  }, []);

  const diasRestantes = estado ? assinaturaRepository.diasRestantes(estado) : null;

  return { estado, status, diasRestantes };
}
