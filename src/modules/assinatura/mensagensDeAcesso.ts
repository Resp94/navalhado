import { pluralizar } from '../../lib/plural';
import type { EstadoDeAcesso, MotivoDeAcesso, PerfilNoBloqueio } from './types';

const TITULO_GENERICO = 'O acesso da sua barbearia está suspenso';

const TITULOS: Partial<Record<MotivoDeAcesso, string>> = {
  trial_expired: 'Seu período de teste terminou',
  payment_failed: 'O pagamento da assinatura não foi aprovado',
  canceled: 'Sua assinatura foi cancelada',
  courtesy_expired: 'A cortesia da sua barbearia terminou',
};

export function tituloDoBloqueio(motivo: MotivoDeAcesso): string {
  return TITULOS[motivo] ?? TITULO_GENERICO;
}

const DADOS_GUARDADOS = 'Os dados da sua barbearia continuam guardados.';

/**
 * O Gerente pode resolver e o caminho depende do motivo: recusa pede o cartão da
 * assinatura que já existe; cancelamento pede uma assinatura nova. O Barbeiro só
 * precisa saber a quem recorrer.
 */
export function explicacaoDoBloqueio(motivo: MotivoDeAcesso, perfil: PerfilNoBloqueio): string {
  if (perfil === 'barbeiro') {
    return 'O acesso da barbearia ao Navalhado está suspenso. Fale com o gerente da barbearia para saber como regularizar.';
  }
  if (motivo === 'payment_failed') {
    return `Atualize o cartão da sua assinatura para voltar a usar o Navalhado. ${DADOS_GUARDADOS}`;
  }
  if (motivo === 'canceled') {
    return `Sua assinatura foi cancelada e o período pago acabou. Assine um plano de novo para voltar a usar o Navalhado. ${DADOS_GUARDADOS}`;
  }
  return `Assine um plano para voltar a usar o Navalhado. ${DADOS_GUARDADOS}`;
}

/** Texto da faixa de aviso. `dias` é a contagem até a data relevante; nulo se não houver. */
export function mensagemDoAviso(estado: EstadoDeAcesso, dias: number | null): string {
  const contagem = dias === null ? null : `${dias} ${pluralizar(dias, 'dia', 'dias')}`;

  if (estado.motivo === 'payment_failed') {
    const prazo = contagem ? `O acesso será bloqueado em ${contagem}.` : 'O acesso será bloqueado em breve.';
    return `O pagamento da sua assinatura foi recusado. ${prazo}`;
  }

  return contagem
    ? `Seu período de teste termina em ${contagem}.`
    : 'Seu período de teste está terminando.';
}
