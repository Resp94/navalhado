import { useCallback } from 'react';
import { MENSAGEM_TROCAR_CARTAO_FALHOU } from './errors';
import { assinaturaRepository } from './repositorio';
import type { CartaoTrocado } from './types';
import { useAcaoDoGerente } from './useAcaoDoGerente';

const pedirTroca = (token: string, final: string | null) => assinaturaRepository.trocarCartao(token, final);
const OPCOES = { rotulo: 'Erro ao trocar o cartão da assinatura', mensagemPadrao: MENSAGEM_TROCAR_CARTAO_FALHOU };

/**
 * Troca o cartão da assinatura pelo token gerado nos campos seguros do Mercado Pago. Só o token e os
 * 4 últimos dígitos (que o Gerente reconhece na tela) passam por aqui. Devolve o cartão novo, ou nulo
 * se a troca foi recusada (o motivo fica em `erro`, pronto para mostrar ao Gerente).
 */
export function useTrocarCartao() {
  const { executar, emAndamento, erro, limparErro } = useAcaoDoGerente(pedirTroca, OPCOES);

  const trocar = useCallback(
    (token: string, final: string | null = null): Promise<CartaoTrocado | null> => executar(token, final),
    [executar],
  );

  return { trocar, trocando: emAndamento, erro, limparErro };
}
