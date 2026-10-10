import { useCallback, useEffect, useState } from 'react';
import { contatosDoSiteRepository } from './repositorio';
import type { ContatoDoSite } from './types';

export type StatusDaLista = 'loading' | 'ready' | 'error';

/** A lista da aba Contatos do painel do Proprietário. Lê ao montar; `recarregar` lê de novo. */
export function useContatosDoSite() {
  const [contatos, setContatos] = useState<ContatoDoSite[]>([]);
  const [haMais, setHaMais] = useState(false);
  const [status, setStatus] = useState<StatusDaLista>('loading');
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let cancelado = false;
    setStatus('loading');

    contatosDoSiteRepository
      .listar()
      .then((pagina) => {
        if (cancelado) return;
        setContatos(pagina.contatos);
        setHaMais(pagina.haMais);
        setStatus('ready');
      })
      .catch(() => {
        if (cancelado) return;
        setContatos([]);
        setHaMais(false);
        setStatus('error');
      });

    return () => {
      cancelado = true;
    };
  }, [versao]);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);

  return { contatos, haMais, status, recarregar };
}
