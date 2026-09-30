import { describe, expect, it } from 'vitest';
import {
  autorizadaEmTeste,
  dataCompleta,
  descreverSituacao,
  pagamentoConfirmado,
  proximaCobranca,
  rotuloDoCartao,
  rotuloDaSituacaoDaCobranca,
  rotuloDoTipoDaCobranca,
} from '../apresentacaoDaAssinatura';
import type { DetalhesDaAssinatura } from '../types';

// Spec 052, ticket 06: o texto que a tela Assinatura mostra, em linguagem de gente.

const base: DetalhesDaAssinatura = {
  situacao: 'active',
  plano: { id: 'plano-tesoura', nome: 'Tesoura', preco: 59.9 },
  planoAgendado: null,
  testeAte: null,
  periodoAte: null,
  cortesiaAte: null,
  cartao: null,
};

const com = (parcial: Partial<DetalhesDaAssinatura>): DetalhesDaAssinatura => ({ ...base, ...parcial });

describe('descreverSituacao', () => {
  it('em teste: a data do fim e os dias que restam', () => {
    const teste = com({ situacao: 'trialing', testeAte: new Date('2026-10-14T23:00:00Z') });

    expect(descreverSituacao(teste, 10)).toBe('Em teste até 14/10 (restam 10 dias)');
  });

  it('em teste no último dia: fala em 1 dia, no singular', () => {
    const teste = com({ situacao: 'trialing', testeAte: new Date('2026-10-14T23:00:00Z') });

    expect(descreverSituacao(teste, 1)).toBe('Em teste até 14/10 (resta 1 dia)');
  });

  it('em teste sem data conhecida: só diz que está em teste', () => {
    expect(descreverSituacao(com({ situacao: 'trialing' }), null)).toBe('Em teste');
  });

  it('a data é a do horário de Brasília, não a do UTC', () => {
    // 01:00 UTC de 15/10 ainda é 22:00 de 14/10 em Brasília.
    const teste = com({ situacao: 'trialing', testeAte: new Date('2026-10-15T01:00:00Z') });

    expect(descreverSituacao(teste, 2)).toContain('14/10');
  });

  it('em teste sem dias para contar (0): só a data', () => {
    const teste = com({ situacao: 'trialing', testeAte: new Date('2026-10-14T23:00:00Z') });

    expect(descreverSituacao(teste, 0)).toBe('Em teste até 14/10');
  });

  it('ativa', () => {
    expect(descreverSituacao(base, null)).toBe('Ativa');
  });

  it('pagamento recusado', () => {
    expect(descreverSituacao(com({ situacao: 'past_due' }), null)).toBe('Pagamento recusado');
  });

  it('cancelada: até quando o acesso vale', () => {
    const cancelada = com({ situacao: 'canceled', periodoAte: new Date('2026-10-20T15:00:00Z') });

    expect(descreverSituacao(cancelada, null)).toBe('Cancelada até 20/10');
  });

  it('cancelada sem fim de período conhecido', () => {
    expect(descreverSituacao(com({ situacao: 'canceled' }), null)).toBe('Cancelada');
  });

  it('cortesia, com ou sem data de fim', () => {
    expect(descreverSituacao(com({ situacao: 'courtesy' }), null)).toBe('Cortesia');
    expect(
      descreverSituacao(com({ situacao: 'courtesy', cortesiaAte: new Date('2026-12-31T15:00:00Z') }), null),
    ).toBe('Cortesia até 31/12');
  });

  it('bloqueada', () => {
    expect(descreverSituacao(com({ situacao: 'blocked' }), null)).toBe('Bloqueada');
  });
});

describe('fuso da barbearia', () => {
  // 03:30 UTC de 30/10: 00:30 em Brasília (UTC-3), 23:30 do dia 29 em Manaus (UTC-4).
  const instante = new Date('2026-10-30T03:30:00Z');

  it('dataCompleta usa Brasília quando não há outro fuso', () => {
    expect(dataCompleta(new Date('2026-10-29T23:26:22Z'))).toBe('29/10/2026');
    expect(dataCompleta(instante)).toBe('30/10/2026');
  });

  it('dataCompleta usa o fuso da barbearia', () => {
    expect(dataCompleta(instante, 'America/Manaus')).toBe('29/10/2026');
  });

  it('a situação também usa o fuso da barbearia', () => {
    const cancelada = com({ situacao: 'canceled', periodoAte: instante });

    expect(descreverSituacao(cancelada, null)).toBe('Cancelada até 30/10');
    expect(descreverSituacao(cancelada, null, 'America/Manaus')).toBe('Cancelada até 29/10');
  });
});

describe('autorizadaEmTeste e pagamentoConfirmado', () => {
  const autorizada = com({ situacao: 'trialing', cartao: { bandeira: 'visa', final: null } });

  it('em teste com o cartão gravado: autorizada, e o pagamento já aparece', () => {
    expect(autorizadaEmTeste(autorizada)).toBe(true);
    expect(pagamentoConfirmado(autorizada)).toBe(true);
  });

  it('em teste sem cartão: nada foi autorizado ainda', () => {
    expect(autorizadaEmTeste(com({ situacao: 'trialing' }))).toBe(false);
    expect(pagamentoConfirmado(com({ situacao: 'trialing' }))).toBe(false);
  });

  it('ativa: pagamento confirmado, mas não é "autorizada em teste"', () => {
    expect(autorizadaEmTeste(base)).toBe(false);
    expect(pagamentoConfirmado(base)).toBe(true);
  });

  it.each(['past_due', 'canceled', 'courtesy', 'blocked'] as const)('%s: pagamento não confirmado', (situacao) => {
    expect(pagamentoConfirmado(com({ situacao, cartao: { bandeira: 'visa', final: '5682' } }))).toBe(false);
  });
});

describe('proximaCobranca', () => {
  const agora = new Date('2026-10-01T12:00:00Z');

  it('ativa: no fim do período pago, com o valor do plano', () => {
    const ativa = com({ periodoAte: new Date('2026-10-29T23:00:00Z') });

    expect(proximaCobranca(ativa, agora)).toEqual({ data: new Date('2026-10-29T23:00:00Z'), valor: 59.9 });
  });

  it('ativa com descida agendada: o valor é o do plano menor, que é o que a próxima cobrança cobra', () => {
    const descendo = com({
      plano: { id: 'plano-maquina', nome: 'Máquina', preco: 89.9 },
      planoAgendado: { id: 'plano-tesoura', nome: 'Tesoura', preco: 59.9 },
      periodoAte: new Date('2026-10-29T23:00:00Z'),
    });

    expect(proximaCobranca(descendo, agora)).toEqual({ data: new Date('2026-10-29T23:00:00Z'), valor: 59.9 });
  });

  it('em teste com o cartão já autorizado: no fim do teste', () => {
    const teste = com({
      situacao: 'trialing',
      testeAte: new Date('2026-10-14T23:00:00Z'),
      cartao: { bandeira: 'visa', final: null },
    });

    expect(proximaCobranca(teste, agora)).toEqual({ data: new Date('2026-10-14T23:00:00Z'), valor: 59.9 });
  });

  it('em teste sem assinar: não há cobrança marcada', () => {
    expect(proximaCobranca(com({ situacao: 'trialing', testeAte: new Date('2026-10-14T23:00:00Z') }), agora)).toBeNull();
  });

  it.each(['past_due', 'canceled', 'courtesy', 'blocked'] as const)('%s: não há cobrança marcada', (situacao) => {
    expect(proximaCobranca(com({ situacao, periodoAte: new Date('2026-10-29T23:00:00Z') }), agora)).toBeNull();
  });

  it('ativa sem fim de período conhecido: não inventa data', () => {
    expect(proximaCobranca(base, agora)).toBeNull();
  });

  // O pagamento do mês pode demorar a ser processado: a data já passou e a situação ainda é "ativa".
  it('data que já passou não aparece como próxima cobrança', () => {
    const atrasada = com({ periodoAte: new Date('2026-09-29T23:00:00Z') });

    expect(proximaCobranca(atrasada, agora)).toBeNull();
    expect(proximaCobranca(com({ periodoAte: agora }), agora)).toBeNull();
  });
});

describe('rotuloDoCartao', () => {
  it('bandeira e final', () => {
    expect(rotuloDoCartao({ bandeira: 'visa', final: '5682' })).toBe('Visa final 5682');
    expect(rotuloDoCartao({ bandeira: 'master', final: '5555' })).toBe('Mastercard final 5555');
    expect(rotuloDoCartao({ bandeira: 'elo', final: '1234' })).toBe('Elo final 1234');
  });

  it('só a bandeira, quando o final ainda não chegou', () => {
    expect(rotuloDoCartao({ bandeira: 'visa', final: null })).toBe('Visa');
  });

  it('bandeira que não conhecemos aparece com a primeira letra maiúscula', () => {
    expect(rotuloDoCartao({ bandeira: 'diners', final: '9999' })).toBe('Diners final 9999');
  });

  it('cartão de débito e saldo da conta', () => {
    expect(rotuloDoCartao({ bandeira: 'debvisa', final: '1111' })).toBe('Visa débito final 1111');
    expect(rotuloDoCartao({ bandeira: 'account_money', final: null })).toBe('Saldo da conta Mercado Pago');
  });

  it('sem cartão, sem texto', () => {
    expect(rotuloDoCartao(null)).toBeNull();
    expect(rotuloDoCartao({ bandeira: null, final: null })).toBeNull();
  });

  it('só o final, sem a bandeira', () => {
    expect(rotuloDoCartao({ bandeira: null, final: '5682' })).toBe('Cartão final 5682');
  });
});

describe('rótulos do histórico', () => {
  it.each([
    ['approved', 'Paga'],
    ['pending', 'Pendente'],
    ['in_process', 'Pendente'],
    ['rejected', 'Recusada'],
    ['cancelled', 'Cancelada'],
    ['refunded', 'Estornada'],
    ['charged_back', 'Contestada'],
    ['algo_novo', 'Em análise'],
  ])('situação %s aparece como "%s"', (situacao, rotulo) => {
    expect(rotuloDaSituacaoDaCobranca(situacao)).toBe(rotulo);
  });

  it('tipo: mensalidade ou diferença de plano', () => {
    expect(rotuloDoTipoDaCobranca('recurring')).toBe('Mensalidade');
    expect(rotuloDoTipoDaCobranca('upgrade')).toBe('Diferença de plano');
  });
});
