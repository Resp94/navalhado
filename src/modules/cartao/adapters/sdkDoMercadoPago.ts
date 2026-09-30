// Carregador do MercadoPago.js (spec 052, ticket 09). É um script externo, carregado só quando o
// Gerente abre o formulário do cartão, uma vez só. Precisa estar liberado no CSP (public/_headers).

export const URL_DO_SDK_DO_MERCADO_PAGO = 'https://sdk.mercadopago.com/js/v2';

/** O pedaço do MercadoPago.js que o Navalhado usa: os campos seguros e a geração do token. */
export interface CampoSeguro {
  mount(idDoElemento: string): { unmount(): void };
}

export interface InstanciaDoMercadoPago {
  fields: {
    create(tipo: 'cardNumber' | 'expirationDate' | 'securityCode', opcoes?: Record<string, unknown>): CampoSeguro;
    createCardToken(dados: {
      cardholderName: string;
      identificationType: string;
      identificationNumber: string;
    }): Promise<{ id?: string; last_four_digits?: unknown }>;
  };
}

export type MercadoPagoConstrutor = new (chavePublica: string, opcoes?: { locale?: string }) => InstanciaDoMercadoPago;

declare global {
  interface Window {
    MercadoPago?: MercadoPagoConstrutor;
  }
}

const MENSAGEM_DE_FALHA = 'Não foi possível carregar o SDK do Mercado Pago.';

let carregando: Promise<MercadoPagoConstrutor> | null = null;

export function carregarSdkDoMercadoPago(): Promise<MercadoPagoConstrutor> {
  if (window.MercadoPago) return Promise.resolve(window.MercadoPago);
  if (carregando) return carregando;

  carregando = new Promise<MercadoPagoConstrutor>((resolver, rejeitar) => {
    const script = document.createElement('script');
    script.src = URL_DO_SDK_DO_MERCADO_PAGO;
    script.async = true;
    script.addEventListener('load', () => {
      carregando = null;
      if (window.MercadoPago) resolver(window.MercadoPago);
      else rejeitar(new Error(MENSAGEM_DE_FALHA));
    });
    script.addEventListener('error', () => {
      // Deixa a próxima tentativa (o Gerente abre o formulário de novo) adicionar o script outra vez.
      carregando = null;
      script.remove();
      rejeitar(new Error(MENSAGEM_DE_FALHA));
    });
    document.head.appendChild(script);
  });

  return carregando;
}
