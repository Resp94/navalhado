import { formatCurrency } from '../../lib/currency';

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
