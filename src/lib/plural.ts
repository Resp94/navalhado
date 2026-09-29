/** Escolhe o singular só para 1; 0 e qualquer quantidade acima de 1 usam o plural. */
export function pluralizar(quantidade: number, singular: string, plural: string): string {
  return quantidade === 1 ? singular : plural;
}
