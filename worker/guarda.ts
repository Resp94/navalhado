// Só o Proprietário passa. A regra mora no Postgres: o Worker repassa o JWT do usuário para a RPC public.assert_proprietario,
// o PostgREST valida o token e a função recusa quem não é Proprietário ativo (ADMIN_ONLY, 42501).

export interface GuardaEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

export type Recusa = { status: 401 | 403 | 503; erro: string };

const BEARER = /^Bearer\s+\S+$/i;

/** Nulo quando o usuário é o Proprietário; senão, a recusa que a rota devolve. */
export async function exigirProprietario(request: Request, env: GuardaEnv): Promise<Recusa | null> {
  const authorization = request.headers.get('authorization') ?? '';
  if (!BEARER.test(authorization)) return { status: 401, erro: 'Não autenticado.' };

  let res: Response;
  try {
    res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/assert_proprietario`, {
      method: 'POST',
      headers: { apikey: env.SUPABASE_ANON_KEY, authorization, 'content-type': 'application/json' },
      body: '{}',
    });
  } catch (error) {
    console.error('[contatos] Supabase fora do ar na guarda', error);
    return { status: 503, erro: 'Serviço temporariamente indisponível.' };
  }

  if (res.ok) return null;
  // O PostgREST responde 401 a token inválido ou vencido e ao anônimo sem EXECUTE.
  if (res.status === 401) return { status: 401, erro: 'Não autenticado.' };

  const corpo = (await res.json().catch(() => null)) as { code?: string } | null;
  if (corpo?.code === '42501') return { status: 403, erro: 'Apenas o Proprietário acessa os contatos do site.' };

  console.error('[contatos] resposta inesperada da guarda', res.status, corpo);
  return { status: 503, erro: 'Serviço temporariamente indisponível.' };
}
