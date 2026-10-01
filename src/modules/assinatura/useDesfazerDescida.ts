import { useCallback } from 'react';
import { MENSAGEM_DESFAZER_DESCIDA_FALHOU } from './errors';
import { assinaturaRepository } from './repositorio';
import { useAcaoDoGerente } from './useAcaoDoGerente';

const pedirDesfazer = () => assinaturaRepository.desfazerDescidaDePlano();
const OPCOES = { rotulo: 'Erro ao desfazer a descida de plano', mensagemPadrao: MENSAGEM_DESFAZER_DESCIDA_FALHOU };

/**
 * Desfazer a descida de plano agendada. `desfazer` devolve se deu certo; se a função de cobrança recusou (o Mercado Pago não
 * aceitou o valor, por exemplo), o motivo fica em `erro`, pronto para mostrar ao Gerente, e a descida continua agendada.
 */
export function useDesfazerDescida() {
  const { executar, emAndamento, erro } = useAcaoDoGerente(pedirDesfazer, OPCOES);

  // A ação não devolve nada: deu certo é tudo que não for o nulo da falha.
  const desfazer = useCallback(async (): Promise<boolean> => (await executar()) !== null, [executar]);

  return { desfazer, desfazendo: emAndamento, erro };
}
