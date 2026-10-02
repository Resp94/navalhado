import { dataCurta } from '../assinatura/apresentacaoDaAssinatura';
import type { AcaoDoProprietario, AcessoDoTenant, AssinaturaDoTenant, DetalhesDoTenant } from './types';

export interface AcoesDisponiveis {
  estenderTeste: boolean;
  darCortesia: boolean;
  encerrarCortesia: boolean;
  desbloquear: boolean;
  bloquear: boolean;
}

/**
 * O que o Proprietário pode fazer com a barbearia, pela situação dela e pelo Estado de Acesso de hoje. É a mesma regra que as
 * funções do banco aplicam (e recusam quando não vale); aqui só decide o que a tela oferece. Sem assinatura não há nada: as funções
 * mexem na assinatura.
 */
export function acoesDisponiveis({ assinatura, acesso }: DetalhesDoTenant): AcoesDisponiveis {
  if (!assinatura) {
    return { estenderTeste: false, darCortesia: false, encerrarCortesia: false, desbloquear: false, bloquear: false };
  }

  const bloqueadaPeloTeste =
    assinatura.situacao === 'blocked' && (assinatura.motivoDoBloqueio === 'trial_expired' || assinatura.motivoDoBloqueio === 'courtesy_expired');

  return {
    estenderTeste: assinatura.situacao === 'trialing' || bloqueadaPeloTeste,
    darCortesia: true,
    encerrarCortesia: assinatura.situacao === 'courtesy',
    // Bloqueada de verdade, ou liberada à mão (um desbloqueio em vigor é de uma barbearia bloqueada: dá para mudar a data).
    desbloquear: acesso.nivel === 'blocked' || acesso.motivo === 'unblocked',
    // Quem ainda não está bloqueado, e quem está liberada à mão: bloquear de novo encerra o desbloqueio na hora (o banco o aceita;
    // numa bloqueada sem desbloqueio em vigor, "já está bloqueada").
    bloquear: assinatura.situacao !== 'blocked' || acesso.motivo === 'unblocked',
  };
}

/**
 * O limite de profissionais que o banco aplica à barbearia: o do plano, ou o do plano agendado se for menor (com uma descida
 * agendada o gatilho recusa o profissional acima do menor dos dois).
 */
export function limiteDeProfissionaisEmVigor({ plano, planoAgendado }: AssinaturaDoTenant): number {
  return Math.min(plano.limiteDeProfissionais, planoAgendado?.limiteDeProfissionais ?? plano.limiteDeProfissionais);
}

const ate = (data: Date | null, fuso: string): string => (data ? ` até ${dataCurta(data, fuso)}` : '');

/** O Estado de Acesso de hoje em uma frase, com as datas no fuso da barbearia. */
export function textoDoAcesso({ nivel, motivo, dataRelevante }: AcessoDoTenant, fuso: string): string {
  switch (motivo) {
    case 'trial':
      return nivel === 'warning' ? `Em teste, terminando${dataRelevante ? ` em ${dataCurta(dataRelevante, fuso)}` : ''}` : `Em teste${ate(dataRelevante, fuso)}`;
    case 'active':
      return 'Ativa';
    case 'courtesy':
      return `Em cortesia${ate(dataRelevante, fuso)}`;
    case 'payment_failed':
      if (nivel === 'blocked') return 'Bloqueada: pagamento recusado';
      return dataRelevante ? `Pagamento recusado: acesso${ate(dataRelevante, fuso)}` : 'Pagamento recusado';
    case 'canceled':
      if (nivel === 'blocked') return 'Bloqueada: assinatura cancelada';
      return dataRelevante ? `Cancelada: acesso${ate(dataRelevante, fuso)}` : 'Cancelada';
    case 'unblocked':
      return `Liberada à mão${ate(dataRelevante, fuso)}`;
    case 'trial_expired':
      return 'Bloqueada: teste vencido';
    case 'courtesy_expired':
      return 'Bloqueada: cortesia terminada';
    case 'refunded':
      return 'Bloqueada: pagamento estornado';
    case 'charged_back':
      return 'Bloqueada: pagamento contestado';
    case 'blocked':
      return 'Bloqueada à mão';
    case 'no_subscription':
      return 'Sem assinatura';
  }
}

const MOTIVOS_DO_BLOQUEIO: Record<string, string> = {
  trial_expired: 'Teste vencido',
  payment_failed: 'Pagamento recusado',
  canceled: 'Assinatura cancelada',
  courtesy_expired: 'Cortesia terminada',
  refunded: 'Pagamento estornado',
  charged_back: 'Pagamento contestado',
};

/** O motivo gravado no bloqueio; sem motivo de cobrança é o bloqueio que o Proprietário fez à mão. */
export function rotuloDoMotivoDoBloqueio(motivo: string | null): string {
  return motivo === null ? 'Bloqueio manual' : (MOTIVOS_DO_BLOQUEIO[motivo] ?? motivo);
}

const TIPOS_DE_AVISO: Record<string, string> = {
  trial_ending: 'Teste terminando',
  payment_failed_day0: 'Pagamento recusado (dia 0)',
  payment_failed_day3: 'Pagamento recusado (dia 3)',
  payment_failed_day4: 'Pagamento recusado (dia 4)',
  blocked: 'Acesso bloqueado',
};

export const rotuloDoTipoDeAviso = (tipo: string): string => TIPOS_DE_AVISO[tipo] ?? tipo;

const ACOES: Record<string, string> = {
  admin_extend_trial: 'Teste estendido',
  admin_set_courtesy: 'Cortesia marcada',
  admin_end_courtesy: 'Cortesia desmarcada',
  admin_unblock_tenant: 'Desbloqueio manual',
  admin_block_tenant: 'Bloqueio manual',
};

export const rotuloDaAcao = (acao: string): string => ACOES[acao] ?? acao;

const dataDoDetalhe = (valor: unknown, fuso: string): string | null =>
  typeof valor === 'string' && valor ? dataCurta(new Date(valor), fuso) : null;

/** O que a ação registrada mudou, em poucas palavras (as datas são o último dia, no fuso da barbearia). */
export function resumoDaAcao({ acao, detalhes }: AcaoDoProprietario, fuso: string): string {
  switch (acao) {
    case 'admin_unblock_tenant': {
      const dia = dataDoDetalhe(detalhes.unblocked_until, fuso);
      const motivo = typeof detalhes.reason === 'string' ? detalhes.reason : '';
      return [dia ? `até ${dia}` : '', motivo].filter(Boolean).join(': ');
    }
    case 'admin_block_tenant': {
      const motivo = typeof detalhes.reason === 'string' ? detalhes.reason : '';
      // O bloqueio de uma barbearia que já estava bloqueada, mas liberada à mão, encerrou o desbloqueio.
      return detalhes.ended_unblock_until ? ['encerrou o desbloqueio', motivo].filter(Boolean).join(': ') : motivo;
    }
    case 'admin_extend_trial': {
      const dia = dataDoDetalhe(detalhes.trial_ends_at, fuso);
      return dia ? `até ${dia}` : '';
    }
    case 'admin_set_courtesy': {
      const dia = dataDoDetalhe(detalhes.courtesy_ends_at, fuso);
      return dia ? `até ${dia}` : 'sem data de fim';
    }
    default:
      return '';
  }
}
