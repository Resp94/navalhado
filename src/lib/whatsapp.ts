import { supabase } from './supabase';

/**
 * Utilitários para higienização e geração de links diretos do WhatsApp
 */

export function sanitizePhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

export function formatWhatsAppNumber(phone?: string | null): string {
  const digits = sanitizePhoneNumber(phone);
  if (!digits) return '';
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

export function buildWhatsAppUrl(phone: string, message?: string): string {
  const formattedNumber = formatWhatsAppNumber(phone);
  if (!formattedNumber) return '';
  const textParam = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${formattedNumber}${textParam}`;
}

export function openWhatsApp(phone: string, message?: string): void {
  const url = buildWhatsAppUrl(phone, message);
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export const WHATSAPP_TEMPLATES = {
  retorno: 'Olá, {{customer_name}}! Já faz um tempo desde seu último atendimento na *{{tenant_name}}*. Que tal renovar o visual? Agende seu horário pelo link: {{booking_link}}',
  agradecimento: 'Olá, {{customer_name}}! Agradecemos pela preferência e confiança na *{{tenant_name}}*. Como foi sua experiência conosco? Esperamos você em breve!',
} as const;

export function interpolateTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value || '');
  }
  return result;
}

export async function sendManualWhatsAppMessage(
  tenantId: string,
  phone: string,
  message: string
): Promise<void> {
  const { error } = await supabase.functions.invoke('whatsapp-integration/send-manual', {
    body: {
      tenant_id: tenantId,
      number: phone,
      text: message.trim(),
    },
  });

  if (error) {
    throw error;
  }
}


