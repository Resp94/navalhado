/**
 * Utilitários de domínio para o módulo de Clientes
 */

/**
 * Normaliza o número de telefone e gera o link direto do WhatsApp (wa.me)
 * Trata números com ou sem DDI 55, caracteres especiais e espaços, evitando duplicação de DDI.
 */
export function formatWhatsAppUrl(phone: string, text?: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  // Se já começar com 55 e tiver 12 ou 13 dígitos (DDI + DDD + número), não duplica
  const normalizedPhone = digits.startsWith('55') && digits.length >= 12 ? digits : `55${digits}`;
  const query = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${normalizedPhone}${query}`;
}
