import { describe, expect, it } from 'vitest';
import { sanitizePhoneNumber, formatWhatsAppNumber, buildWhatsAppUrl } from '../whatsapp';

describe('whatsapp utility', () => {
  it('higieniza caracteres não numéricos do telefone', () => {
    expect(sanitizePhoneNumber('(11) 98765-4321')).toBe('11987654321');
    expect(sanitizePhoneNumber('+55 11 99999-0000')).toBe('5511999990000');
    expect(sanitizePhoneNumber(null)).toBe('');
  });

  it('formata número para padrão internacional com DDI 55 quando necessário', () => {
    expect(formatWhatsAppNumber('11987654321')).toBe('5511987654321');
    expect(formatWhatsAppNumber('5511987654321')).toBe('5511987654321');
  });

  it('constrói URL de WhatsApp com mensagem codificada', () => {
    const url = buildWhatsAppUrl('(11) 98765-4321', 'Olá Carlos, seu agendamento está confirmado.');
    expect(url).toContain('https://wa.me/5511987654321');
    expect(url).toContain('text=Ol%C3%A1%20Carlos');
  });
});
