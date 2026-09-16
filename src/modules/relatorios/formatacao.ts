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
