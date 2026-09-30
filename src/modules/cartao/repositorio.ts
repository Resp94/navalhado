import { assinaturaRepository } from '../assinatura/repositorio';
import { CartaoRepository } from './CartaoRepository';
import { MercadoPagoCartaoAdapter } from './adapters/MercadoPagoCartaoAdapter';

// Um repositório só, com os campos seguros do Mercado Pago. A Public Key vem da função de cobrança:
// cada ambiente tem a sua, em secret do Supabase.
export const cartaoRepository = new CartaoRepository(
  new MercadoPagoCartaoAdapter({ obterChavePublica: () => assinaturaRepository.obterChavePublica() }),
);
