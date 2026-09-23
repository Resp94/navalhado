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

/** Provedores comuns, para sugerir correção de domínio digitado errado. */
const COMMON_EMAIL_DOMAINS = [
  'gmail.com',
  'hotmail.com',
  'hotmail.com.br',
  'outlook.com',
  'outlook.com.br',
  'live.com',
  'yahoo.com',
  'yahoo.com.br',
  'icloud.com',
  'uol.com.br',
  'bol.com.br',
  'terra.com.br',
];

const SUGGESTION_MAX_DISTANCE = 2;

/** Distância de edição (Levenshtein) entre duas strings. */
function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dist: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i++) dist[i][0] = i;
  for (let j = 0; j < cols; j++) dist[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dist[i][j] = Math.min(
        dist[i - 1][j] + 1, // remoção
        dist[i][j - 1] + 1, // inserção
        dist[i - 1][j - 1] + cost // substituição
      );
    }
  }

  return dist[rows - 1][cols - 1];
}

/**
 * Sugere a correção de um domínio digitado errado, comparando com uma
 * lista curta de provedores comuns (spec 047, ticket 06). Devolve o
 * e-mail corrigido, ou null quando o domínio já é exato ou está longe
 * demais de qualquer provedor da lista (domínio próprio, por exemplo).
 * Nunca bloqueia -- é só sugestão.
 */
export function suggestEmailDomainCorrection(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex === -1) return null;

  const localPart = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  if (!domain) return null;
  if (COMMON_EMAIL_DOMAINS.includes(domain)) return null;

  let closest: string | null = null;
  let closestDistance = Infinity;
  for (const candidate of COMMON_EMAIL_DOMAINS) {
    const distance = levenshteinDistance(domain, candidate);
    if (distance < closestDistance) {
      closestDistance = distance;
      closest = candidate;
    }
  }

  if (closest === null || closestDistance === 0 || closestDistance > SUGGESTION_MAX_DISTANCE) {
    return null;
  }

  return `${localPart}@${closest}`;
}
