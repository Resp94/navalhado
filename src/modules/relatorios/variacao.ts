/**
 * Variação percentual entre o período atual e o anterior (spec 038,
 * "Período"): fração de 0 a 1 (ex.: `0.25` é +25%), nunca em já
 * multiplicada por 100 -- a tela formata com uma casa decimal ao exibir.
 * Anterior igual a zero devolve `null` ("vazio", nunca `Infinity`), porque
 * dividir por zero não tem variação percentual que faça sentido mostrar.
 */
export function calcularVariacaoPercentual(atual: number, anterior: number): number | null {
  if (!anterior) return null;
  return (atual - anterior) / anterior;
}
