import { useCallback } from 'react';
import { MENSAGEM_CANCELAR_FALHOU } from './errors';
import { assinaturaRepository } from './repositorio';
import { useAcaoDoGerente } from './useAcaoDoGerente';

const pedirCancelamento = () => assinaturaRepository.cancelarAssinatura();
const OPCOES = { rotulo: 'Erro ao cancelar a assinatura', mensagemPadrao: MENSAGEM_CANCELAR_FALHOU };

/**
 * Cancela a assinatura da barbearia. `cancelar` devolve se deu certo; se a função de cobrança recusou (o Mercado Pago não
 * respondeu, por exemplo), o motivo fica em `erro`, pronto para mostrar ao Gerente, e a assinatura segue como estava.
 * `limparErro` esquece a recusa anterior (o Gerente fechou a pergunta).
 */
export function useCancelarAssinatura() {
  const { executar, emAndamento, erro, limparErro } = useAcaoDoGerente(pedirCancelamento, OPCOES);

  // A ação não devolve nada: deu certo é tudo que não for o nulo da falha.
  const cancelar = useCallback(async (): Promise<boolean> => (await executar()) !== null, [executar]);

  return { cancelar, cancelando: emAndamento, erro, limparErro };
}
