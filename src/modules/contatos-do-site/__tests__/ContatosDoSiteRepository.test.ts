import { describe, expect, it, vi } from 'vitest';
import { ContatosDoSiteRepository } from '../ContatosDoSiteRepository';
import { InMemoryContatosDoSiteAdapter, contatoDeTeste } from '../adapters/InMemoryContatosDoSiteAdapter';

describe('ContatosDoSiteRepository.listar', () => {
  it('devolve os contatos do mais novo para o mais antigo', async () => {
    const adapter = new InMemoryContatosDoSiteAdapter([
      contatoDeTeste({ id: 1, nome: 'Primeiro' }),
      contatoDeTeste({ id: 3, nome: 'Terceiro' }),
      contatoDeTeste({ id: 2, nome: 'Segundo' }),
    ]);
    const pagina = await new ContatosDoSiteRepository(adapter).listar(null, null);
    expect(pagina.contatos.map((c) => c.nome)).toEqual(['Terceiro', 'Segundo', 'Primeiro']);
    expect(pagina.haMais).toBe(false);
  });

  it('traz no máximo 50 e diz se há mais', async () => {
    const adapter = new InMemoryContatosDoSiteAdapter(Array.from({ length: 51 }, (_, i) => contatoDeTeste({ id: i + 1 })));
    const pagina = await new ContatosDoSiteRepository(adapter).listar(null, null);
    expect(pagina.contatos).toHaveLength(50);
    expect(pagina.contatos[0].id).toBe(51);
    expect(pagina.haMais).toBe(true);
  });

  it('filtra pelo status', async () => {
    const adapter = new InMemoryContatosDoSiteAdapter([
      contatoDeTeste({ id: 1, status: 'novo' }),
      contatoDeTeste({ id: 2, status: 'lido' }),
      contatoDeTeste({ id: 3, status: 'respondido' }),
      contatoDeTeste({ id: 4, status: 'novo' }),
    ]);
    const pagina = await new ContatosDoSiteRepository(adapter).listar('novo', null);
    expect(pagina.contatos.map((c) => c.id)).toEqual([4, 1]);
  });

  it('a página seguinte começa depois do último id recebido', async () => {
    const adapter = new InMemoryContatosDoSiteAdapter(Array.from({ length: 60 }, (_, i) => contatoDeTeste({ id: i + 1 })));
    const repositorio = new ContatosDoSiteRepository(adapter);
    const primeira = await repositorio.listar(null, null);
    const segunda = await repositorio.listar(null, primeira.contatos[49].id);
    expect(segunda.contatos.map((c) => c.id)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(segunda.haMais).toBe(false);
  });
});

describe('ContatosDoSiteRepository: abrir e marcar', () => {
  const montar = (...contatos: ReturnType<typeof contatoDeTeste>[]) => {
    const adapter = new InMemoryContatosDoSiteAdapter(contatos);
    return { adapter, repositorio: new ContatosDoSiteRepository(adapter) };
  };

  it('abrir uma mensagem nova a marca como lida', async () => {
    const { adapter, repositorio } = montar(contatoDeTeste({ id: 1, status: 'novo' }));
    const aberto = await repositorio.abrir(contatoDeTeste({ id: 1, status: 'novo' }));
    expect(aberto.status).toBe('lido');
    expect(adapter.contatos[0].status).toBe('lido');
  });

  it.each(['lido', 'respondido'] as const)('abrir uma mensagem %s não muda nada', async (status) => {
    const { adapter, repositorio } = montar(contatoDeTeste({ id: 1, status }));
    const marcar = vi.spyOn(adapter, 'marcar');
    const aberto = await repositorio.abrir(contatoDeTeste({ id: 1, status }));
    expect(aberto.status).toBe(status);
    expect(marcar).not.toHaveBeenCalled();
  });

  it('marca como respondido e como não lida', async () => {
    const { adapter, repositorio } = montar(contatoDeTeste({ id: 1, status: 'lido' }));
    expect((await repositorio.marcar(1, 'respondido')).status).toBe('respondido');
    expect((await repositorio.marcar(1, 'novo')).status).toBe('novo');
    expect(adapter.contatos[0].status).toBe('novo');
  });

  it('recusa status fora da lista sem chamar o adaptador', async () => {
    const { adapter, repositorio } = montar(contatoDeTeste({ id: 1 }));
    const marcar = vi.spyOn(adapter, 'marcar');
    await expect(repositorio.marcar(1, 'arquivado' as never)).rejects.toMatchObject({ motivo: 'status-invalido' });
    expect(marcar).not.toHaveBeenCalled();
  });

  it('avisa os assinantes depois de cada mudança, e só delas', async () => {
    const { repositorio } = montar(contatoDeTeste({ id: 1, status: 'novo' }), contatoDeTeste({ id: 2, status: 'lido' }));
    const aviso = vi.fn();
    const cancelar = repositorio.aoMudar(aviso);

    await repositorio.abrir(contatoDeTeste({ id: 1, status: 'novo' }));
    expect(aviso).toHaveBeenCalledTimes(1);
    await repositorio.abrir(contatoDeTeste({ id: 2, status: 'lido' }));
    expect(aviso).toHaveBeenCalledTimes(1);
    await repositorio.marcar(2, 'respondido');
    expect(aviso).toHaveBeenCalledTimes(2);

    cancelar();
    await repositorio.marcar(2, 'novo');
    expect(aviso).toHaveBeenCalledTimes(2);
  });

  it('não avisa quando a gravação falha', async () => {
    const { repositorio } = montar();
    const aviso = vi.fn();
    repositorio.aoMudar(aviso);
    await expect(repositorio.marcar(99, 'lido')).rejects.toMatchObject({ motivo: 'nao-encontrado' });
    expect(aviso).not.toHaveBeenCalled();
  });
});
