import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { MercadoPagoCartaoAdapter } from '../adapters/MercadoPagoCartaoAdapter';
import { ErroDoCartao } from '../types';
import type { MercadoPagoConstrutor } from '../adapters/sdkDoMercadoPago';

// Spec 052, ticket 09: o adaptador fala com o MercadoPago.js (Secure Fields). O SDK é falso: o que
// se confere é que a Public Key vem da função de cobrança, que os três campos são montados nos
// elementos certos, que cada formulário tem a sua instância do SDK (com os seus campos) e que só o
// titular (nome e documento) é passado ao SDK, junto dos campos seguros, para gerar o token.

interface CampoMontado {
  instancia: number;
  tipo: string;
  id: string;
  desmontado: boolean;
}

const criarSdkFalso = () => {
  const estado = {
    chaves: [] as string[],
    opcoes: [] as unknown[],
    campos: [] as CampoMontado[],
    dadosDoToken: [] as Array<{ instancia: number; dados: unknown }>,
    resposta: { id: 'token-do-sdk' } as unknown,
    rejeicao: null as unknown,
    /** Tipo de campo cuja montagem falha (o elemento não existe mais, por exemplo). */
    falharAoMontar: null as string | null,
  };

  class MercadoPagoFalso {
    private numero: number;

    constructor(chave: string, opcoes?: unknown) {
      estado.chaves.push(chave);
      estado.opcoes.push(opcoes);
      this.numero = estado.chaves.length;
    }

    fields = {
      create: (tipo: string) => ({
        mount: (id: string) => {
          if (estado.falharAoMontar === tipo) throw new Error(`elemento ${id} não encontrado`);
          const campo = { instancia: this.numero, tipo, id, desmontado: false };
          estado.campos.push(campo);
          return { unmount: () => { campo.desmontado = true; } };
        },
      }),
      createCardToken: async (dados: unknown) => {
        estado.dadosDoToken.push({ instancia: this.numero, dados });
        if (estado.rejeicao) throw estado.rejeicao;
        return estado.resposta;
      },
    };
  }

  return { estado, sdk: MercadoPagoFalso as unknown as MercadoPagoConstrutor };
};

const ids = { numero: 'campo-numero', validade: 'campo-validade', codigo: 'campo-codigo' };
const titular = { nome: 'Maria da Silva', documento: '52998224725' };

describe('MercadoPagoCartaoAdapter', () => {
  let obterChavePublica: Mock<() => Promise<string>>;

  beforeEach(() => {
    obterChavePublica = vi.fn<() => Promise<string>>().mockResolvedValue('APP_USR-public-key');
  });

  const montarAdaptador = () => {
    const { estado, sdk } = criarSdkFalso();
    const carregarSdk = vi.fn().mockResolvedValue(sdk);
    return { estado, carregarSdk, adapter: new MercadoPagoCartaoAdapter({ obterChavePublica, carregarSdk }) };
  };

  it('monta número, validade e código nos elementos, com a Public Key da função de cobrança', async () => {
    const { adapter, estado } = montarAdaptador();

    await adapter.montarCampos(ids);

    expect(estado.chaves).toEqual(['APP_USR-public-key']);
    expect(estado.opcoes).toEqual([{ locale: 'pt-BR' }]);
    expect(estado.campos.map(({ tipo, id }) => [tipo, id])).toEqual([
      ['cardNumber', 'campo-numero'],
      ['expirationDate', 'campo-validade'],
      ['securityCode', 'campo-codigo'],
    ]);
  });

  it('gera o token passando ao SDK só o titular (nome e documento)', async () => {
    const { adapter, estado } = montarAdaptador();
    const campos = await adapter.montarCampos(ids);

    const token = await campos.gerarToken({ nome: 'MARIA DA SILVA', documento: '52998224725' });

    expect(token).toBe('token-do-sdk');
    expect(estado.dadosDoToken.map(({ dados }) => dados)).toEqual([
      { cardholderName: 'MARIA DA SILVA', identificationType: 'CPF', identificationNumber: '52998224725' },
    ]);
  });

  it('documento de 14 caracteres vai como CNPJ', async () => {
    const { adapter, estado } = montarAdaptador();
    const campos = await adapter.montarCampos(ids);

    await campos.gerarToken({ nome: 'Barbearia do Zé', documento: '11222333000181' });

    expect(estado.dadosDoToken[0].dados).toMatchObject({ identificationType: 'CNPJ', identificationNumber: '11222333000181' });
  });

  it('cartão que o Mercado Pago não validou (lista de erros do SDK) vira mensagem para o Gerente', async () => {
    const { adapter, estado } = montarAdaptador();
    const campos = await adapter.montarCampos(ids);
    estado.rejeicao = [{ code: 'E301', message: 'invalid card number' }];

    const promessa = campos.gerarToken(titular);

    await expect(promessa).rejects.toBeInstanceOf(ErroDoCartao);
    await expect(promessa).rejects.toMatchObject({
      campo: 'cartao',
      message: 'Não foi possível validar o cartão. Confira o número, a validade e o código de segurança.',
    });
  });

  it('a mensagem de erro não repete nada que veio do SDK (que pode citar dados digitados)', async () => {
    const { adapter, estado } = montarAdaptador();
    const campos = await adapter.montarCampos(ids);
    estado.rejeicao = new Error('cardNumber 4509953566233704 invalid');

    await expect(campos.gerarToken(titular)).rejects.toMatchObject({
      message: expect.not.stringContaining('4509'),
    });
  });

  it('resposta do SDK sem o id do token é erro, e não um token vazio', async () => {
    const { adapter, estado } = montarAdaptador();
    const campos = await adapter.montarCampos(ids);
    estado.resposta = {};

    await expect(campos.gerarToken(titular)).rejects.toBeInstanceOf(ErroDoCartao);
  });

  it('desmontar tira os três campos da tela e o formulário deixa de gerar token', async () => {
    const { adapter, estado } = montarAdaptador();
    const campos = await adapter.montarCampos(ids);

    campos.desmontar();

    expect(estado.campos.every((campo) => campo.desmontado)).toBe(true);
    await expect(campos.gerarToken(titular)).rejects.toMatchObject({
      name: 'ErroDoCartao',
      message: 'O formulário do cartão ainda não carregou. Aguarde um instante e tente de novo.',
    });
    expect(estado.dadosDoToken).toHaveLength(0);
  });

  it('cada formulário tem a sua instância do SDK: desmontar um não mexe nos campos do outro', async () => {
    const { adapter, estado } = montarAdaptador();
    const primeiro = await adapter.montarCampos(ids);
    const segundo = await adapter.montarCampos({ numero: 'n2', validade: 'v2', codigo: 'c2' });

    primeiro.desmontar();

    expect(estado.chaves).toHaveLength(2);
    expect(estado.campos.filter((campo) => campo.instancia === 1).every((campo) => campo.desmontado)).toBe(true);
    expect(estado.campos.filter((campo) => campo.instancia === 2).some((campo) => campo.desmontado)).toBe(false);

    await segundo.gerarToken(titular);
    expect(estado.dadosDoToken.map(({ instancia }) => instancia)).toEqual([2]);
  });

  it('montar de novo reaproveita o SDK já carregado e a mesma chave, sem pedir a chave outra vez', async () => {
    const { adapter, carregarSdk } = montarAdaptador();

    const campos = await adapter.montarCampos(ids);
    campos.desmontar();
    await adapter.montarCampos(ids);

    expect(obterChavePublica).toHaveBeenCalledTimes(1);
    expect(carregarSdk).toHaveBeenCalledTimes(1);
  });

  it('um campo que falha ao montar desmonta os que já tinham montado e vira mensagem clara', async () => {
    const { adapter, estado } = montarAdaptador();
    estado.falharAoMontar = 'securityCode';

    await expect(adapter.montarCampos(ids)).rejects.toMatchObject({
      name: 'ErroDoCartao',
      message: 'Não foi possível carregar o formulário do cartão. Tente de novo.',
    });

    expect(estado.campos).toHaveLength(2);
    expect(estado.campos.every((campo) => campo.desmontado)).toBe(true);
  });

  it('falha ao carregar o SDK ou a chave vira mensagem clara e deixa tentar de novo', async () => {
    const { sdk } = criarSdkFalso();
    const carregarSdk = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(sdk);
    const adapter = new MercadoPagoCartaoAdapter({ obterChavePublica, carregarSdk });

    await expect(adapter.montarCampos(ids)).rejects.toMatchObject({
      name: 'ErroDoCartao',
      message: 'Não foi possível carregar o formulário do cartão. Tente de novo.',
    });
    await expect(adapter.montarCampos(ids)).resolves.toMatchObject({
      gerarToken: expect.any(Function),
      desmontar: expect.any(Function),
    });
  });

  it('falha ao pedir a Public Key também vira essa mensagem', async () => {
    const { carregarSdk } = montarAdaptador();
    obterChavePublica.mockRejectedValue(new Error('403'));
    const adapter = new MercadoPagoCartaoAdapter({ obterChavePublica, carregarSdk });

    await expect(adapter.montarCampos(ids)).rejects.toMatchObject({
      message: 'Não foi possível carregar o formulário do cartão. Tente de novo.',
    });
  });
});
