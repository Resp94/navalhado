// Documento do Fornecedor: CPF ou CNPJ, incluindo o CNPJ alfanumérico da
// Receita Federal (spec 035, ticket 05).
//
// Mesmo algoritmo de private.is_valid_br_document, que é a autoridade no banco.
// Aqui serve só para retorno imediato no formulário. As duas implementações
// são cobertas pelo mesmo conjunto de vetores de teste.

export type TipoDocumento = 'cpf' | 'cnpj';

const COMPRIMENTO_CPF = 11;
const COMPRIMENTO_CNPJ = 14;

/** Descarta pontos, barras, hífens e espaços e converte letras para maiúsculas. */
export function normalizarDocumento(entrada: string): string {
  return entrada.replace(/[.\-/\s]/g, '').toUpperCase();
}

/** O tipo é derivado do comprimento do documento normalizado. */
export function tipoDocumento(documento: string): TipoDocumento | null {
  if (documento.length === COMPRIMENTO_CPF) return 'cpf';
  if (documento.length === COMPRIMENTO_CNPJ) return 'cnpj';
  return null;
}

/** Valida um documento já normalizado (sem máscara, letras maiúsculas). */
export function documentoValido(documento: string): boolean {
  const tipo = tipoDocumento(documento);
  if (tipo === null) return false;
  if (tipo === 'cpf' && !/^[0-9]{11}$/.test(documento)) return false;
  if (tipo === 'cnpj' && !/^[0-9A-Z]{12}[0-9]{2}$/.test(documento)) return false;

  // Sequência de um único caractere repetido passa no cálculo, mas é inválida.
  if (/^(.)\1*$/.test(documento)) return false;

  const tamanho = documento.length;
  // Primeiro dígito verificador sobre as posições anteriores a ele; o segundo,
  // sobre essas posições mais o primeiro dígito.
  for (let tamanhoCorpo = tamanho - 2; tamanhoCorpo <= tamanho - 1; tamanhoCorpo++) {
    let soma = 0;
    for (let i = 0; i < tamanhoCorpo; i++) {
      // Valor do caractere = código ASCII - 48 (dígitos valem 0-9, letras 17-42).
      const valor = documento.charCodeAt(i) - 48;
      const distanciaDaDireita = tamanhoCorpo - 1 - i;
      // CPF: pesos decrescentes até 2. CNPJ: pesos 2..9 cíclicos a partir da direita.
      const peso = tipo === 'cpf' ? distanciaDaDireita + 2 : (distanciaDaDireita % 8) + 2;
      soma += valor * peso;
    }
    const resto = soma % 11;
    const digitoVerificador = resto < 2 ? 0 : 11 - resto;
    if (digitoVerificador !== documento.charCodeAt(tamanhoCorpo) - 48) return false;
  }

  return true;
}

/** Aplica a máscara de CPF ou de CNPJ conforme o comprimento; outro comprimento volta sem máscara. */
export function formatarDocumento(documento: string): string {
  const tipo = tipoDocumento(documento);
  if (tipo === 'cpf') {
    return documento.replace(/^(.{3})(.{3})(.{3})(.{2})$/, '$1.$2.$3-$4');
  }
  if (tipo === 'cnpj') {
    return documento.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, '$1.$2.$3/$4-$5');
  }
  return documento;
}
