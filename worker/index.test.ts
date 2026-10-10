// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker, { type Env } from './index';
import { criarD1DeTeste } from './testes/d1Sqlite';

const SUPABASE_URL = 'https://projeto-de-teste.supabase.co';
const RPC = `${SUPABASE_URL}/rest/v1/rpc/assert_proprietario`;

type RespostaDaGuarda = { status: number; corpo?: unknown } | 'fora-do-ar';

function montar(guarda: RespostaDaGuarda = { status: 204 }) {
  const banco = criarD1DeTeste();
  const assets = vi.fn(async () => new Response('<html>SPA</html>', { headers: { 'content-type': 'text/html' } }));
  const env: Env = {
    ASSETS: { fetch: assets },
    CONTATOS: banco.d1,
    SUPABASE_URL,
    SUPABASE_ANON_KEY: 'sb_publishable_teste',
  };
  const chamadasDaGuarda: Request[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const pedido = new Request(entrada, init);
      chamadasDaGuarda.push(pedido);
      if (guarda === 'fora-do-ar') throw new TypeError('fetch failed');
      return new Response(guarda.corpo === undefined ? null : JSON.stringify(guarda.corpo), { status: guarda.status });
    }),
  );
  return { env, banco, assets, chamadasDaGuarda };
}

const pedir = (env: Env, caminho: string, init: RequestInit = {}) =>
  worker.fetch(new Request(`https://app.navalhado.com.br${caminho}`, init), env);

const comToken = (init: RequestInit = {}): RequestInit => ({
  ...init,
  headers: { authorization: 'Bearer jwt-do-proprietario', ...(init.headers ?? {}) },
});

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Worker do app: autorização das rotas de Contatos do Site', () => {
  it('sem token responde 401 e nem consulta o Supabase', async () => {
    const { env, chamadasDaGuarda } = montar();
    const res = await pedir(env, '/api/admin/contatos');
    expect(res.status).toBe(401);
    expect(chamadasDaGuarda).toHaveLength(0);
  });

  it('repassa o token do usuário e a chave pública para a RPC assert_proprietario', async () => {
    const { env, chamadasDaGuarda } = montar();
    await pedir(env, '/api/admin/contatos', comToken());
    expect(chamadasDaGuarda).toHaveLength(1);
    expect(chamadasDaGuarda[0].url).toBe(RPC);
    expect(chamadasDaGuarda[0].method).toBe('POST');
    expect(chamadasDaGuarda[0].headers.get('authorization')).toBe('Bearer jwt-do-proprietario');
    expect(chamadasDaGuarda[0].headers.get('apikey')).toBe('sb_publishable_teste');
  });

  it('JWT recusado pelo Supabase responde 401', async () => {
    const { env } = montar({ status: 401, corpo: { code: 'PGRST301', message: 'JWT expired' } });
    const res = await pedir(env, '/api/admin/contatos', comToken());
    expect(res.status).toBe(401);
  });

  it('quem não é Proprietário (ADMIN_ONLY) responde 403', async () => {
    const { env } = montar({ status: 403, corpo: { code: '42501', message: 'ADMIN_ONLY' } });
    const res = await pedir(env, '/api/admin/contatos', comToken());
    expect(res.status).toBe(403);
  });

  it('Supabase fora do ar responde 503', async () => {
    const { env } = montar('fora-do-ar');
    const res = await pedir(env, '/api/admin/contatos', comToken());
    expect(res.status).toBe(503);
  });

  it('erro inesperado do Supabase responde 503', async () => {
    const { env } = montar({ status: 500, corpo: { message: 'boom' } });
    const res = await pedir(env, '/api/admin/contatos', comToken());
    expect(res.status).toBe(503);
  });

  it('sem autorização, não lê o D1', async () => {
    const { env } = montar({ status: 403, corpo: { code: '42501', message: 'ADMIN_ONLY' } });
    const prepare = vi.spyOn(env.CONTATOS, 'prepare');
    await pedir(env, '/api/admin/contatos', comToken());
    expect(prepare).not.toHaveBeenCalled();
  });
});

describe('GET /api/admin/contatos', () => {
  it('devolve as mensagens da mais nova para a mais antiga, sem ip nem user_agent', async () => {
    const { env, banco } = montar();
    banco.inserir({ nome: 'Primeira' });
    banco.inserir({ nome: 'Segunda', barbearia: null });

    const res = await pedir(env, '/api/admin/contatos', comToken());

    expect(res.status).toBe(200);
    const corpo = await res.json();
    expect(corpo.contatos.map((c: { nome: string }) => c.nome)).toEqual(['Segunda', 'Primeira']);
    expect(corpo.contatos[0]).toEqual({
      id: 2,
      criado_em: '2026-10-09 12:00:00',
      nome: 'Segunda',
      sobrenome: 'Souza',
      email: 'ana@exemplo.com',
      barbearia: null,
      assunto: 'Quero começar a usar',
      mensagem: 'Olá!',
      status: 'novo',
    });
    expect(JSON.stringify(corpo)).not.toMatch(/203\.0\.113\.7|Mozilla|"ip"|user_agent/);
  });

  it('devolve no máximo 50 e diz se há mais', async () => {
    const { env, banco } = montar();
    for (let i = 0; i < 51; i++) banco.inserir({ nome: `Contato ${i + 1}` });

    const corpo = await (await pedir(env, '/api/admin/contatos', comToken())).json();

    expect(corpo.contatos).toHaveLength(50);
    expect(corpo.contatos[0].nome).toBe('Contato 51');
    expect(corpo.haMais).toBe(true);
  });

  it('com até 50 mensagens, haMais é falso', async () => {
    const { env, banco } = montar();
    banco.inserir();
    const corpo = await (await pedir(env, '/api/admin/contatos', comToken())).json();
    expect(corpo.haMais).toBe(false);
  });

  it('filtra pelo status', async () => {
    const { env, banco } = montar();
    banco.inserir({ nome: 'Nova' });
    banco.inserir({ nome: 'Lida', status: 'lido' });
    banco.inserir({ nome: 'Respondida', status: 'respondido' });
    banco.inserir({ nome: 'Outra nova' });

    const corpo = await (await pedir(env, '/api/admin/contatos?status=novo', comToken())).json();

    expect(corpo.contatos.map((c: { nome: string }) => c.nome)).toEqual(['Outra nova', 'Nova']);
  });

  it('pagina pelo id com antesDe, mantendo o filtro', async () => {
    const { env, banco } = montar();
    for (let i = 1; i <= 120; i++) banco.inserir({ nome: `Contato ${i}`, status: i % 2 === 0 ? 'novo' : 'lido' });

    const primeira = await (await pedir(env, '/api/admin/contatos?status=novo', comToken())).json();
    expect(primeira.contatos).toHaveLength(50);
    expect(primeira.haMais).toBe(true);
    const ultimoId = primeira.contatos[49].id;

    const segunda = await (await pedir(env, `/api/admin/contatos?status=novo&antesDe=${ultimoId}`, comToken())).json();
    expect(segunda.contatos).toHaveLength(10);
    expect(segunda.haMais).toBe(false);
    expect(segunda.contatos.every((c: { id: number; status: string }) => c.id < ultimoId && c.status === 'novo')).toBe(true);
  });

  it.each(['arquivado', 'NOVO', ''])('status inválido (%s) responde 422', async (status) => {
    const { env } = montar();
    const res = await pedir(env, `/api/admin/contatos?status=${status}`, comToken());
    expect(res.status).toBe(422);
  });

  it.each(['abc', '0', '-3', '1.5'])('antesDe inválido (%s) responde 422', async (antesDe) => {
    const { env } = montar();
    const res = await pedir(env, `/api/admin/contatos?antesDe=${antesDe}`, comToken());
    expect(res.status).toBe(422);
  });

  it('erro do D1 responde 500 com mensagem genérica e o detalhe só no log', async () => {
    const { env } = montar();
    env.CONTATOS = {
      prepare: () => {
        throw new Error('D1_ERROR: segredo interno');
      },
    };
    const res = await pedir(env, '/api/admin/contatos', comToken());
    expect(res.status).toBe(500);
    expect(await res.text()).not.toMatch(/segredo interno/);
    expect(console.error).toHaveBeenCalled();
  });
});

describe('PATCH /api/admin/contatos/:id', () => {
  const marcar = (env: Env, id: number | string, corpo: unknown) =>
    pedir(env, `/api/admin/contatos/${id}`, comToken({ method: 'PATCH', body: JSON.stringify(corpo) }));

  it('muda o status e devolve o contato atualizado, sem ip nem user_agent', async () => {
    const { env, banco } = montar();
    const id = banco.inserir({ nome: 'Ana' });

    const res = await marcar(env, id, { status: 'respondido' });

    expect(res.status).toBe(200);
    const corpo = await res.json();
    expect(corpo.contato).toMatchObject({ id, nome: 'Ana', status: 'respondido' });
    expect(JSON.stringify(corpo)).not.toMatch(/203\.0\.113\.7|Mozilla|"ip"|user_agent/);
    expect(banco.statusDe(id)).toBe('respondido');
  });

  it('volta uma mensagem para novo', async () => {
    const { env, banco } = montar();
    const id = banco.inserir({ status: 'lido' });
    expect((await marcar(env, id, { status: 'novo' })).status).toBe(200);
    expect(banco.statusDe(id)).toBe('novo');
  });

  it.each([{ status: 'arquivado' }, { status: null }, {}, 'texto'])('status inválido (%j) responde 422 e não muda nada', async (corpo) => {
    const { env, banco } = montar();
    const id = banco.inserir();
    expect((await marcar(env, id, corpo)).status).toBe(422);
    expect(banco.statusDe(id)).toBe('novo');
  });

  it('corpo que não é JSON responde 422', async () => {
    const { env, banco } = montar();
    const id = banco.inserir();
    const res = await pedir(env, `/api/admin/contatos/${id}`, comToken({ method: 'PATCH', body: '{status' }));
    expect(res.status).toBe(422);
  });

  it('id inexistente responde 404', async () => {
    const { env } = montar();
    expect((await marcar(env, 999, { status: 'lido' })).status).toBe(404);
  });

  it('id que não é número responde 404', async () => {
    const { env } = montar();
    expect((await marcar(env, 'abc', { status: 'lido' })).status).toBe(404);
  });

  it('sem autorização, não muda nada', async () => {
    const { env, banco } = montar({ status: 403, corpo: { code: '42501', message: 'ADMIN_ONLY' } });
    const id = banco.inserir();
    expect((await marcar(env, id, { status: 'lido' })).status).toBe(403);
    expect(banco.statusDe(id)).toBe('novo');
  });

  it('GET na rota de um contato responde 405', async () => {
    const { env, banco } = montar();
    const id = banco.inserir();
    expect((await pedir(env, `/api/admin/contatos/${id}`, comToken())).status).toBe(405);
  });
});

describe('GET /api/admin/contatos/novos', () => {
  it('conta só as mensagens novas', async () => {
    const { env, banco } = montar();
    banco.inserir();
    banco.inserir();
    banco.inserir({ status: 'lido' });
    banco.inserir({ status: 'respondido' });

    const res = await pedir(env, '/api/admin/contatos/novos', comToken());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ novos: 2 });
  });

  it('sem mensagens, conta zero', async () => {
    const { env } = montar();
    expect(await (await pedir(env, '/api/admin/contatos/novos', comToken())).json()).toEqual({ novos: 0 });
  });

  it('tem a mesma guarda das outras rotas', async () => {
    const { env } = montar({ status: 403, corpo: { code: '42501', message: 'ADMIN_ONLY' } });
    expect((await pedir(env, '/api/admin/contatos/novos', comToken())).status).toBe(403);
    expect((await pedir(env, '/api/admin/contatos/novos')).status).toBe(401);
  });

  it('só aceita GET', async () => {
    const { env } = montar();
    expect((await pedir(env, '/api/admin/contatos/novos', comToken({ method: 'POST' }))).status).toBe(405);
  });
});

describe('roteamento do Worker', () => {
  it('rota /api desconhecida responde 404 em JSON', async () => {
    const { env } = montar();
    const res = await pedir(env, '/api/qualquer-coisa', comToken());
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
  });

  it('método não aceito responde 405', async () => {
    const { env } = montar();
    const res = await pedir(env, '/api/admin/contatos', comToken({ method: 'DELETE' }));
    expect(res.status).toBe(405);
  });

  it('fora de /api, entrega os assets (SPA)', async () => {
    const { env, assets } = montar();
    const res = await pedir(env, '/admin/contatos');
    expect(res.status).toBe(200);
    expect(assets).toHaveBeenCalledTimes(1);
  });
});
