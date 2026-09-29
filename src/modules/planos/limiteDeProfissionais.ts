import { pluralizar } from '../../lib/plural';
import type { Plano } from './types';

// O gatilho de public.professionals recusa o profissional acima do limite do plano
// com SQLSTATE 53400 (configuration_limit_exceeded) e esta mensagem.
const CODIGO_DO_BANCO = '53400';
const MENSAGEM_DO_BANCO = 'PROFESSIONAL_LIMIT_REACHED';

/**
 * A mensagem manda; o código só decide quando a mensagem não veio. 53400 é uma classe
 * genérica do Postgres e não pode, sozinho, esconder outro erro atrás do limite do plano.
 */
export function ehErroDeLimiteDeProfissionais(erro: unknown): boolean {
  if (typeof erro !== 'object' || erro === null) return false;
  const { code, message } = erro as { code?: unknown; message?: unknown };
  if (typeof message === 'string' && message.length > 0) {
    return message.includes(MENSAGEM_DO_BANCO);
  }
  return code === CODIGO_DO_BANCO;
}

/**
 * `ehMaiorPlano`: o plano da barbearia já é o maior do catálogo. Nesse caso não há
 * plano para onde subir e a orientação é falar com o suporte.
 */
export function mensagemDeLimiteDeProfissionais(
  plano: Pick<Plano, 'name' | 'max_professionals'> | null,
  ehMaiorPlano = false
): string {
  const proximoPasso =
    ehMaiorPlano && plano ? 'Para cadastrar mais, fale com o suporte.' : 'Para cadastrar mais, mude para um plano maior.';
  if (!plano) {
    return `Você atingiu o limite de profissionais do seu plano. ${proximoPasso}`;
  }
  const unidade = pluralizar(plano.max_professionals, 'profissional', 'profissionais');
  return `Você atingiu o limite de ${plano.max_professionals} ${unidade} do plano ${plano.name}. ${proximoPasso}`;
}
