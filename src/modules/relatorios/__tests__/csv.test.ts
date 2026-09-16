import { describe, expect, it } from 'vitest';
import { gerarCsv, montarNomeArquivoCsv, type CsvColumn } from '../csv';

interface LinhaTeste {
  nome: string;
  valor: string;
}

const colunas: CsvColumn<LinhaTeste>[] = [
  { header: 'Nome', accessor: (row) => row.nome },
  { header: 'Valor', accessor: (row) => row.valor },
];

describe('gerarCsv', () => {
  it('começa com o BOM UTF-8', () => {
    const csv = gerarCsv(colunas, [{ nome: 'Corte', valor: 'R$ 50,00' }]);
    expect(csv.charAt(0)).toBe('﻿');
  });

  it('separa colunas com ponto e vírgula, não vírgula', () => {
    const csv = gerarCsv(colunas, [{ nome: 'Corte', valor: 'R$ 50,00' }]);
    const linhaDados = csv.replace('﻿', '').split('\r\n')[1];
    expect(linhaDados).toBe('Corte;R$ 50,00');
  });

  it('cabeçalho em pt-BR na primeira linha', () => {
    const csv = gerarCsv(colunas, []);
    const cabecalho = csv.replace('﻿', '').split('\r\n')[0];
    expect(cabecalho).toBe('Nome;Valor');
  });

  it('preserva vírgula decimal sem escapar (vírgula sozinha não exige aspas)', () => {
    const csv = gerarCsv(colunas, [{ nome: 'Barba', valor: '35,50' }]);
    expect(csv).toContain('Barba;35,50');
    expect(csv).not.toContain('"35,50"');
  });

  it('preserva data no formato dd/mm/aaaa', () => {
    const csv = gerarCsv(colunas, [{ nome: '15/06/2026', valor: '10,00' }]);
    expect(csv).toContain('15/06/2026');
  });

  it('usa CRLF entre as linhas (convenção do Excel)', () => {
    const csv = gerarCsv(colunas, [
      { nome: 'A', valor: '1' },
      { nome: 'B', valor: '2' },
    ]);
    expect(csv).toContain('\r\n');
  });

  it('escapa campo com ponto e vírgula entre aspas', () => {
    const csv = gerarCsv(colunas, [{ nome: 'Corte; Barba', valor: '60,00' }]);
    const linhaDados = csv.replace('﻿', '').split('\r\n')[1];
    expect(linhaDados).toBe('"Corte; Barba";60,00');
  });

  it('escapa campo com aspas dobrando as aspas internas', () => {
    const csv = gerarCsv(colunas, [{ nome: 'Corte "Navalha"', valor: '40,00' }]);
    const linhaDados = csv.replace('﻿', '').split('\r\n')[1];
    expect(linhaDados).toBe('"Corte ""Navalha""";40,00');
  });

  it('escapa campo com quebra de linha entre aspas', () => {
    const csv = gerarCsv(colunas, [{ nome: 'Linha 1\nLinha 2', valor: '10,00' }]);
    const linhaDados = csv.replace('﻿', '').split('\r\n')[1];
    expect(linhaDados).toBe('"Linha 1\nLinha 2";10,00');
  });

  it('gera só o cabeçalho quando não há linhas', () => {
    const csv = gerarCsv(colunas, []);
    expect(csv).toBe('﻿Nome;Valor');
  });

  it.each(['=1+1', '+1+1', '-1+1', '@SUM(A1:A2)'])(
    'prefixa com apóstrofo campo começando com %s, para não virar fórmula no Excel',
    (valorPerigoso) => {
      const csv = gerarCsv(colunas, [{ nome: valorPerigoso, valor: '10,00' }]);
      const linhaDados = csv.replace('﻿', '').split('\r\n')[1];
      expect(linhaDados).toBe(`'${valorPerigoso};10,00`);
    }
  );

  it('não prefixa campo que só contém esses caracteres no meio', () => {
    const csv = gerarCsv(colunas, [{ nome: 'Corte + Barba', valor: '10,00' }]);
    const linhaDados = csv.replace('﻿', '').split('\r\n')[1];
    expect(linhaDados).toBe('Corte + Barba;10,00');
  });
});

describe('montarNomeArquivoCsv', () => {
  it('monta nome com relatório e período, sem espaço', () => {
    expect(montarNomeArquivoCsv('faturamento', '2026-08-01', '2026-08-31')).toBe(
      'faturamento_2026-08-01_a_2026-08-31.csv'
    );
  });
});
