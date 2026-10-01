import { useCallback, useState } from 'react';
import { MENSAGEM_CANCELAR_FALHOU } from './errors';
import { assinaturaRepository } from './repositorio';

/**
 * Cancela a assinatura da barbearia. `cancelar` devolve se deu certo; se a função de cobrança recusou (o Mercado Pago não
 * respondeu, por exemplo), o motivo fica em `erro`, pronto para mostrar ao Gerente, e a assinatura segue como estava.
 */
export function useCancelarAssinatura() {
  const [cancelando, setCancelando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const cancelar = useCallback(async (): Promise<boolean> => {
    setCancelando(true);
    setErro(null);
    try {
      await assinaturaRepository.cancelarAssinatura();
      return true;
    } catch (err) {
      console.error('Erro ao cancelar a assinatura:', err instanceof Error ? err.message : 'erro');
      setErro(err instanceof Error ? err.message : MENSAGEM_CANCELAR_FALHOU);
      return false;
    } finally {
      setCancelando(false);
    }
  }, []);

  /** Esquece a recusa anterior (o Gerente fechou a pergunta). */
  const limparErro = useCallback(() => setErro(null), []);

  return { cancelar, cancelando, erro, limparErro };
}
