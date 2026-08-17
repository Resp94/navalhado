import { describe, it, expect } from 'vitest';
import { formatCurrency, parseCurrencyInput, formatCurrencyInput } from '../currency';

describe('Currency Utilities (BRL)', () => {
  it('formatCurrency formata valores numéricos corretamente', () => {
    expect(formatCurrency(0)).toMatch(/R\$\s*0,00/);
    expect(formatCurrency(1500.5)).toMatch(/R\$\s*1\.500,50/);
    expect(formatCurrency(null)).toMatch(/R\$\s*0,00/);
    expect(formatCurrency(undefined)).toMatch(/R\$\s*0,00/);
  });

  it('parseCurrencyInput converte strings monetárias com centavos', () => {
    expect(parseCurrencyInput('')).toBe(0);
    expect(parseCurrencyInput('100')).toBe(1.0);
    expect(parseCurrencyInput('1.500,50')).toBe(1500.5);
    expect(parseCurrencyInput('R$ 25,00')).toBe(25.0);
  });

  it('formatCurrencyInput formata dígitos para exibição em inputs', () => {
    expect(formatCurrencyInput('1000')).toBe('10,00');
    expect(formatCurrencyInput(1500.5)).toBe('1.500,50');
  });
});
