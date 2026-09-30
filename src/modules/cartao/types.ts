// Cartão nos campos seguros do Mercado Pago (spec 052, ticket 09). O número, a validade e o
// código de segurança são digitados em campos que o Mercado Pago hospeda (iframes): nunca passam
// pelo Navalhado. O que sai dali é um token, e só o token segue para a função de cobrança.

/** Quem o cartão pertence: o Mercado Pago exige o nome e o documento do titular para gerar o token. */
export interface DadosDoTitular {
  nome: string;
  /** CPF ou CNPJ, só com os caracteres do documento (sem máscara). */
  documento: string;
}

/** Ids dos três elementos da tela onde o Mercado Pago monta os campos seguros. */
export interface IdsDosCampos {
  numero: string;
  validade: string;
  codigo: string;
}

/**
 * Os campos seguros de UM formulário, já montados na tela. Quem os montou gera o token com eles e os
 * desmonta ao fechar, sem mexer nos campos de outro formulário aberto ao mesmo tempo.
 */
export interface CamposDoCartao {
  /** Gera o token do cartão digitado nestes campos seguros. */
  gerarToken(titular: DadosDoTitular): Promise<string>;
  /** Tira os campos da tela (o formulário fechou). Depois disso não gera mais token. */
  desmontar(): void;
}

export interface ICartaoAdapter {
  /** Monta os campos seguros nos elementos e devolve os campos deste formulário. */
  montarCampos(ids: IdsDosCampos): Promise<CamposDoCartao>;
}

/** Qual parte do formulário o erro é: o Gerente vê a mensagem perto do campo certo. */
export type CampoDoErro = 'nome' | 'documento' | 'cartao';

/** Erro com texto pronto para o Gerente. Nunca leva o que foi digitado. */
export class ErroDoCartao extends Error {
  readonly campo: CampoDoErro;

  constructor(mensagem: string, campo: CampoDoErro) {
    super(mensagem);
    this.name = 'ErroDoCartao';
    this.campo = campo;
  }
}
