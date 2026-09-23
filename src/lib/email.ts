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

export type DomainCheckResult = 'valido' | 'sem_mx' | 'indisponivel';

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
const domainCheckCache = new Map<string, DomainCheckResult>();

/** MX nulo (RFC 7505): preferência 0 apontando para "." -- domínio existe, mas recusa e-mail de propósito. */
function isNullMx(record: DnsAnswer): boolean {
  const exchange = record.data.trim().split(/\s+/)[1] || '';
  return exchange === '.';
}

async function queryMxProvider(url: string): Promise<DomainCheckResult | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DOMAIN_CHECK_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { accept: 'application/dns-json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;

    const data: DnsJsonResponse = await res.json();
    if (data.Status === 3) return 'sem_mx'; // NXDOMAIN
    if (data.Status !== 0) return null;

    const mxRecords = (data.Answer || []).filter((a) => a.type === MX_RECORD_TYPE);
    if (mxRecords.length === 0) return 'sem_mx';
    if (mxRecords.every(isNullMx)) return 'sem_mx';
    return 'valido';
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`[email] Falha na consulta a ${url}:`, err);
    return null;
  }
}

/**
 * Verifica se o domínio de um e-mail tem registro MX (recebe e-mail).
 * Consulta o DNS-over-HTTPS da Cloudflare, com o Google como reserva.
 * Se as duas consultas falharem (rede instável, timeout de 2s cada), o
 * e-mail é liberado ("indisponivel") -- instabilidade externa nunca trava
 * o cadastro. O resultado fica em cache em memória por domínio.
 */
export async function verifyEmailDomain(domain: string): Promise<DomainCheckResult> {
  const cleanDomain = domain.trim().toLowerCase();
  const cached = domainCheckCache.get(cleanDomain);
  if (cached) return cached;

  const encoded = encodeURIComponent(cleanDomain);
  let result = await queryMxProvider(`https://cloudflare-dns.com/dns-query?name=${encoded}&type=MX`);
  if (result === null) {
    result = await queryMxProvider(`https://dns.google/resolve?name=${encoded}&type=MX`);
  }
  if (result === null) {
    console.warn(`[email] Cloudflare e Google indisponíveis para verificar "${cleanDomain}"; e-mail liberado.`);
    result = 'indisponivel';
  }

  domainCheckCache.set(cleanDomain, result);
  return result;
}
