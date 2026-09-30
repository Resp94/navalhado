import { assinaturaRepository } from '../assinatura/repositorio';
import { CartaoRepository } from './CartaoRepository';
import { MercadoPagoCartaoAdapter } from './adapters/MercadoPagoCartaoAdapter';

// Os campos seguros do Mercado Pago. A Public Key vem da função de cobrança: cada ambiente tem a sua, em
// secret do Supabase. O token do cartão só vale para o app que o gerou, então cada uso tem o seu repositório:
// a troca de cartão usa a chave da assinatura, e a cobrança avulsa da diferença do plano usa a da cobrança
// (no DEV, de outro app; em prod, a mesma).
export const cartaoRepository = new CartaoRepository(
  new MercadoPagoCartaoAdapter({ obterChavePublica: () => assinaturaRepository.obterChavePublica() }),
);

export const cartaoDaCobrancaRepository = new CartaoRepository(
  new MercadoPagoCartaoAdapter({ obterChavePublica: () => assinaturaRepository.obterChavePublica('cobranca') }),
);
