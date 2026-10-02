import { describe, expect, it, vi } from 'vitest';
import { TermosRepository } from '../TermosRepository';
import { InMemoryTermosAdapter } from '../adapters/InMemoryTermosAdapter';
import { MENSAGEM_VERSAO_INVALIDA } from '../errors';

// Spec 052, ticket 16: o aceite dos Termos de Uso é por usuário e por versão do texto (a data de publicação, AAAA-MM-DD).

describe('TermosRepository', () => {
  it('quem ainda não aceitou não tem a versão aceita', async () => {
    const repositorio = new TermosRepository(new InMemoryTermosAdapter());

    expect(await repositorio.jaAceitou('2026-10-02')).toBe(false);
  });

  it('depois de aceitar, a versão consta como aceita; uma versão nova, não', async () => {
    const repositorio = new TermosRepository(new InMemoryTermosAdapter());

    await repositorio.aceitar('2026-10-02');

    expect(await repositorio.jaAceitou('2026-10-02')).toBe(true);
    expect(await repositorio.jaAceitou('2026-11-15')).toBe(false);
  });

  it('aceitar duas vezes a mesma versão não é erro', async () => {
    const repositorio = new TermosRepository(new InMemoryTermosAdapter());

    await repositorio.aceitar('2026-10-02');
    await expect(repositorio.aceitar('2026-10-02')).resolves.toBeUndefined();

    expect(await repositorio.jaAceitou('2026-10-02')).toBe(true);
  });

  it('o aceite de uma versão antiga continua valendo ao lado do da versão nova', async () => {
    const repositorio = new TermosRepository(new InMemoryTermosAdapter(['2026-10-02']));

    await repositorio.aceitar('2026-11-15');

    expect(await repositorio.jaAceitou('2026-10-02')).toBe(true);
    expect(await repositorio.jaAceitou('2026-11-15')).toBe(true);
  });

  it.each(['', 'v1', '2026-10-2', ' 2026-10-02', '2026-10-02 ', '2026-10-02\n', 'lixo'])(
    'recusa a versão %j sem chamar o adaptador',
    async (versao) => {
      const adaptador = new InMemoryTermosAdapter();
      const aceitar = vi.spyOn(adaptador, 'aceitar');
      const lerAceite = vi.spyOn(adaptador, 'jaAceitou');
      const repositorio = new TermosRepository(adaptador);

      await expect(repositorio.aceitar(versao)).rejects.toThrow(MENSAGEM_VERSAO_INVALIDA);
      await expect(repositorio.jaAceitou(versao)).rejects.toThrow(MENSAGEM_VERSAO_INVALIDA);

      expect(aceitar).not.toHaveBeenCalled();
      expect(lerAceite).not.toHaveBeenCalled();
    },
  );

  it('a falha do adaptador sobe, para quem chama decidir se abre ou fecha', async () => {
    const adaptador = new InMemoryTermosAdapter();
    vi.spyOn(adaptador, 'jaAceitou').mockRejectedValue(new Error('rede fora do ar'));
    vi.spyOn(adaptador, 'aceitar').mockRejectedValue(new Error('banco recusou'));
    const repositorio = new TermosRepository(adaptador);

    await expect(repositorio.jaAceitou('2026-10-02')).rejects.toThrow('rede fora do ar');
    await expect(repositorio.aceitar('2026-10-02')).rejects.toThrow('banco recusou');
  });
});
