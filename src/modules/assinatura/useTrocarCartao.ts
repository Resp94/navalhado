import { useCallback, useState } from 'react';
import { MENSAGEM_TROCAR_CARTAO_FALHOU } from './errors';
import { assinaturaRepository } from './repositorio';
import type { CartaoTrocado } from './types';

/**
 * Troca o cartão da assinatura pelo token gerado nos campos seguros do Mercado Pago. Só o token e os
 * 4 últimos dígitos (que o Gerente reconhece na tela) passam por aqui. Devolve o cartão novo, ou nulo
 * se a troca foi recusada (o motivo fica em `erro`, pronto para mostrar ao Gerente).
 */
export function useTrocarCartao() {
  const [trocando, setTrocando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const trocar = useCallback(async (token: string, final: string | null = null): Promise<CartaoTrocado | null> => {
    setTrocando(true);
    setErro(null);
    try {
      return await assinaturaRepository.trocarCartao(token, final);
    } catch (err) {
      console.error('Erro ao trocar o cartão da assinatura:', err instanceof Error ? err.message : 'erro');
      setErro(err instanceof Error ? err.message : MENSAGEM_TROCAR_CARTAO_FALHOU);
      return null;
    } finally {
      setTrocando(false);
    }
  }, []);

  /** Esquece a recusa anterior (o Gerente fechou o formulário). */
  const limparErro = useCallback(() => setErro(null), []);

  return { trocar, trocando, erro, limparErro };
}
