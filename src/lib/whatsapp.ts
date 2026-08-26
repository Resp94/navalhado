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

export function maskPhone(val?: string | null): string {
  if (!val) return '';
  let raw = val.replace(/\D/g, '');
  
  // Se o número contiver o DDI internacional do Brasil (55 na frente com mais de 11 dígitos), remove o 55
  while (raw.startsWith('55') && raw.length > 11) {
    raw = raw.slice(2);
  }

  raw = raw.slice(0, 11);
  if (raw.length === 0) return '';
  if (raw.length <= 2) return `(${raw}`;
  if (raw.length <= 6) return `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
  if (raw.length <= 10) return `(${raw.slice(0, 2)}) ${raw.slice(2, 6)}-${raw.slice(6)}`;
  return `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7, 11)}`;
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


