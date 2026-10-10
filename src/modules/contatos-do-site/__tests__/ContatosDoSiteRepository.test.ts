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
    const pagina = await new ContatosDoSiteRepository(adapter).listar();
    expect(pagina.contatos.map((c) => c.nome)).toEqual(['Terceiro', 'Segundo', 'Primeiro']);
    expect(pagina.haMais).toBe(false);
  });

  it('traz no máximo 50 e diz se há mais', async () => {
    const adapter = new InMemoryContatosDoSiteAdapter(Array.from({ length: 51 }, (_, i) => contatoDeTeste({ id: i + 1 })));
    const pagina = await new ContatosDoSiteRepository(adapter).listar();
    expect(pagina.contatos).toHaveLength(50);
    expect(pagina.contatos[0].id).toBe(51);
    expect(pagina.haMais).toBe(true);
  });
});
