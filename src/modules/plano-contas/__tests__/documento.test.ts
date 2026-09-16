import { describe, expect, it } from 'vitest';
import {
  documentoValido,
  formatarDocumento,
  normalizarDocumento,
  tipoDocumento,
} from '../documento';

// Vetores de documento do ticket 05 da spec 035. Este conjunto é IDÊNTICO ao
// de supabase/tests/database/28_plano_de_contas.test.sql, que testa
// private.is_valid_br_document. Alterar um exige alterar o outro: é a igualdade
// dos vetores que impede as duas implementações de divergirem.
// Os vetores são documentos já normalizados (a forma gravada no banco).
const VETORES_DOCUMENTO: ReadonlyArray<readonly [documento: string, valido: boolean, caso: string]> = [
  ['52998224725', true, 'CPF válido'],
  ['11222333000181', true, 'CNPJ numérico válido'],
  ['12ABC34501DE35', true, 'CNPJ alfanumérico válido (exemplo da Receita Federal)'],
  ['52998224724', false, 'CPF com dígito verificador errado'],
  ['11222333000182', false, 'CNPJ numérico com dígito verificador errado'],
  ['12ABC34501DE36', false, 'CNPJ alfanumérico com dígito verificador errado'],
  ['12ABC34501DE3A', false, 'CNPJ com letra na posição de dígito verificador'],
  ['11111111111', false, 'CPF com sequência repetida'],
  ['00000000000000', false, 'CNPJ com sequência repetida'],
  ['', false, 'comprimento zero'],
  ['5299822472', false, 'comprimento 10'],
  ['529982247250', false, 'comprimento 12'],
  ['112223330001810', false, 'comprimento 15'],
  ['52998224A25', false, 'letra em CPF'],
  ['12abc34501de35', false, 'minúscula não é forma normalizada'],
  ['529.982.247-25', false, 'máscara não é forma normalizada'],
];

describe('documentoValido', () => {
  it.each(VETORES_DOCUMENTO)('%s -> %s (%s)', (documento, valido) => {
    expect(documentoValido(documento)).toBe(valido);
  });
});

describe('normalizarDocumento', () => {
  it('descarta pontos, barras, hífens e espaços', () => {
    expect(normalizarDocumento('529.982.247-25')).toBe('52998224725');
    expect(normalizarDocumento(' 11.222.333/0001-81 ')).toBe('11222333000181');
  });

  it('converte letras para maiúsculas', () => {
    expect(normalizarDocumento('12.abc.345/01de-35')).toBe('12ABC34501DE35');
  });

  it('não descarta outros caracteres, que tornam o documento inválido', () => {
    const normalizado = normalizarDocumento('(529) 982.247-25');
    expect(normalizado).toBe('(529)98224725');
    expect(documentoValido(normalizado)).toBe(false);
  });

  it('documento com máscara é válido depois de normalizado', () => {
    expect(documentoValido(normalizarDocumento('12.ABC.345/01DE-35'))).toBe(true);
  });
});

describe('tipoDocumento', () => {
  it('deriva o tipo do comprimento', () => {
    expect(tipoDocumento('52998224725')).toBe('cpf');
    expect(tipoDocumento('12ABC34501DE35')).toBe('cnpj');
    expect(tipoDocumento('123456789012')).toBeNull();
  });
});

describe('formatarDocumento', () => {
  it('aplica a máscara de CPF para onze caracteres', () => {
    expect(formatarDocumento('52998224725')).toBe('529.982.247-25');
  });

  it('aplica a máscara de CNPJ para catorze caracteres, inclusive alfanumérico', () => {
    expect(formatarDocumento('11222333000181')).toBe('11.222.333/0001-81');
    expect(formatarDocumento('12ABC34501DE35')).toBe('12.ABC.345/01DE-35');
  });

  it('devolve sem máscara qualquer outro comprimento', () => {
    expect(formatarDocumento('1234')).toBe('1234');
  });
});
