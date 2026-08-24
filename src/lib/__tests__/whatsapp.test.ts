import { describe, expect, it, vi } from 'vitest';
import {
  sanitizePhoneNumber,
  formatWhatsAppNumber,
  buildWhatsAppUrl,
  interpolateTemplate,
  WHATSAPP_TEMPLATES,
  sendManualWhatsAppMessage,
} from '../whatsapp';
import { supabase } from '../supabase';

vi.mock('../supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

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

  it('interpola variáveis no template corretamente', () => {
    const result = interpolateTemplate(WHATSAPP_TEMPLATES.retorno, {
      customer_name: 'Arthur',
      tenant_name: 'Barbearia Premium',
      booking_link: 'https://navalhado.com.br/cliente/123',
    });

    expect(result).toBe(
      'Olá, Arthur! Já faz um tempo desde seu último atendimento na *Barbearia Premium*. Que tal renovar o visual? Agende seu horário pelo link: https://navalhado.com.br/cliente/123'
    );
  });

  it('chama Edge Function com os parâmetros corretos ao disparar mensagem', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: { success: true },
      error: null,
    } as any);

    await sendManualWhatsAppMessage('tenant-123', '11988887777', 'Mensagem de teste');

    expect(supabase.functions.invoke).toHaveBeenCalledWith('whatsapp-integration/send-manual', {
      body: {
        tenant_id: 'tenant-123',
        number: '11988887777',
        text: 'Mensagem de teste',
      },
    });
  });
});

