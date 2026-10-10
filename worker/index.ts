// Worker do app: os assets (a SPA do Vite, em dist/) seguem servidos pelo Cloudflare. Só /api/* passa por aqui
// (`run_worker_first` no wrangler.toml): as rotas de Contatos do Site, que leem e marcam no D1 do site (spec 056).
import { listarContatos, type D1Database } from './contatos';
import { exigirProprietario, type GuardaEnv } from './guarda';

export interface Env extends GuardaEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
  CONTATOS: D1Database;
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });

const ROTA_CONTATOS = '/api/admin/contatos';

async function atenderApi(request: Request, env: Env, pathname: string): Promise<Response> {
  if (pathname !== ROTA_CONTATOS) return json({ erro: 'Rota não encontrada.' }, 404);
  if (request.method !== 'GET') return json({ erro: 'Método não permitido.' }, 405, { allow: 'GET' });

  const recusa = await exigirProprietario(request, env);
  if (recusa) return json({ erro: recusa.erro }, recusa.status);

  try {
    return json(await listarContatos(env.CONTATOS));
  } catch (error) {
    console.error('[contatos] falha ao ler o D1', error);
    return json({ erro: 'Não foi possível ler os contatos.' }, 500);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/api/')) return atenderApi(request, env, pathname);
    return env.ASSETS.fetch(request);
  },
};
