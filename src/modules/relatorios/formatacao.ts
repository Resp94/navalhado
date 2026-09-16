/**
 * Formatação de data compartilhada pelo Módulo de Relatórios (spec 038):
 * ISO (AAAA-MM-DD) -> dd/mm/aaaa, com fallback para data ausente/vazia.
 */
export function formatDisplayDate(isoDate: string): string {
  if (!isoDate) return '--/--/----';
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}
