import { documentoValido, normalizarDocumento } from '../plano-contas/documento';
import { ErroDoCartao } from './types';
import type { CamposDoCartao, DadosDoTitular, ICartaoAdapter, IdsDosCampos } from './types';

const TAMANHO_MINIMO_DO_NOME = 3;

/**
 * Cartão para a assinatura. Confere o que é do Navalhado (nome e documento do titular) e entrega o
 * resto ao adaptador, que fala com os campos seguros do Mercado Pago. O número do cartão nunca
 * passa por aqui: o repositório só vê o token que volta.
 */
export class CartaoRepository {
  private adapter: ICartaoAdapter;

  constructor(adapter: ICartaoAdapter) {
    this.adapter = adapter;
  }

  /** Monta os campos seguros de um formulário. Cada formulário fica com os seus campos. */
  async montarCampos(ids: IdsDosCampos): Promise<CamposDoCartao> {
    const campos = await this.adapter.montarCampos(ids);

    return {
      // O token só sai com o titular já conferido e normalizado.
      gerarToken: (titular) => this.gerarToken(campos, titular),
      desmontar: () => campos.desmontar(),
    };
  }

  private async gerarToken(campos: CamposDoCartao, titular: DadosDoTitular): Promise<string> {
    const nome = titular.nome.trim().replace(/\s+/g, ' ');
    if (nome.length < TAMANHO_MINIMO_DO_NOME) {
      throw new ErroDoCartao('Digite o nome como está no cartão.', 'nome');
    }

    const documento = normalizarDocumento(titular.documento);
    if (!documentoValido(documento)) {
      throw new ErroDoCartao('Digite um CPF ou CNPJ válido.', 'documento');
    }

    return campos.gerarToken({ nome, documento });
  }
}
