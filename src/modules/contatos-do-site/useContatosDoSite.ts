import { useCallback, useEffect, useState } from 'react';
import { contatosDoSiteRepository } from './repositorio';
import type { ContatoDoSite, StatusDoContato } from './types';

export type StatusDaLista = 'loading' | 'ready' | 'error';

/**
 * A lista da aba Contatos do painel do Proprietário. Abre no filtro Novos, como uma caixa de entrada; trocar o filtro lê de novo a
 * primeira página, e `carregarMais` acrescenta as mais antigas. `recarregar` lê de novo a primeira página do filtro atual. `abrir` e
 * `marcar` mudam o status na hora (a tela decide quando a mensagem sai do filtro).
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

  const trocarStatus = useCallback((id: number, novo: StatusDoContato) => {
    setContatos((atuais) => atuais.map((c) => (c.id === id ? { ...c, status: novo } : c)));
  }, []);

  /** A mudança aparece na hora; se a gravação falha, a tela volta ao status anterior e o erro sobe para quem chamou avisar. */
  const marcar = useCallback(
    async (contato: ContatoDoSite, novo: StatusDoContato) => {
      trocarStatus(contato.id, novo);
      try {
        await contatosDoSiteRepository.marcar(contato.id, novo);
      } catch (erro) {
        trocarStatus(contato.id, contato.status);
        throw erro;
      }
    },
    [trocarStatus],
  );

  /** Abrir uma mensagem nova a marca como lida; as outras abrem sem mudar nada. */
  const abrir = useCallback(
    async (contato: ContatoDoSite) => {
      if (contato.status !== 'novo') return;
      trocarStatus(contato.id, 'lido');
      try {
        await contatosDoSiteRepository.abrir(contato);
      } catch (erro) {
        trocarStatus(contato.id, 'novo');
        throw erro;
      }
    },
    [trocarStatus],
  );

  /** Tira da lista a mensagem cujo status não bate mais com o filtro (a tela chama ao fechá-la). */
  const retirarSeSaiuDoFiltro = useCallback(
    (id: number) => {
      setContatos((atuais) => atuais.filter((c) => c.id !== id || filtro === null || c.status === filtro));
    },
    [filtro],
  );

  return {
    filtro,
    setFiltro,
    contatos,
    haMais,
    status,
    recarregar,
    carregarMais,
    carregandoMais,
    erroAoCarregarMais,
    abrir,
    marcar,
    retirarSeSaiuDoFiltro,
  };
}
