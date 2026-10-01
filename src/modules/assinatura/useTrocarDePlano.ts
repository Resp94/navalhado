import { useCallback, useRef, useState } from 'react';
import { MENSAGEM_COTAR_TROCA_FALHOU, MENSAGEM_TROCAR_PLANO_FALHOU } from './errors';
import { assinaturaRepository } from './repositorio';
import type { CotacaoDaTroca, PagamentoDaTroca } from './types';
import { useAcaoDoGerente } from './useAcaoDoGerente';

const pedirTroca = (planoId: string, pagamento?: PagamentoDaTroca) => assinaturaRepository.trocarDePlano(planoId, pagamento);
const OPCOES_DA_TROCA = { rotulo: 'Erro ao trocar de plano', mensagemPadrao: MENSAGEM_TROCAR_PLANO_FALHOU };

/**
 * Cotar e fazer a troca de plano. `cotar` pede à função de cobrança a diferença proporcional e o valor mensal novo
 * (só mostra; não cobra nada). `trocar` troca o plano, cobrando a diferença no cartão do token quando há cobrança:
 * devolve o resultado, ou nulo se a troca foi recusada (o motivo fica em `erro`, pronto para mostrar ao Gerente).
 */
export function useTrocarDePlano() {
  const [cotacao, setCotacao] = useState<CotacaoDaTroca | null>(null);
  const [cotando, setCotando] = useState(false);
  const [erroDaCotacao, setErroDaCotacao] = useState<string | null>(null);
  const { executar: trocar, emAndamento: trocando, erro, limparErro } = useAcaoDoGerente(pedirTroca, OPCOES_DA_TROCA);
  // Só a cotação do último plano escolhido vale: a resposta atrasada de outro plano é ignorada.
  const pedido = useRef(0);

  const cotar = useCallback(async (planoId: string) => {
    const meuPedido = ++pedido.current;
    setCotacao(null);
    setErroDaCotacao(null);
    limparErro();
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
  }, [limparErro]);

  /** Esquece a cotação e os erros (o Gerente voltou à lista de planos ou fechou); uma cotação em andamento deixa de valer. */
  const limpar = useCallback(() => {
    pedido.current += 1;
    setCotacao(null);
    setCotando(false);
    setErroDaCotacao(null);
    limparErro();
  }, [limparErro]);

  return { cotar, cotacao, cotando, erroDaCotacao, trocar, trocando, erro, limpar };
}
