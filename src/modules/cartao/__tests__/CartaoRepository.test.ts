import { describe, expect, it } from 'vitest';
import { CartaoRepository } from '../CartaoRepository';
import { InMemoryCartaoAdapter } from '../adapters/InMemoryCartaoAdapter';
import { ErroDoCartao } from '../types';

// Spec 052, ticket 09: o cartão é digitado nos campos seguros do Mercado Pago e o Navalhado só
// recebe o token. O repositório confere o que é do Navalhado (titular e documento) e entrega o
// resto ao adaptador; o número do cartão nunca passa por ele. Cada formulário aberto recebe os
// seus campos, que ele gera o token e desmonta sem mexer nos de outro formulário.

const CPF_VALIDO = '529.982.247-25';
const IDS = { numero: 'numero-1', validade: 'validade-1', codigo: 'codigo-1' };

const montar = () => {
  const adapter = new InMemoryCartaoAdapter();
  return { adapter, repo: new CartaoRepository(adapter) };
};

describe('CartaoRepository', () => {
  it('monta os campos seguros pelo adaptador e desmonta os do formulário quando ele fecha', async () => {
    const { adapter, repo } = montar();

    const campos = await repo.montarCampos(IDS);
    expect(adapter.montados).toEqual([IDS]);

    campos.desmontar();
    expect(adapter.montados).toEqual([]);
  });

  it('dois formulários abertos ao mesmo tempo não desmontam nem usam os campos um do outro', async () => {
    const { adapter, repo } = montar();
    const outrosIds = { numero: 'numero-2', validade: 'validade-2', codigo: 'codigo-2' };
    const primeiro = await repo.montarCampos(IDS);
    const segundo = await repo.montarCampos(outrosIds);
    expect(adapter.montados).toEqual([IDS, outrosIds]);

    primeiro.desmontar();

    expect(adapter.montados).toEqual([outrosIds]);
    await expect(segundo.gerarToken({ nome: 'Maria da Silva', documento: CPF_VALIDO })).resolves.toEqual({
      token: 'token-falso-1',
      final: '0604',
    });
  });

  it('gera o token com o titular normalizado: nome sem espaço sobrando, CPF só com dígitos', async () => {
    const { adapter, repo } = montar();
    const campos = await repo.montarCampos(IDS);

    const cartao = await campos.gerarToken({ nome: '  MARIA   DA SILVA ', documento: CPF_VALIDO });

    expect(cartao).toEqual({ token: 'token-falso-1', final: '0604' });
    expect(adapter.titularesRecebidos).toEqual([{ nome: 'MARIA DA SILVA', documento: '52998224725' }]);
  });

  it('aceita CNPJ como documento do titular', async () => {
    const { adapter, repo } = montar();
    const campos = await repo.montarCampos(IDS);

    await campos.gerarToken({ nome: 'Barbearia do Zé Ltda', documento: '11.222.333/0001-81' });

    expect(adapter.titularesRecebidos[0].documento).toBe('11222333000181');
  });

  it('recusa nome curto demais, sem chamar o adaptador', async () => {
    const { adapter, repo } = montar();
    const campos = await repo.montarCampos(IDS);

    await expect(campos.gerarToken({ nome: ' A ', documento: CPF_VALIDO })).rejects.toMatchObject({
      name: 'ErroDoCartao',
      campo: 'nome',
      message: 'Digite o nome como está no cartão.',
    });
    expect(adapter.titularesRecebidos).toHaveLength(0);
  });

  it.each(['', '123', '111.111.111-11', '529.982.247-24', 'abc'])(
    'recusa o documento %j, sem chamar o adaptador',
    async (documento) => {
      const { adapter, repo } = montar();
      const campos = await repo.montarCampos(IDS);

      const promessa = campos.gerarToken({ nome: 'Maria da Silva', documento });

      await expect(promessa).rejects.toBeInstanceOf(ErroDoCartao);
      await expect(promessa).rejects.toMatchObject({ campo: 'documento', message: 'Digite um CPF ou CNPJ válido.' });
      expect(adapter.titularesRecebidos).toHaveLength(0);
    },
  );

  it('propaga o erro do adaptador (cartão que o Mercado Pago não validou)', async () => {
    const { adapter, repo } = montar();
    const campos = await repo.montarCampos(IDS);
    adapter.falharCom = new ErroDoCartao('Confira o número do cartão.', 'cartao');

    await expect(campos.gerarToken({ nome: 'Maria da Silva', documento: CPF_VALIDO })).rejects.toMatchObject({
      campo: 'cartao',
      message: 'Confira o número do cartão.',
    });
  });

  it('propaga a falha de montar os campos', async () => {
    const { adapter, repo } = montar();
    adapter.falharCom = new ErroDoCartao('Não foi possível carregar o formulário do cartão. Tente de novo.', 'cartao');

    await expect(repo.montarCampos(IDS)).rejects.toMatchObject({ campo: 'cartao' });
    expect(adapter.montados).toEqual([]);
  });
});
