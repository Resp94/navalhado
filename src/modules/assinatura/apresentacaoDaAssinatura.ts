import { pluralizar } from '../../lib/plural';
import { rotuloDaSituacao } from './situacaoDaAssinatura';
import type { CartaoDaAssinatura, Cobranca, DetalhesDaAssinatura } from './types';

const FUSO_PADRAO = 'America/Sao_Paulo';

const dataCurta = (data: Date, timezone: string): string =>
  data.toLocaleDateString('pt-BR', { timeZone: timezone, day: '2-digit', month: '2-digit' });

/** DD/MM/AAAA no fuso da barbearia (Brasília, se não houver outro). */
export const dataCompleta = (data: Date, timezone: string = FUSO_PADRAO): string =>
  data.toLocaleDateString('pt-BR', { timeZone: timezone });

/** A situação da assinatura em linguagem de gente. `diasRestantes` é a contagem do teste, se houver. */
export function descreverSituacao(
  assinatura: DetalhesDaAssinatura,
  diasRestantes: number | null,
  timezone: string = FUSO_PADRAO,
): string {
  const rotulo = rotuloDaSituacao(assinatura.situacao);

  switch (assinatura.situacao) {
    case 'trialing': {
      if (!assinatura.testeAte) return rotulo;
      const ate = `${rotulo} até ${dataCurta(assinatura.testeAte, timezone)}`;
      if (!diasRestantes) return ate;
      return `${ate} (${pluralizar(diasRestantes, 'resta', 'restam')} ${diasRestantes} ${pluralizar(diasRestantes, 'dia', 'dias')})`;
    }
    case 'canceled':
      return assinatura.periodoAte ? `${rotulo} até ${dataCurta(assinatura.periodoAte, timezone)}` : rotulo;
    case 'courtesy':
      return assinatura.cortesiaAte ? `${rotulo} até ${dataCurta(assinatura.cortesiaAte, timezone)}` : rotulo;
    case 'active':
    case 'past_due':
    case 'blocked':
      return rotulo;
  }
}

/**
 * Em teste com o cartão já autorizado no Mercado Pago: a bandeira só é gravada na autorização, e a
 * primeira cobrança está marcada para o fim do teste. A situação continua "em teste" até ela ser paga.
 */
export const autorizadaEmTeste = (assinatura: DetalhesDaAssinatura): boolean =>
  assinatura.situacao === 'trialing' && assinatura.cartao !== null;

/** O pagamento já aparece na assinatura: ativa, ou em teste com o cartão autorizado. */
export const pagamentoConfirmado = (assinatura: DetalhesDaAssinatura): boolean =>
  assinatura.situacao === 'active' || autorizadaEmTeste(assinatura);

/**
 * A próxima mensalidade, sempre no futuro: data que já passou quer dizer que a cobrança ainda não
 * foi processada (aviso do Mercado Pago atrasado), e uma data vencida na tela confunde. Ativa: no fim
 * do período pago. Em teste: só depois de o cartão ser autorizado (a primeira cobrança sai no fim do
 * teste). Recusada, cancelada, cortesia e bloqueada não têm cobrança marcada.
 */
export function proximaCobranca(
  assinatura: DetalhesDaAssinatura,
  agora: Date = new Date(),
): { data: Date; valor: number } | null {
  const valor = assinatura.plano.preco;
  const data =
    assinatura.situacao === 'active' ? assinatura.periodoAte : autorizadaEmTeste(assinatura) ? assinatura.testeAte : null;

  return data && data.getTime() > agora.getTime() ? { data, valor } : null;
}

const BANDEIRAS: Record<string, string> = {
  visa: 'Visa',
  master: 'Mastercard',
  elo: 'Elo',
  amex: 'American Express',
  hipercard: 'Hipercard',
  debvisa: 'Visa débito',
  debmaster: 'Mastercard débito',
  debelo: 'Elo débito',
  account_money: 'Saldo da conta Mercado Pago',
};

const nomeDaBandeira = (bandeira: string): string =>
  BANDEIRAS[bandeira] ?? bandeira.charAt(0).toUpperCase() + bandeira.slice(1);

/** "Visa final 5682". Só a bandeira quando o final ainda não chegou; nulo sem cartão. */
export function rotuloDoCartao(cartao: CartaoDaAssinatura | null): string | null {
  if (!cartao || (!cartao.bandeira && !cartao.final)) return null;
  const nome = cartao.bandeira ? nomeDaBandeira(cartao.bandeira) : 'Cartão';
  return cartao.final ? `${nome} final ${cartao.final}` : nome;
}

const SITUACOES_DA_COBRANCA: Record<string, string> = {
  approved: 'Paga',
  pending: 'Pendente',
  in_process: 'Pendente',
  rejected: 'Recusada',
  cancelled: 'Cancelada',
  refunded: 'Estornada',
  charged_back: 'Contestada',
};

/** O que o Mercado Pago diz do pagamento, em português. Situação nova, que não conhecemos, fica "Em análise". */
export function rotuloDaSituacaoDaCobranca(situacao: string): string {
  return SITUACOES_DA_COBRANCA[situacao] ?? 'Em análise';
}

export function rotuloDoTipoDaCobranca(tipo: Cobranca['tipo']): string {
  return tipo === 'upgrade' ? 'Diferença de plano' : 'Mensalidade';
}
