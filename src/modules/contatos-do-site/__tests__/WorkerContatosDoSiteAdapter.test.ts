import { describe, expect, it, vi } from 'vitest';
import { WorkerContatosDoSiteAdapter } from '../adapters/WorkerContatosDoSiteAdapter';
import { ContatosDoSiteError } from '../types';

// O que GET /api/admin/contatos devolve (worker/contatos.ts): `criado_em` é UTC no formato do SQLite.
const LINHA = {
  id: 7,
  criado_em: '2026-10-09 15:30:00',
  nome: 'Ana',
  sobrenome: 'Souza',
  email: 'ana@exemplo.com',
  barbearia: null,
  assunto: 'Quero começar a usar',
  mensagem: 'Olá!\nTudo bem?',
  status: 'novo',
};

function montar(resposta: Response | Error, token: string | null = 'jwt-do-proprietario') {
  const fetchFalso = vi.fn(async (_url: string, _init?: RequestInit) => {
    if (resposta instanceof Error) throw resposta;
    return resposta;
  });
  const adapter = new WorkerContatosDoSiteAdapter(async () => token, fetchFalso as unknown as typeof fetch);
  return { adapter, fetchFalso };
}

const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });

describe('WorkerContatosDoSiteAdapter.listar', () => {
  it('chama o Worker na mesma origem com o token da sessão', async () => {
    const { adapter, fetchFalso } = montar(json({ contatos: [], haMais: false }));
    await adapter.listar(null, null);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFalso.mock.calls[0];
    expect(url).toBe('/api/admin/contatos');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer jwt-do-proprietario');
  });

  it('manda o filtro e a página na query string', async () => {
    const { adapter, fetchFalso } = montar(json({ contatos: [], haMais: false }));
    await adapter.listar('lido', 120);
    expect(fetchFalso.mock.calls[0][0]).toBe('/api/admin/contatos?status=lido&antesDe=120');
  });

  it('converte a linha do D1 no Contato do Site, com a data em UTC', async () => {
    const { adapter } = montar(json({ contatos: [LINHA], haMais: true }));
    const pagina = await adapter.listar(null, null);
    expect(pagina.haMais).toBe(true);
    expect(pagina.contatos).toEqual([
      {
        id: 7,
        recebidoEm: new Date('2026-10-09T15:30:00Z'),
        nome: 'Ana',
        sobrenome: 'Souza',
        email: 'ana@exemplo.com',
        barbearia: null,
        assunto: 'Quero começar a usar',
        mensagem: 'Olá!\nTudo bem?',
        status: 'novo',
      },
    ]);
  });

  it('sem sessão recusa sem chamar o Worker', async () => {
    const { adapter, fetchFalso } = montar(json({}), null);
    await expect(adapter.listar(null, null)).rejects.toMatchObject({ motivo: 'nao-autenticado' });
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it.each([
    [401, 'nao-autenticado'],
    [403, 'sem-permissao'],
    [500, 'falha'],
    [503, 'falha'],
  ])('resposta %i vira o erro de domínio %s', async (status, motivo) => {
    const { adapter } = montar(json({ erro: 'x' }, status));
    const erro = await adapter.listar(null, null).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ContatosDoSiteError);
    expect(erro).toMatchObject({ motivo });
  });

  it('rede fora do ar vira falha', async () => {
    const { adapter } = montar(new TypeError('Failed to fetch'));
    await expect(adapter.listar(null, null)).rejects.toMatchObject({ motivo: 'falha' });
  });
});
