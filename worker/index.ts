// Worker do app: os assets (a SPA do Vite, em dist/) seguem servidos pelo Cloudflare. Só /api/* passa por aqui
// (`run_worker_first` no wrangler.toml): as rotas de Contatos do Site, que leem e marcam no D1 do site (spec 056).
import { ehStatusDoContato, listarContatos, type D1Database, type FiltroDaLista } from './contatos';
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

const ID = /^[1-9]\d*$/;

/** O filtro da query string, ou nulo quando ela é inválida (422). */
function lerFiltro(params: URLSearchParams): FiltroDaLista | null {
  const status = params.get('status');
  const antesDe = params.get('antesDe');
  if (status !== null && !ehStatusDoContato(status)) return null;
  if (antesDe !== null && !ID.test(antesDe)) return null;
  return { status, antesDe: antesDe === null ? null : Number(antesDe) };
}

async function atenderApi(request: Request, env: Env, url: URL): Promise<Response> {
  const { pathname } = url;
  if (pathname !== ROTA_CONTATOS) return json({ erro: 'Rota não encontrada.' }, 404);
  if (request.method !== 'GET') return json({ erro: 'Método não permitido.' }, 405, { allow: 'GET' });

  const recusa = await exigirProprietario(request, env);
  if (recusa) return json({ erro: recusa.erro }, recusa.status);

  const filtro = lerFiltro(url.searchParams);
  if (!filtro) return json({ erro: 'Filtro inválido.' }, 422);

  try {
    return json(await listarContatos(env.CONTATOS, filtro));
  } catch (error) {
    console.error('[contatos] falha ao ler o D1', error);
    return json({ erro: 'Não foi possível ler os contatos.' }, 500);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return atenderApi(request, env, url);
    return env.ASSETS.fetch(request);
  },
};
