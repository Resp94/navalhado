import { useCallback, useRef, useState } from 'react';
import { MENSAGEM_COTAR_TROCA_FALHOU, MENSAGEM_TROCAR_PLANO_FALHOU } from './errors';
import { assinaturaRepository } from './repositorio';
import type { CotacaoDaTroca, PagamentoDaTroca, PlanoTrocado } from './types';

/**
 * Cotar e fazer a troca de plano. `cotar` pede à função de cobrança a diferença proporcional e o valor mensal novo
 * (só mostra; não cobra nada). `trocar` troca o plano, cobrando a diferença no cartão do token quando há cobrança:
 * devolve o resultado, ou nulo se a troca foi recusada (o motivo fica em `erro`, pronto para mostrar ao Gerente).
 */
export function useTrocarDePlano() {
  const [cotacao, setCotacao] = useState<CotacaoDaTroca | null>(null);
  const [cotando, setCotando] = useState(false);
  const [erroDaCotacao, setErroDaCotacao] = useState<string | null>(null);
  const [trocando, setTrocando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Só a cotação do último plano escolhido vale: a resposta atrasada de outro plano é ignorada.
  const pedido = useRef(0);

  const cotar = useCallback(async (planoId: string) => {
    const meuPedido = ++pedido.current;
    setCotacao(null);
    setErroDaCotacao(null);
    setErro(null);
    setCotando(true);
    try {
      const nova = await assinaturaRepository.cotarTrocaDePlano(planoId);
      if (meuPedido === pedido.current) setCotacao(nova);
    } catch (err) {
      console.error('Erro ao cotar a troca de plano:', err instanceof Error ? err.message : 'erro');
      if (meuPedido === pedido.current) setErroDaCotacao(err instanceof Error ? err.message : MENSAGEM_COTAR_TROCA_FALHOU);
    } finally {
      if (meuPedido === pedido.current) setCotando(false);
    }
  }, []);

  const trocar = useCallback(async (planoId: string, pagamento?: PagamentoDaTroca): Promise<PlanoTrocado | null> => {
    setTrocando(true);
    setErro(null);
    try {
      return await assinaturaRepository.trocarDePlano(planoId, pagamento);
    } catch (err) {
      console.error('Erro ao trocar de plano:', err instanceof Error ? err.message : 'erro');
      setErro(err instanceof Error ? err.message : MENSAGEM_TROCAR_PLANO_FALHOU);
      return null;
    } finally {
      setTrocando(false);
    }
  }, []);

  /** Esquece a cotação e os erros (o Gerente voltou à lista de planos ou fechou); uma cotação em andamento deixa de valer. */
  const limpar = useCallback(() => {
    pedido.current += 1;
    setCotacao(null);
    setCotando(false);
    setErroDaCotacao(null);
    setErro(null);
  }, []);

  return { cotar, cotacao, cotando, erroDaCotacao, trocar, trocando, erro, limpar };
}
