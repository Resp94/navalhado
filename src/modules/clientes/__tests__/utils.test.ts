import { describe, it, expect } from 'vitest';
import { formatWhatsAppUrl } from '../utils';

describe('formatWhatsAppUrl (Diagnosing Bugs Feedback Loop)', () => {
  it('deve formatar número local sem DDI adicionando o prefixo 55', () => {
    expect(formatWhatsAppUrl('11999998888')).toBe('https://wa.me/5511999998888');
  });

  it('não deve duplicar o DDI 55 se o número já estiver normalizado', () => {
    expect(formatWhatsAppUrl('5511999998888')).toBe('https://wa.me/5511999998888');
    expect(formatWhatsAppUrl('+55 (11) 99999-8888')).toBe('https://wa.me/5511999998888');
  });

  it('deve limpar caracteres especiais, parênteses e traços', () => {
    expect(formatWhatsAppUrl('(21) 98888-7777')).toBe('https://wa.me/5521988887777');
  });

  it('deve incluir texto opcional codificado para URI', () => {
    expect(formatWhatsAppUrl('11999998888', 'Olá João!')).toBe(
      'https://wa.me/5511999998888?text=Ol%C3%A1%20Jo%C3%A3o!'
    );
  });

  it('deve retornar string vazia para telefone vazio', () => {
    expect(formatWhatsAppUrl('')).toBe('');
    expect(formatWhatsAppUrl('   ')).toBe('');
  });
});
