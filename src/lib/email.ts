/**
 * Validação de e-mail compartilhada por todos os formulários do Navalhado
 * (spec 047). A mesma regra existe também como função `public.email_valido`
 * no banco e, na Edge Function de Acesso do barbeiro, em código próprio —
 * os três lugares precisam continuar em sincronia.
 */

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
