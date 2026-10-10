import { describe, expect, it } from 'vitest';
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
