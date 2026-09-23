import { useCallback, useState } from 'react';
import { isValidEmailFormat, verifyEmailDomain } from './email';

const MSG_FORMATO_INVALIDO = 'O formato do e-mail é inválido.';
const MSG_SEM_MX = 'Este domínio não recebe e-mails.';

/**
 * Hook de validação de e-mail compartilhado pelos formulários (spec 047).
 * Dois momentos, como decidido no design:
 * - `validarAoSair`: confere formato (síncrono) e, se válido, o domínio
 *   (assíncrono), atualizando `erro` para exibição inline.
 * - `validarParaSalvar`: confere tudo e devolve a mensagem de erro ('' =
 *   pode salvar). Bloqueia formato inválido e domínio sem MX; libera
 *   quando a consulta de domínio está indisponível.
 * Campo vazio nunca dispara nada (e-mail opcional é decisão da tela).
 */
export function useValidacaoEmail() {
  const [erro, setErro] = useState('');
  const [validando, setValidando] = useState(false);

  const validar = useCallback(async (email: string): Promise<string> => {
    const trimmed = email.trim();
    if (!trimmed) return '';
    if (!isValidEmailFormat(trimmed)) return MSG_FORMATO_INVALIDO;

    const dominio = trimmed.split('@')[1] || '';
    const resultado = await verifyEmailDomain(dominio);
    return resultado === 'sem_mx' ? MSG_SEM_MX : '';
  }, []);

  const validarAoSair = useCallback(
    (email: string) => {
      const trimmed = email.trim();
      if (!trimmed) {
        setErro('');
        return;
      }
      if (!isValidEmailFormat(trimmed)) {
        setErro(MSG_FORMATO_INVALIDO);
        return;
      }
      setValidando(true);
      validar(email)
        .then(setErro)
        .finally(() => setValidando(false));
    },
    [validar]
  );

  const validarParaSalvar = useCallback(
    async (email: string): Promise<string> => {
      const msg = await validar(email);
      setErro(msg);
      return msg;
    },
    [validar]
  );

  return { erro, validando, validarAoSair, validarParaSalvar };
}
