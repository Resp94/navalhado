import { describe, expect, it } from 'vitest';
import { calcularVariacaoPercentual } from '../variacao';

describe('calcularVariacaoPercentual', () => {
  it('anterior zero devolve null, nunca infinito', () => {
    expect(calcularVariacaoPercentual(100, 0)).toBeNull();
  });

  it('ambos zero devolve null', () => {
    expect(calcularVariacaoPercentual(0, 0)).toBeNull();
  });

  it('crescimento positivo', () => {
    expect(calcularVariacaoPercentual(150, 100)).toBeCloseTo(0.5);
  });

  it('queda negativa', () => {
    expect(calcularVariacaoPercentual(50, 100)).toBeCloseTo(-0.5);
  });

  it('atual negativo em relação a anterior positivo', () => {
    expect(calcularVariacaoPercentual(-20, 100)).toBeCloseTo(-1.2);
  });
});
