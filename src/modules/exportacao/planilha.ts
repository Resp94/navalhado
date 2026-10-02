import { formatarDocumento } from '../plano-contas/documento';

/**
 * O CSV da Exportação de Dados (spec 052, ticket 14) é aberto no Excel por duplo clique, que lê uma célula só de dígitos como
 * número: o telefone de 13 dígitos aparece como 5,51199E+12 e o CPF perde o zero da frente. Uma célula que começa com "+" é lida
 * como fórmula. Telefone e CPF saem de um jeito que a planilha guarda como texto, sem perder nenhum dígito.
 */

const SO_DIGITOS = /^\d+$/;

/**
 * Telefone de 10 ou 11 dígitos (com DDD) sai como `(92) 99999-0001`; com o 55 do Brasil na frente, `55 (92) 99999-0001`. O que o
 * Gerente já digitou com máscara sai como está, sem o "+" da frente. Outro tamanho só de dígitos também sai como está: não se
 * inventa uma divisão que o número pode não ter.
 */
export function telefoneParaPlanilha(telefone: string | null): string {
  const texto = (telefone?.trim() ?? '').replace(/^\+\s*/, '');
  if (!texto) return '';
  if (!SO_DIGITOS.test(texto)) return texto;

  const comDdi = (texto.length === 12 || texto.length === 13) && texto.startsWith('55');
  const prefixo = comDdi ? '55 ' : '';
  const nacional = comDdi ? texto.slice(2) : texto;
  if (nacional.length === 11) return `${prefixo}(${nacional.slice(0, 2)}) ${nacional.slice(2, 7)}-${nacional.slice(7)}`;
  if (nacional.length === 10) return `${prefixo}(${nacional.slice(0, 2)}) ${nacional.slice(2, 6)}-${nacional.slice(6)}`;
  return texto;
}

/** CPF só de dígitos sai com a máscara (`012.345.678-90`); qualquer outro valor sai como foi guardado. */
export function cpfParaPlanilha(cpf: string | null): string {
  const texto = cpf?.trim() ?? '';
  return /^\d{11}$/.test(texto) ? formatarDocumento(texto) : texto;
}
