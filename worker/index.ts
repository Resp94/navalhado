// Worker do app: os assets (a SPA do Vite, em dist/) seguem servidos pelo Cloudflare. Só /api/* passa por aqui
// (`run_worker_first` no wrangler.toml): as rotas de Contatos do Site, que leem e marcam no D1 do site (spec 056).
import { ehStatusDoContato, listarContatos, marcarContato, type D1Database, type FiltroDaLista } from './contatos';
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
const ROTA_DE_UM_CONTATO = /^\/api\/admin\/contatos\/([1-9]\d*)$/;

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
  if (url.pathname === ROTA_CONTATOS) {
    if (request.method !== 'GET') return json({ erro: 'Método não permitido.' }, 405, { allow: 'GET' });
    return comGuarda(request, env, () => listar(env, url));
  }

  const umContato = ROTA_DE_UM_CONTATO.exec(url.pathname);
  if (umContato) {
    if (request.method !== 'PATCH') return json({ erro: 'Método não permitido.' }, 405, { allow: 'PATCH' });
    return comGuarda(request, env, () => marcar(env, request, Number(umContato[1])));
  }

  return json({ erro: 'Rota não encontrada.' }, 404);
}

/** Só o Proprietário passa; erro do D1 vira 500 genérico, com o detalhe só no log. */
async function comGuarda(request: Request, env: Env, atender: () => Promise<Response>): Promise<Response> {
  const recusa = await exigirProprietario(request, env);
  if (recusa) return json({ erro: recusa.erro }, recusa.status);
  try {
    return await atender();
  } catch (error) {
    console.error('[contatos] falha no D1', error);
    return json({ erro: 'Não foi possível acessar os contatos.' }, 500);
  }
}

async function listar(env: Env, url: URL): Promise<Response> {
  const filtro = lerFiltro(url.searchParams);
  if (!filtro) return json({ erro: 'Filtro inválido.' }, 422);
  return json(await listarContatos(env.CONTATOS, filtro));
}

async function marcar(env: Env, request: Request, id: number): Promise<Response> {
  const corpo = (await request.json().catch(() => null)) as { status?: unknown } | null;
  const status = corpo?.status;
  if (typeof status !== 'string' || !ehStatusDoContato(status)) return json({ erro: 'Status inválido.' }, 422);

  const contato = await marcarContato(env.CONTATOS, id, status);
  if (!contato) return json({ erro: 'Contato não encontrado.' }, 404);
  return json({ contato });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return atenderApi(request, env, url);
    return env.ASSETS.fetch(request);
  },
};
