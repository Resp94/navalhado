/** Data e hora curtas (dd/mm, hh:mm) usadas nas tabelas do Hub Financeiro. */
export function formatDate(iso: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
