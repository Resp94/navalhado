import { describe, expect, it } from 'vitest';
import { cpfParaPlanilha, telefoneParaPlanilha } from '../planilha';

// O CSV é aberto no Excel por duplo clique: uma célula só de dígitos vira número (o telefone de 13 dígitos aparece como 5,51199E+12 e o
// CPF perde o zero da frente) e uma que começa com "+" é lida como fórmula. O arquivo leva telefone e CPF de um jeito que a planilha
// guarda como texto, sem perder nenhum dígito.

describe('telefoneParaPlanilha', () => {
  it.each([
    ['92999990001', '(92) 99999-0001'],
    ['9232221234', '(92) 3222-1234'],
    ['5592999990001', '55 (92) 99999-0001'],
    ['559232221234', '55 (92) 3222-1234'],
  ])('o telefone só de dígitos %s sai agrupado: %s', (telefone, esperado) => {
    expect(telefoneParaPlanilha(telefone)).toBe(esperado);
  });

  it('um telefone sem telefone é uma célula vazia', () => {
    expect(telefoneParaPlanilha(null)).toBe('');
    expect(telefoneParaPlanilha('   ')).toBe('');
  });

  it('um telefone que o Gerente já digitou com máscara sai como está', () => {
    expect(telefoneParaPlanilha('(92) 99999-0001')).toBe('(92) 99999-0001');
    expect(telefoneParaPlanilha(' 92 99999-0001 ')).toBe('92 99999-0001');
  });

  it('tira o "+" da frente, que a planilha leria como fórmula, e mantém todos os dígitos', () => {
    expect(telefoneParaPlanilha('+55 92 99999-0001')).toBe('55 92 99999-0001');
    expect(telefoneParaPlanilha('+5592999990001')).toBe('55 (92) 99999-0001');
  });

  it('um número de outro tamanho só de dígitos fica como está, sem inventar a divisão', () => {
    expect(telefoneParaPlanilha('999990001')).toBe('999990001');
    expect(telefoneParaPlanilha('12345')).toBe('12345');
    expect(telefoneParaPlanilha('123456789012345')).toBe('123456789012345');
  });
});

describe('cpfParaPlanilha', () => {
  it('o CPF só de dígitos sai com a máscara, e o zero da frente fica', () => {
    expect(cpfParaPlanilha('12345678909')).toBe('123.456.789-09');
    expect(cpfParaPlanilha('01234567890')).toBe('012.345.678-90');
  });

  it('o CPF que já tem máscara sai como está', () => {
    expect(cpfParaPlanilha('123.456.789-09')).toBe('123.456.789-09');
  });

  it('sem CPF, uma célula vazia', () => {
    expect(cpfParaPlanilha(null)).toBe('');
    expect(cpfParaPlanilha('')).toBe('');
  });

  it('um valor que não tem 11 dígitos sai como foi guardado', () => {
    expect(cpfParaPlanilha('1234567890')).toBe('1234567890');
    expect(cpfParaPlanilha('não informado')).toBe('não informado');
  });
});
