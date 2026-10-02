import { formatCurrency } from '../../lib/currency';
import type { RelatorioAgendaOrigem, RelatorioClientesRegistrationOrigin } from './types';

/** Rótulo de exibição de cada origem do Agendamento (spec 038, ticket 07). */
export const ORIGEM_LABELS: Record<RelatorioAgendaOrigem, string> = {
  manual: 'Painel',
  online: 'Link público',
  client_channel: 'Canal do Cliente',
  whatsapp: 'WhatsApp',
};

export function formatOrigemLabel(origin: string): string {
  return ORIGEM_LABELS[origin as RelatorioAgendaOrigem] ?? origin;
}

/** Rótulo de exibição de cada origem do cadastro (spec 038, ticket 11). */
export const REGISTRATION_ORIGIN_LABELS: Record<RelatorioClientesRegistrationOrigin, string> = {
  balcao: 'Balcão',
  agenda: 'Agenda',
  online: 'Link público',
  canal_cliente: 'Canal do Cliente',
  whatsapp_bot: 'WhatsApp',
  importacao: 'Importação',
};

export function formatRegistrationOriginLabel(origin: string): string {
  return REGISTRATION_ORIGIN_LABELS[origin as RelatorioClientesRegistrationOrigin] ?? origin;
}

/**
 * Formatação de data compartilhada pelo Módulo de Relatórios (spec 038):
 * ISO (AAAA-MM-DD) -> dd/mm/aaaa, com fallback para data ausente/vazia.
 */
export function formatDisplayDate(isoDate: string): string {
  if (!isoDate) return '--/--/----';
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Participação percentual (spec 038, ticket 02): `share` vem do banco
 * como fração (0 a 1) ou `null` quando o período não teve recebimento.
 * `null` vira "--", nunca "0%" (que sugeriria recebimento zero na forma,
 * não ausência de recebimento no período inteiro).
 */
export function formatPercent(share: number | null): string {
  if (share === null) return '--';
  return `${(share * 100).toFixed(1).replace('.', ',')}%`;
}

/**
 * Moeda com "ausência" explícita (spec 038, ticket 03): `null` (ticket
 * médio sem denominador) vira "--", nunca "R$ 0,00" -- `formatCurrency`
 * sozinho não distingue "sem dado" de "zero", então esse wrapper é o ponto
 * único onde a tela decide isso para ticket médio.
 */
export function formatCurrencyOrDash(value: number | null): string {
  if (value === null) return '--';
  return formatCurrency(value);
}
