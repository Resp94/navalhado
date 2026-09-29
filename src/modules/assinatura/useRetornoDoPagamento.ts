import { useEffect } from 'react';

/** De quanto em quanto tempo o estado é relido enquanto o pagamento é confirmado. */
export const INTERVALO_DA_CONFIRMACAO_MS = 5_000;
/** Dois minutos de espera (24 x 5 s): depois disso, o botão de atualizar é o caminho. */
export const LIMITE_DE_TENTATIVAS = 24;

/**
 * O Gerente volta da página do Mercado Pago em `/configuracoes?assinatura=retorno`, mas o
 * webhook pode chegar depois do redirecionamento. Enquanto a URL traz esse retorno e a barbearia
 * continua bloqueada, relê o estado a cada poucos segundos, por um tempo limitado. Devolve se o
 * Gerente está voltando de um pagamento, para a tela avisar que a confirmação está em andamento.
 */
export function useRetornoDoPagamento(search: string, bloqueado: boolean, recarregar: () => void): boolean {
  const aguardando = new URLSearchParams(search).get('assinatura') === 'retorno';

  useEffect(() => {
    if (!aguardando || !bloqueado) return;

    let tentativas = 0;
    const intervalo = setInterval(() => {
      tentativas += 1;
      recarregar();
      if (tentativas >= LIMITE_DE_TENTATIVAS) clearInterval(intervalo);
    }, INTERVALO_DA_CONFIRMACAO_MS);

    return () => clearInterval(intervalo);
  }, [aguardando, bloqueado, recarregar]);

  return aguardando;
}
