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
