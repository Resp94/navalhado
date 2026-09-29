import { describe, expect, it } from 'vitest';
import { camposDaMudancaManual, rotuloDaSituacao } from '../situacaoDaAssinatura';

const agora = new Date('2026-10-01T12:00:00Z');

describe('rótulos da situação da assinatura', () => {
  it.each([
    ['trialing', 'Em teste'],
    ['active', 'Ativa'],
    ['past_due', 'Pagamento recusado'],
    ['blocked', 'Bloqueada'],
    ['canceled', 'Cancelada'],
    ['courtesy', 'Cortesia'],
  ] as const)('%s aparece como "%s"', (situacao, rotulo) => {
    expect(rotuloDaSituacao(situacao)).toBe(rotulo);
  });

  it('barbearia sem assinatura não é chamada de cancelada', () => {
    expect(rotuloDaSituacao(null)).toBe('Sem assinatura');
  });
});

// Interino, até as ferramentas do Proprietário (estender teste, cortesia, desbloquear)
// substituírem a escrita direta de Admin > Tenants. Cada mudança manual deixa a linha
// coerente com as regras do banco: bloqueada tem data de bloqueio, ativa não guarda
// vestígio de recusa ou bloqueio antigo.
describe('campos da mudança manual de situação', () => {
  // Liberar à mão é cortesia sem fim, e não uma assinatura "ativa" sem período pago: a
  // cortesia fica registrada como tal e o Estado de Acesso a trata (sem fim, libera sempre).
  it('liberar grava cortesia sem fim e limpa o vestígio de bloqueio, cancelamento e recusa', () => {
    expect(camposDaMudancaManual('courtesy', agora)).toEqual({
      status: 'courtesy',
      courtesy_ends_at: null,
      blocked_at: null,
      blocked_reason: null,
      canceled_at: null,
      first_failed_at: null,
      updated_at: '2026-10-01T12:00:00.000Z',
    });
  });

  it('bloquear grava a data do bloqueio, sem motivo automático', () => {
    expect(camposDaMudancaManual('blocked', agora)).toEqual({
      status: 'blocked',
      blocked_at: '2026-10-01T12:00:00.000Z',
      blocked_reason: null,
      updated_at: '2026-10-01T12:00:00.000Z',
    });
  });

  it('cancelar grava a data do cancelamento', () => {
    expect(camposDaMudancaManual('canceled', agora)).toEqual({
      status: 'canceled',
      canceled_at: '2026-10-01T12:00:00.000Z',
      updated_at: '2026-10-01T12:00:00.000Z',
    });
  });
});
