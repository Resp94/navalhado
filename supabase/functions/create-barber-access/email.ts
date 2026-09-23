// Spec 047, ticket 04: validação de e-mail do Acesso do barbeiro.
//
// Mesma regra de formato do módulo de e-mail do front (src/lib/email.ts) e
// da função SQL public.email_valido (ticket 01). Os três lugares precisam
// continuar em sincronia.

const EMAIL_FORMAT_REGEX =
  /^[a-z0-9_%+-]+(\.[a-z0-9_%+-]+)*@([a-z0-9]+(-+[a-z0-9]+)*\.)+[a-z]{2,}$/i;

/**
 * Confere o formato do e-mail: sem ponto no início, no fim ou duplicado na
 * parte local; domínio com rótulos alfanuméricos (hífen só no meio) e TLD
 * de 2 ou mais letras. Não confere se o domínio existe.
 */
export function isValidEmailFormat(email: string): boolean {
  return EMAIL_FORMAT_REGEX.test(email.trim());
}
