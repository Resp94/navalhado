import { useCallback, useEffect, useState } from 'react';
import { contatosDoSiteRepository } from './repositorio';
import type { ContatoDoSite, StatusDoContato } from './types';

export type StatusDaLista = 'loading' | 'ready' | 'error';

/**
 * A lista da aba Contatos do painel do Proprietário. Abre no filtro Novos, como uma caixa de entrada; trocar o filtro lê de novo a
 * primeira página, e `carregarMais` acrescenta as mais antigas. `recarregar` lê de novo a primeira página do filtro atual.
 */
export function useContatosDoSite() {
  const [filtro, setFiltro] = useState<StatusDoContato | null>('novo');
  const [contatos, setContatos] = useState<ContatoDoSite[]>([]);
  const [haMais, setHaMais] = useState(false);
  const [status, setStatus] = useState<StatusDaLista>('loading');
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [erroAoCarregarMais, setErroAoCarregarMais] = useState(false);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let cancelado = false;
    setStatus('loading');
    setErroAoCarregarMais(false);

    contatosDoSiteRepository
      .listar(filtro, null)
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
  }, [filtro, versao]);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);

  const carregarMais = useCallback(async () => {
    const ultimo = contatos.at(-1);
    if (!ultimo || carregandoMais) return;
    setCarregandoMais(true);
    setErroAoCarregarMais(false);
    try {
      const pagina = await contatosDoSiteRepository.listar(filtro, ultimo.id);
      setContatos((atuais) => [...atuais, ...pagina.contatos]);
      setHaMais(pagina.haMais);
    } catch {
      setErroAoCarregarMais(true);
    } finally {
      setCarregandoMais(false);
    }
  }, [contatos, carregandoMais, filtro]);

  return { filtro, setFiltro, contatos, haMais, status, recarregar, carregarMais, carregandoMais, erroAoCarregarMais };
}
