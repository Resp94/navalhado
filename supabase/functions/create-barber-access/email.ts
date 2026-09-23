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

// Spec 047, ticket 08: verificação de domínio (mesma política do front,
// src/lib/email.ts). Usa `fetch`, nunca `Deno.resolveDns` -- a documentação
// de limites do Supabase Edge Runtime não garante essa API, e `fetch`
// externo é garantido (só as portas 25 e 587 são bloqueadas).

export type DomainCheckResult = "valido" | "sem_mx" | "indisponivel";

interface DnsAnswer {
  type: number;
  data: string;
}

interface DnsJsonResponse {
  Status: number;
  Answer?: DnsAnswer[];
}

const MX_RECORD_TYPE = 15;
const DOMAIN_CHECK_TIMEOUT_MS = 2000;

/** MX nulo (RFC 7505): preferência 0 apontando para "." -- domínio existe, mas recusa e-mail de propósito. */
function isNullMx(record: DnsAnswer): boolean {
  const exchange = record.data.trim().split(/\s+/)[1] || "";
  return exchange === ".";
}

async function queryMxProvider(url: string): Promise<DomainCheckResult | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DOMAIN_CHECK_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { accept: "application/dns-json" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;

    const data: DnsJsonResponse = await res.json();
    if (data.Status === 3) return "sem_mx"; // NXDOMAIN
    if (data.Status !== 0) return null;

    const mxRecords = (data.Answer || []).filter((a) => a.type === MX_RECORD_TYPE);
    if (mxRecords.length === 0) return "sem_mx";
    if (mxRecords.every(isNullMx)) return "sem_mx";
    return "valido";
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`[create-barber-access] falha na consulta a ${url}:`, err);
    return null;
  }
}

/**
 * Verifica se o domínio de um e-mail tem registro MX (recebe e-mail).
 * Cloudflare primeiro, Google como reserva. Se as duas consultas falharem,
 * o e-mail é liberado ("indisponivel") -- instabilidade externa nunca
 * impede a criação do acesso.
 */
export async function verifyEmailDomain(domain: string): Promise<DomainCheckResult> {
  const cleanDomain = domain.trim().toLowerCase();
  const encoded = encodeURIComponent(cleanDomain);

  let result = await queryMxProvider(`https://cloudflare-dns.com/dns-query?name=${encoded}&type=MX`);
  if (result === null) {
    result = await queryMxProvider(`https://dns.google/resolve?name=${encoded}&type=MX`);
  }
  if (result === null) {
    console.warn(`[create-barber-access] Cloudflare e Google indisponíveis para "${cleanDomain}"; e-mail liberado.`);
    result = "indisponivel";
  }
  return result;
}
