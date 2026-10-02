import { describe, expect, it } from 'vitest';
import { rotuloDaSituacao } from '../situacaoDaAssinatura';

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
