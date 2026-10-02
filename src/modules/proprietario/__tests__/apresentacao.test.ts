import { describe, expect, it } from 'vitest';
import type { SituacaoDaAssinatura } from '../../assinatura/situacaoDaAssinatura';
import type { MotivoDeAcesso } from '../../assinatura/types';
import {
  acoesDisponiveis,
  limiteDeProfissionaisEmVigor,
  resumoDaAcao,
  rotuloDaAcao,
  rotuloDoMotivoDoBloqueio,
  rotuloDoTipoDeAviso,
  textoDoAcesso,
} from '../apresentacao';
import type { AcaoDoProprietario, AcessoDoTenant, AssinaturaDoTenant, DetalhesDoTenant } from '../types';

const PLANO = { id: 'plano-maquina', nome: 'Máquina', preco: 89.9, limiteDeProfissionais: 5 };

const assinatura = (situacao: SituacaoDaAssinatura, extra: Partial<AssinaturaDoTenant> = {}): AssinaturaDoTenant => ({
  situacao,
  plano: PLANO,
  planoAgendado: null,
  testeAte: null,
  periodoDesde: null,
  periodoAte: null,
  primeiraRecusaEm: null,
  bloqueadaEm: null,
  motivoDoBloqueio: null,
  canceladaEm: null,
  cortesiaAte: null,
  desbloqueadaAte: null,
  assinaturaNoMercadoPago: null,
  cartao: null,
  ...extra,
});

const acesso = (nivel: AcessoDoTenant['nivel'], motivo: MotivoDeAcesso, dataRelevante: Date | null = null): AcessoDoTenant => ({ nivel, motivo, dataRelevante });

const detalhes = (sub: AssinaturaDoTenant | null, estado: AcessoDoTenant): DetalhesDoTenant => ({
  barbearia: { id: 't1', nome: 'Alpha', email: 'a@exemplo.com', telefone: '92999990001', fuso: 'America/Manaus', criadaEm: new Date('2026-01-10T15:30:00Z') },
  assinatura: sub,
  acesso: estado,
  profissionaisAtivos: 1,
  cobrancas: [],
  desbloqueio: null,
  acoes: [],
});

describe('acoesDisponiveis', () => {
  const todas = { estenderTeste: false, darCortesia: false, encerrarCortesia: false, desbloquear: false, bloquear: false };

  it('a barbearia sem assinatura não tem nada a fazer: as funções do banco precisam de uma', () => {
    expect(acoesDisponiveis(detalhes(null, acesso('allowed', 'no_subscription')))).toEqual(todas);
  });

  it.each<[string, DetalhesDoTenant, Partial<typeof todas>]>([
    ['em teste', detalhes(assinatura('trialing'), acesso('allowed', 'trial')), { estenderTeste: true, darCortesia: true, bloquear: true }],
    ['ativa', detalhes(assinatura('active'), acesso('allowed', 'active')), { darCortesia: true, bloquear: true }],
    ['cancelada com o período pago pela frente', detalhes(assinatura('canceled'), acesso('warning', 'canceled')), { darCortesia: true, bloquear: true }],
    ['em cortesia', detalhes(assinatura('courtesy'), acesso('allowed', 'courtesy')), { darCortesia: true, encerrarCortesia: true, bloquear: true }],
    [
      'bloqueada pelo teste vencido',
      detalhes(assinatura('blocked', { motivoDoBloqueio: 'trial_expired' }), acesso('blocked', 'trial_expired')),
      { estenderTeste: true, darCortesia: true, desbloquear: true },
    ],
    [
      'bloqueada pela cortesia vencida',
      detalhes(assinatura('blocked', { motivoDoBloqueio: 'courtesy_expired' }), acesso('blocked', 'courtesy_expired')),
      { estenderTeste: true, darCortesia: true, desbloquear: true },
    ],
    [
      'bloqueada por estorno',
      detalhes(assinatura('blocked', { motivoDoBloqueio: 'refunded' }), acesso('blocked', 'refunded')),
      { darCortesia: true, desbloquear: true },
    ],
    ['bloqueada à mão', detalhes(assinatura('blocked'), acesso('blocked', 'blocked')), { darCortesia: true, desbloquear: true }],
    [
      'com o pagamento recusado há mais de 5 dias (a rotina ainda não gravou o bloqueio)',
      detalhes(assinatura('past_due'), acesso('blocked', 'payment_failed')),
      { darCortesia: true, desbloquear: true, bloquear: true },
    ],
    [
      'com o teste vencido que a rotina ainda não bloqueou (a situação segue em teste)',
      detalhes(assinatura('trialing'), acesso('blocked', 'trial_expired')),
      { estenderTeste: true, darCortesia: true, desbloquear: true, bloquear: true },
    ],
    [
      // Bloquear de novo encerra o desbloqueio na hora (o banco aceita; sem o desbloqueio, "já está bloqueada").
      'bloqueada e desbloqueada à mão: dá para mudar a data e para encerrar o desbloqueio',
      detalhes(assinatura('blocked', { motivoDoBloqueio: 'refunded', desbloqueadaAte: new Date('2040-03-11T02:59:59.999Z') }), acesso('warning', 'unblocked')),
      { darCortesia: true, desbloquear: true, bloquear: true },
    ],
  ])('%s', (_caso, entrada, esperado) => {
    expect(acoesDisponiveis(entrada)).toEqual({ ...todas, ...esperado });
  });
});

describe('limiteDeProfissionaisEmVigor', () => {
  const tesoura = { id: 'plano-tesoura', nome: 'Tesoura', preco: 59.9, limiteDeProfissionais: 1 };
  const bancada = { id: 'plano-bancada', nome: 'Bancada', preco: 159.9, limiteDeProfissionais: 10 };

  it('é o limite do plano da assinatura', () => {
    expect(limiteDeProfissionaisEmVigor(assinatura('active'))).toBe(5);
  });

  it('com uma descida agendada vale o menor limite entre o plano atual e o agendado (o gatilho do banco recusa acima dele)', () => {
    expect(limiteDeProfissionaisEmVigor(assinatura('active', { plano: bancada, planoAgendado: PLANO }))).toBe(5);
    expect(limiteDeProfissionaisEmVigor(assinatura('active', { planoAgendado: tesoura }))).toBe(1);
  });
});

describe('textoDoAcesso', () => {
  const FUSO = 'America/Manaus';

  it.each<[AcessoDoTenant, string]>([
    [acesso('allowed', 'trial'), 'Em teste'],
    [acesso('allowed', 'trial', new Date('2026-10-20T20:00:00Z')), 'Em teste até 20/10'],
    [acesso('warning', 'trial', new Date('2026-10-14T20:00:00Z')), 'Em teste, terminando em 14/10'],
    [acesso('allowed', 'active'), 'Ativa'],
    [acesso('allowed', 'courtesy'), 'Em cortesia'],
    [acesso('allowed', 'courtesy', new Date('2040-07-01T03:59:59.999Z')), 'Em cortesia até 30/06'],
    [acesso('warning', 'payment_failed', new Date('2026-10-03T15:00:00Z')), 'Pagamento recusado: acesso até 03/10'],
    [acesso('warning', 'canceled', new Date('2026-10-29T23:26:22Z')), 'Cancelada: acesso até 29/10'],
    [acesso('warning', 'unblocked', new Date('2040-03-11T03:59:59.999Z')), 'Liberada à mão até 10/03'],
    [acesso('blocked', 'trial_expired'), 'Bloqueada: teste vencido'],
    [acesso('blocked', 'payment_failed'), 'Bloqueada: pagamento recusado'],
    [acesso('blocked', 'canceled'), 'Bloqueada: assinatura cancelada'],
    [acesso('blocked', 'courtesy_expired'), 'Bloqueada: cortesia terminada'],
    [acesso('blocked', 'refunded'), 'Bloqueada: pagamento estornado'],
    [acesso('blocked', 'charged_back'), 'Bloqueada: pagamento contestado'],
    [acesso('blocked', 'blocked'), 'Bloqueada à mão'],
    [acesso('allowed', 'no_subscription'), 'Sem assinatura'],
  ])('%j', (entrada, texto) => {
    expect(textoDoAcesso(entrada, FUSO)).toBe(texto);
  });

  it('sem a data relevante não inventa uma', () => {
    expect(textoDoAcesso(acesso('warning', 'unblocked'), FUSO)).toBe('Liberada à mão');
    expect(textoDoAcesso(acesso('warning', 'canceled'), FUSO)).toBe('Cancelada');
  });
});

describe('rótulos', () => {
  it('o motivo do bloqueio gravado, em português; o bloqueio manual não tem motivo de cobrança', () => {
    expect(rotuloDoMotivoDoBloqueio('trial_expired')).toBe('Teste vencido');
    expect(rotuloDoMotivoDoBloqueio('payment_failed')).toBe('Pagamento recusado');
    expect(rotuloDoMotivoDoBloqueio('canceled')).toBe('Assinatura cancelada');
    expect(rotuloDoMotivoDoBloqueio('courtesy_expired')).toBe('Cortesia terminada');
    expect(rotuloDoMotivoDoBloqueio('refunded')).toBe('Pagamento estornado');
    expect(rotuloDoMotivoDoBloqueio('charged_back')).toBe('Pagamento contestado');
    expect(rotuloDoMotivoDoBloqueio(null)).toBe('Bloqueio manual');
  });

  it('o tipo de aviso por e-mail', () => {
    expect(rotuloDoTipoDeAviso('trial_ending')).toBe('Teste terminando');
    expect(rotuloDoTipoDeAviso('payment_failed_day0')).toBe('Pagamento recusado (dia 0)');
    expect(rotuloDoTipoDeAviso('payment_failed_day3')).toBe('Pagamento recusado (dia 3)');
    expect(rotuloDoTipoDeAviso('payment_failed_day4')).toBe('Pagamento recusado (dia 4)');
    expect(rotuloDoTipoDeAviso('blocked')).toBe('Acesso bloqueado');
    expect(rotuloDoTipoDeAviso('algo_novo')).toBe('algo_novo');
  });

  it('cada ação registrada tem um nome', () => {
    expect(rotuloDaAcao('admin_extend_trial')).toBe('Teste estendido');
    expect(rotuloDaAcao('admin_set_courtesy')).toBe('Cortesia marcada');
    expect(rotuloDaAcao('admin_end_courtesy')).toBe('Cortesia desmarcada');
    expect(rotuloDaAcao('admin_unblock_tenant')).toBe('Desbloqueio manual');
    expect(rotuloDaAcao('admin_block_tenant')).toBe('Bloqueio manual');
    expect(rotuloDaAcao('admin_nova')).toBe('admin_nova');
  });
});

describe('resumoDaAcao', () => {
  const acao = (nome: string, detalhesDaAcao: Record<string, unknown>): AcaoDoProprietario => ({ acao: nome, em: new Date('2026-10-02T12:00:00Z'), por: 'Dono', detalhes: detalhesDaAcao });
  const FUSO = 'America/Manaus';

  it('o desbloqueio mostra até quando e o motivo', () => {
    expect(resumoDaAcao(acao('admin_unblock_tenant', { reason: 'o cliente paga na segunda', unblocked_until: '2040-03-11T03:59:59.999999+00:00' }), FUSO)).toBe(
      'até 10/03: o cliente paga na segunda',
    );
  });

  it('o bloqueio manual mostra o motivo', () => {
    expect(resumoDaAcao(acao('admin_block_tenant', { reason: 'uso indevido', previous_status: 'active' }), FUSO)).toBe('uso indevido');
  });

  it('o bloqueio que encerrou um desbloqueio diz isso, com o motivo', () => {
    expect(
      resumoDaAcao(
        acao('admin_block_tenant', { reason: 'o estorno foi contestado', previous_status: 'blocked', ended_unblock_until: '2040-03-11T02:59:59.999999+00:00' }),
        FUSO,
      ),
    ).toBe('encerrou o desbloqueio: o estorno foi contestado');
  });

  it('o teste estendido mostra até quando', () => {
    expect(resumoDaAcao(acao('admin_extend_trial', { trial_ends_at: '2040-03-11T03:59:59.999999+00:00' }), FUSO)).toBe('até 10/03');
  });

  it('a cortesia mostra o fim, ou que não tem', () => {
    expect(resumoDaAcao(acao('admin_set_courtesy', { courtesy_ends_at: '2040-07-01T03:59:59.999999+00:00' }), FUSO)).toBe('até 30/06');
    expect(resumoDaAcao(acao('admin_set_courtesy', { courtesy_ends_at: null }), FUSO)).toBe('sem data de fim');
  });

  it('desmarcar a cortesia não tem o que resumir', () => {
    expect(resumoDaAcao(acao('admin_end_courtesy', {}), FUSO)).toBe('');
  });

  it('uma ação que o front não conhece fica sem resumo', () => {
    expect(resumoDaAcao(acao('admin_nova', { qualquer: 1 }), FUSO)).toBe('');
  });
});
