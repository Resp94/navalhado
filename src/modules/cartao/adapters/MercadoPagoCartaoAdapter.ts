import { ErroDoCartao } from '../types';
import type { CamposDoCartao, DadosDoTitular, ICartaoAdapter, IdsDosCampos } from '../types';
import { carregarSdkDoMercadoPago } from './sdkDoMercadoPago';
import type { InstanciaDoMercadoPago, MercadoPagoConstrutor } from './sdkDoMercadoPago';

const MENSAGEM_AO_CARREGAR = 'Não foi possível carregar o formulário do cartão. Tente de novo.';
const MENSAGEM_SEM_FORMULARIO = 'O formulário do cartão ainda não carregou. Aguarde um instante e tente de novo.';
// Uma mensagem só, sem repetir o que o SDK disse: o texto dele pode citar o que foi digitado.
const MENSAGEM_CARTAO_NAO_VALIDADO =
  'Não foi possível validar o cartão. Confira o número, a validade e o código de segurança.';

interface Dependencias {
  /** A Public Key do ambiente, que a função de cobrança devolve ao Gerente. */
  obterChavePublica: () => Promise<string>;
  carregarSdk?: () => Promise<MercadoPagoConstrutor>;
}

interface SdkPronto {
  chavePublica: string;
  MercadoPago: MercadoPagoConstrutor;
}

/**
 * Campos seguros do MercadoPago.js: o Mercado Pago hospeda os campos do número, da validade e do
 * código de segurança (iframes) dentro dos elementos da tela, e gera o token do cartão. O Navalhado
 * só passa o nome e o documento do titular e recebe o token de volta. Cada formulário monta os seus
 * campos numa instância própria do SDK, para que dois abertos juntos não se atrapalhem.
 */
export class MercadoPagoCartaoAdapter implements ICartaoAdapter {
  private obterChavePublica: () => Promise<string>;
  private carregarSdk: () => Promise<MercadoPagoConstrutor>;
  private sdk: Promise<SdkPronto> | null = null;

  constructor({ obterChavePublica, carregarSdk = carregarSdkDoMercadoPago }: Dependencias) {
    this.obterChavePublica = obterChavePublica;
    this.carregarSdk = carregarSdk;
  }

  async montarCampos(ids: IdsDosCampos): Promise<CamposDoCartao> {
    const montados: Array<{ unmount(): void }> = [];
    try {
      const { chavePublica, MercadoPago } = await this.obterSdk();
      const instancia = new MercadoPago(chavePublica, { locale: 'pt-BR' });
      montados.push(instancia.fields.create('cardNumber', { placeholder: 'Número do cartão' }).mount(ids.numero));
      montados.push(instancia.fields.create('expirationDate', { placeholder: 'MM/AA' }).mount(ids.validade));
      montados.push(instancia.fields.create('securityCode', { placeholder: 'Código de segurança' }).mount(ids.codigo));

      let ativo = true;
      return {
        gerarToken: async (titular) => {
          if (!ativo) throw new ErroDoCartao(MENSAGEM_SEM_FORMULARIO, 'cartao');
          return gerarToken(instancia, titular);
        },
        desmontar: () => {
          ativo = false;
          montados.forEach((campo) => campo.unmount());
        },
      };
    } catch (error) {
      montados.forEach((campo) => campo.unmount());
      console.error('Erro ao montar os campos seguros do cartão:', error instanceof Error ? error.message : 'erro');
      throw new ErroDoCartao(MENSAGEM_AO_CARREGAR, 'cartao');
    }
  }

  /** O SDK e a chave são resolvidos uma vez; abrir o formulário de novo reaproveita os dois. */
  private obterSdk(): Promise<SdkPronto> {
    if (!this.sdk) {
      this.sdk = Promise.all([this.obterChavePublica(), this.carregarSdk()])
        .then(([chavePublica, MercadoPago]) => ({ chavePublica, MercadoPago }))
        .catch((erro) => {
          // Uma falha não fica guardada: abrir o formulário de novo tenta outra vez.
          this.sdk = null;
          throw erro;
        });
    }
    return this.sdk;
  }
}

async function gerarToken(instancia: InstanciaDoMercadoPago, titular: DadosDoTitular): Promise<string> {
  let resposta: { id?: string };
  try {
    resposta = await instancia.fields.createCardToken({
      cardholderName: titular.nome,
      identificationType: titular.documento.length === 14 ? 'CNPJ' : 'CPF',
      identificationNumber: titular.documento,
    });
  } catch {
    throw new ErroDoCartao(MENSAGEM_CARTAO_NAO_VALIDADO, 'cartao');
  }

  if (!resposta?.id) throw new ErroDoCartao(MENSAGEM_CARTAO_NAO_VALIDADO, 'cartao');
  return resposta.id;
}
