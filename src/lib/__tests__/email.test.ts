import { describe, it, expect } from 'vitest';
import { isValidEmailFormat } from '../email';

describe('isValidEmailFormat', () => {
  const validCases: [string, string][] = [
    ['joao@gmail.com', 'e-mail simples'],
    ['JOAO@GMAIL.COM', 'maiúsculas'],
    ['joao.silva@empresa.com.br', 'ponto na parte local, TLD composto'],
    ['joao.silva+agenda@empresa.com.br', 'tag com +'],
    ['joao_silva@empresa.com', 'underscore na parte local'],
    ['joao-mail@sub.dominio.com.br', 'hífen no meio do rótulo do domínio'],
    ['j@ab.co', 'TLD curto de 2 letras'],
    ['joao123@dominio123.com', 'dígitos na parte local e no domínio'],
    ['jon@email.com', 'domínio real usado como exemplo na conversa'],
    ['a.b.c@dominio.com', 'múltiplos pontos na parte local'],
  ];

  const invalidCases: [string, string][] = [
    ['jon@x', 'domínio sem ponto'],
    ['jon@x.c', 'TLD com 1 letra'],
    ['jon..a@x.com', 'ponto duplicado na parte local'],
    ['.jon@x.com', 'ponto no início da parte local'],
    ['jon.@x.com', 'ponto no fim da parte local'],
    ['jon@-x.com', 'hífen no início do rótulo do domínio'],
    ['jon@x-.com', 'hífen no fim do rótulo do domínio'],
    ['jon @x.com', 'espaço'],
    ['jon@@x.com', 'arroba duplicado'],
    ['jon@x..com', 'ponto duplicado no domínio'],
    ['jonx.com', 'sem arroba'],
    ['', 'vazio'],
  ];

  it.each(validCases)('aceita "%s" (%s)', (email) => {
    expect(isValidEmailFormat(email)).toBe(true);
  });

  it.each(invalidCases)('recusa "%s" (%s)', (email) => {
    expect(isValidEmailFormat(email)).toBe(false);
  });
});
