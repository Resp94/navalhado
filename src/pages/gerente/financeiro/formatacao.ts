/**
 * Data e hora curtas (dd/mm, hh:mm) usadas nas tabelas do Hub Financeiro.
 * Sem `timeZone`, usa o fuso do navegador — errado para um evento do tenant quando o fuso de quem
 * opera é outro; passe `timeZone` (ex.: `tenant.timezone`) sempre que o dado for de um tenant específico.
 */
export function formatDate(iso: string | null, timeZone?: string) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
