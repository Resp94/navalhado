import { useCallback, useState } from 'react';
import { MENSAGEM_DESFAZER_DESCIDA_FALHOU } from './errors';
import { assinaturaRepository } from './repositorio';

/**
 * Desfazer a descida de plano agendada. `desfazer` devolve se deu certo; se a função de cobrança recusou (o Mercado Pago não
 * aceitou o valor, por exemplo), o motivo fica em `erro`, pronto para mostrar ao Gerente, e a descida continua agendada.
 */
export function useDesfazerDescida() {
  const [desfazendo, setDesfazendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const desfazer = useCallback(async (): Promise<boolean> => {
    setDesfazendo(true);
    setErro(null);
    try {
      await assinaturaRepository.desfazerDescidaDePlano();
      return true;
    } catch (err) {
      console.error('Erro ao desfazer a descida de plano:', err instanceof Error ? err.message : 'erro');
      setErro(err instanceof Error ? err.message : MENSAGEM_DESFAZER_DESCIDA_FALHOU);
      return false;
    } finally {
      setDesfazendo(false);
    }
  }, []);

  return { desfazer, desfazendo, erro };
}
