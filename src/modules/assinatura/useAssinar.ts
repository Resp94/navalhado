import { useCallback, useEffect, useState } from 'react';
import { assinaturaRepository } from './repositorio';

const abrirNaMesmaAba = (url: string) => window.location.assign(url);

/**
 * Cria a assinatura e leva o Gerente para a página de pagamento do Mercado Pago. Depois de
 * criada, `assinando` continua ligado até a página sair: um segundo clique nunca cria outra.
 * Se falha, o botão volta a valer e `erro` traz a mensagem para o Gerente. Voltar do Mercado Pago
 * pelo botão do navegador restaura a página do cache como ela ficou: o `pageshow` liga o botão de novo.
 */
export function useAssinar(abrirLink: (url: string) => void = abrirNaMesmaAba) {
  const [assinando, setAssinando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const aoRestaurarDoCache = (evento: Event) => {
      if ((evento as PageTransitionEvent).persisted) setAssinando(false);
    };
    window.addEventListener('pageshow', aoRestaurarDoCache);
    return () => window.removeEventListener('pageshow', aoRestaurarDoCache);
  }, []);

  const assinar = useCallback(async () => {
    setAssinando(true);
    setErro(null);
    try {
      const criada = await assinaturaRepository.assinar();
      abrirLink(criada.linkDePagamento);
    } catch (err) {
      console.error('Erro ao criar a assinatura:', err);
      setErro(err instanceof Error ? err.message : 'Não foi possível iniciar a assinatura. Tente de novo.');
      setAssinando(false);
    }
  }, [abrirLink]);

  return { assinar, assinando, erro };
}
