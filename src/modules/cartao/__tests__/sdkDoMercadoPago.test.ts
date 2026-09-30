import { afterEach, describe, expect, it } from 'vitest';
import { carregarSdkDoMercadoPago, URL_DO_SDK_DO_MERCADO_PAGO } from '../adapters/sdkDoMercadoPago';

// Spec 052, ticket 09: o SDK do Mercado Pago é um script externo, carregado só quando o Gerente
// abre o formulário do cartão, uma vez só.

const scriptsDoSdk = () => document.querySelectorAll(`script[src="${URL_DO_SDK_DO_MERCADO_PAGO}"]`);

describe('carregarSdkDoMercadoPago', () => {
  afterEach(() => {
    scriptsDoSdk().forEach((script) => script.remove());
    delete (window as { MercadoPago?: unknown }).MercadoPago;
  });

  it('adiciona o script do Mercado Pago uma vez só e resolve com o construtor quando ele carrega', async () => {
    const promessa1 = carregarSdkDoMercadoPago();
    const promessa2 = carregarSdkDoMercadoPago();

    expect(scriptsDoSdk()).toHaveLength(1);
    const construtor = function MercadoPagoFalso() {} as unknown;
    (window as { MercadoPago?: unknown }).MercadoPago = construtor;
    scriptsDoSdk()[0].dispatchEvent(new Event('load'));

    await expect(promessa1).resolves.toBe(construtor);
    await expect(promessa2).resolves.toBe(construtor);
  });

  it('com o SDK já na página, resolve na hora sem adicionar outro script', async () => {
    const construtor = function MercadoPagoFalso() {} as unknown;
    (window as { MercadoPago?: unknown }).MercadoPago = construtor;

    await expect(carregarSdkDoMercadoPago()).resolves.toBe(construtor);
    expect(scriptsDoSdk()).toHaveLength(0);
  });

  it('script que não carrega rejeita, e a tentativa seguinte adiciona o script de novo', async () => {
    const primeira = carregarSdkDoMercadoPago();
    scriptsDoSdk()[0].dispatchEvent(new Event('error'));
    await expect(primeira).rejects.toThrow(/mercado pago/i);

    const segunda = carregarSdkDoMercadoPago();
    expect(scriptsDoSdk()).toHaveLength(1);
    (window as { MercadoPago?: unknown }).MercadoPago = function MercadoPagoFalso() {};
    scriptsDoSdk()[0].dispatchEvent(new Event('load'));
    await expect(segunda).resolves.toBeTypeOf('function');
  });

  it('script que carrega mas não deixa o MercadoPago na janela é erro', async () => {
    const promessa = carregarSdkDoMercadoPago();
    scriptsDoSdk()[0].dispatchEvent(new Event('load'));

    await expect(promessa).rejects.toThrow(/mercado pago/i);
  });
});
