import { useEffect, useState } from 'react';
import { contatosDoSiteRepository } from './repositorio';

export const INTERVALO_DO_CONTADOR = 60_000;

/**
 * Quantos Contatos do Site estão como `novo`, para o contador da aba Contatos no cabeçalho do painel do Proprietário. O D1 não avisa
 * quando chega mensagem, então o painel pergunta: ao montar, a cada 60 segundos com a aba do navegador visível (oculta, não consulta),
 * ao voltar para a aba e logo depois de cada mudança de status. Nulo até a primeira leitura; se uma leitura falha, fica o último número.
 */
export function useContatosNovos(): number | null {
  const [novos, setNovos] = useState<number | null>(null);

  useEffect(() => {
    let ativo = true;

    const ler = () => {
      if (document.visibilityState !== 'visible') return;
      contatosDoSiteRepository
        .contarNovos()
        .then((n) => {
          if (ativo) setNovos(n);
        })
        .catch(() => {});
    };

    ler();
    const intervalo = setInterval(ler, INTERVALO_DO_CONTADOR);
    document.addEventListener('visibilitychange', ler);
    const cancelarAviso = contatosDoSiteRepository.aoMudar(ler);

    return () => {
      ativo = false;
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', ler);
      cancelarAviso();
    };
  }, []);

  return novos;
}
