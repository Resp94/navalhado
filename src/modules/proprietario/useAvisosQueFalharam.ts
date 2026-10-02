import { useCallback, useEffect, useState } from 'react';
import { proprietarioRepository } from './repositorio';
import type { AvisoQueFalhou } from './types';
import type { StatusDaLeitura } from './useDetalhesDoTenant';

/**
 * Os avisos por e-mail que falharam (ticket 08), do mais novo para o mais velho: o Proprietário percebe uma chave do Resend vencida
 * ou um domínio sem verificação antes de o cliente reclamar. Lê uma vez ao montar; `recarregar` lê de novo.
 */
export function useAvisosQueFalharam() {
  const [avisos, setAvisos] = useState<AvisoQueFalhou[]>([]);
  const [status, setStatus] = useState<StatusDaLeitura>('loading');
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let cancelado = false;

    proprietarioRepository
      .avisosQueFalharam()
      .then((lidos) => {
        if (cancelado) return;
        setAvisos(lidos);
        setStatus('ready');
      })
      .catch(() => {
        if (cancelado) return;
        setAvisos([]);
        setStatus('error');
      });

    return () => {
      cancelado = true;
    };
  }, [versao]);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);

  return { avisos, status, recarregar };
}
