import { pluralizar } from '../../lib/plural';
import { rotuloDaSituacao } from './situacaoDaAssinatura';
import type { AssinaturaCancelavel, CartaoDaAssinatura, Cobranca, DetalhesDaAssinatura } from './types';

const FUSO_PADRAO = 'America/Sao_Paulo';

/** DD/MM no fuso da barbearia (Brasília, se não houver outro). */
export const dataCurta = (data: Date, timezone: string = FUSO_PADRAO): string =>
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
    case 'canceled': {
      if (!assinatura.periodoAte) return rotulo;
      const ate = `${rotulo} até ${dataCurta(assinatura.periodoAte, timezone)}`;
      return assinatura.assinaturaNovaAutorizada ? `${ate}, com a assinatura nova autorizada` : ate;
    }
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

/**
 * O pagamento já aparece na assinatura: ativa, em teste com o cartão autorizado, ou cancelada que já assinou de novo e teve a
 * assinatura nova autorizada (a cobrança dela só vem no fim do período pago).
 */
export const pagamentoConfirmado = (assinatura: DetalhesDaAssinatura): boolean =>
  assinatura.situacao === 'active' || autorizadaEmTeste(assinatura) || assinatura.assinaturaNovaAutorizada;

/**
 * Há uma assinatura cobrando no cartão no Mercado Pago: ativa, recusada ou em teste já autorizada. Só nela se troca o cartão; as
 * outras situações não têm cobrança (cancelada, cortesia, bloqueada) ou ainda não têm assinatura lá (teste sem cartão).
 */
export const temCobrancaNoCartao = (assinatura: DetalhesDaAssinatura): boolean =>
  assinatura.situacao === 'active' || assinatura.situacao === 'past_due' || autorizadaEmTeste(assinatura);

/**
 * Há o que cancelar na tela Assinatura: a assinatura que cobra no cartão e a assinatura nova que a cancelada autorizou de novo.
 * (A bloqueada que ainda tem assinatura viva cancela pela tela de bloqueio.)
 */
export const podeCancelar = (assinatura: DetalhesDaAssinatura): boolean =>
  temCobrancaNoCartao(assinatura) || assinatura.assinaturaNovaAutorizada;

/**
 * Até quando o acesso continua se a assinatura for cancelada agora: o fim do período já pago, ou do teste. Nulo quando não há mais
 * período a esperar (a recusa vem na renovação, quando o período pago já acabou): o acesso é bloqueado na hora, e a tela precisa
 * dizer isso antes de o Gerente confirmar. É a mesma regra do Estado de Acesso da cancelada, calculada no banco.
 */
export function fimDoAcessoAoCancelar(assinatura: AssinaturaCancelavel, agora: Date = new Date()): Date | null {
  const fim = assinatura.situacao === 'trialing' ? assinatura.testeAte : assinatura.periodoAte;
  return fim && fim.getTime() > agora.getTime() ? fim : null;
}

/**
 * A próxima mensalidade, sempre no futuro: data que já passou quer dizer que a cobrança ainda não
 * foi processada (aviso do Mercado Pago atrasado), e uma data vencida na tela confunde. Ativa: no fim
 * do período pago. Em teste: só depois de o cartão ser autorizado (a primeira cobrança sai no fim do
 * teste). Cancelada que assinou de novo: no fim do período pago, onde a assinatura nova começa a cobrar.
 * Recusada, cancelada (sem assinatura nova), cortesia e bloqueada não têm cobrança marcada.
 */
export function proximaCobranca(
  assinatura: DetalhesDaAssinatura,
  agora: Date = new Date(),
): { data: Date; valor: number } | null {
  // Com uma descida agendada, a próxima cobrança já é a do plano menor: o valor da assinatura no Mercado Pago mudou ao agendar.
  const valor = assinatura.planoAgendado?.preco ?? assinatura.plano.preco;
  const data =
    assinatura.situacao === 'active' || assinatura.assinaturaNovaAutorizada
      ? assinatura.periodoAte
      : autorizadaEmTeste(assinatura)
        ? assinatura.testeAte
        : null;

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
