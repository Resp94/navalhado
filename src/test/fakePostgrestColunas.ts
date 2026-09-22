/**
 * Apoio de teste compartilhado pelos bancos de mentira dos adaptadores Supabase: interpreta a
 * lista de colunas de um `.select(...)` e projeta uma linha para conter só essas colunas — como o
 * PostgREST faz de verdade. Um fake que devolvesse a linha inteira, ignorando o select, esconderia
 * o defeito original do ticket 02 da spec 043 (adaptador que esquece de pedir uma coluna).
 */

/** Colunas de topo do select, ignorando o conteúdo entre parênteses das relações embutidas. O alias de uma relação (`customer:customers (...)`) vale pelo nome do alias. */
export function colunasDeTopo(select: string): string[] {
  const colunas: string[] = [];
  let profundidade = 0;
  let atual = '';
  for (const caractere of select) {
    if (caractere === '(') profundidade += 1;
    if (caractere === ')') profundidade -= 1;
    if (caractere === ',' && profundidade === 0) {
      colunas.push(atual);
      atual = '';
    } else {
      atual += caractere;
    }
  }
  colunas.push(atual);
  return colunas.map((coluna) => coluna.trim().split(/[\s(]/)[0].split(':')[0]).filter(Boolean);
}

/** Projeta uma linha para conter só as colunas pedidas no select. */
export function projetarColunas<T extends Record<string, unknown>>(
  colunasPedidas: string[],
  linha: T
): Partial<T> {
  return Object.fromEntries(
    colunasPedidas.filter((coluna) => coluna in linha).map((coluna) => [coluna, linha[coluna]])
  ) as Partial<T>;
}
