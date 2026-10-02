/**
 * Exportação em CSV do Módulo de Relatórios (spec 038, ticket 04,
 * histórias 76-77). Função pura, sem dependência nova: nasce aqui para ser
 * reusada por todas as páginas do módulo, cada uma passando as colunas e
 * linhas já carregadas (mesmo dado que a própria tabela da tela mostra --
 * "toda visualização tem tabela equivalente, e a tabela é o que o CSV
 * exporta").
 *
 * Formato brasileiro exigido pela spec: separador `;` (não `,`, que colide
 * com a vírgula decimal), BOM UTF-8 (para o Excel não corromper acentos) e
 * quebra de linha `\r\n` (convenção do Excel no Windows). Números e datas já
 * chegam formatados em pt-BR pelo chamador (mesmas funções de
 * `formatacao.ts`/`lib/currency` usadas na tabela da tela) -- esta função
 * não reformata valor nenhum, só monta o CSV e escapa o que precisa.
 */

export interface CsvColumn<T> {
  header: string;
  accessor: (row: T) => string;
}

const BOM = '﻿';

/**
 * Campo precisa de aspas quando contém o separador (`;`), aspas (`"`) ou
 * quebra de linha -- nesses casos aspas internas dobram (`"` vira `""`),
 * regra padrão de CSV (RFC 4180).
 *
 * Um campo começando com `=`, `+`, `-`, `@`, tab ou retorno de carro também
 * recebe um apóstrofo na frente: sem isso, Excel e LibreOffice abrem o valor
 * como fórmula, não como texto. Nome de profissional e de fornecedor são
 * texto livre e podem começar com qualquer caractere -- essa injeção de
 * fórmula em CSV é um risco conhecido (CWE-1236), não uma hipótese.
 */
function escapeCsvField(valor: string): string {
  const comApostrofo = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  if (/[;"\r\n]/.test(comApostrofo)) {
    return `"${comApostrofo.replace(/"/g, '""')}"`;
  }
  return comApostrofo;
}

function cabecalhoCsv<T>(columns: CsvColumn<T>[]): string {
  return columns.map((coluna) => escapeCsvField(coluna.header)).join(';');
}

function linhaCsv<T>(columns: CsvColumn<T>[], row: T): string {
  return columns.map((coluna) => escapeCsvField(coluna.accessor(row))).join(';');
}

/**
 * Monta o CSV completo (cabeçalho em pt-BR + uma linha por item de `rows`)
 * já com o BOM UTF-8 na frente, pronto para `baixarCsv`.
 */
export function gerarCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  return BOM + [cabecalhoCsv(columns), ...rows.map((row) => linhaCsv(columns, row))].join('\r\n');
}

const LINHAS_POR_BLOCO = 2000;

const cederAThread = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export interface OpcoesDoCsvEmBlocos {
  /** Quantas linhas se montam de uma vez antes de ceder a thread. */
  linhasPorBloco?: number;
  /** Para a montagem no próximo bloco quando o sinal é cancelado (quem pediu o CSV saiu da tela). */
  sinal?: AbortSignal;
}

/**
 * O mesmo CSV de `gerarCsv`, montado em blocos de linhas com a thread cedida entre eles: uma lista de dezenas de milhares de
 * linhas montada de uma vez deixa a aba sem responder por segundos (a Exportação de Dados, spec 052, ticket 14).
 */
export async function gerarCsvEmBlocos<T>(
  columns: CsvColumn<T>[],
  rows: T[],
  { linhasPorBloco = LINHAS_POR_BLOCO, sinal }: OpcoesDoCsvEmBlocos = {},
): Promise<string> {
  const cancelado = () => new Error('A montagem do CSV foi cancelada.');
  if (sinal?.aborted) throw cancelado();

  const partes = [cabecalhoCsv(columns)];
  for (let inicio = 0; inicio < rows.length; inicio += linhasPorBloco) {
    await cederAThread();
    if (sinal?.aborted) throw cancelado();
    for (const row of rows.slice(inicio, inicio + linhasPorBloco)) partes.push(linhaCsv(columns, row));
  }
  return BOM + partes.join('\r\n');
}

/**
 * Nome de arquivo do CSV: relatório + período, sem espaço e só caracteres
 * seguros (ex.: `faturamento_2026-08-01_a_2026-08-31.csv`). `startDate` e
 * `endDate` já chegam no formato ISO (`aaaa-mm-dd`) do filtro de período,
 * que já é seguro para nome de arquivo.
 */
export function montarNomeArquivoCsv(slug: string, startDate: string, endDate: string): string {
  return `${slug}_${startDate}_a_${endDate}.csv`;
}

/**
 * Dispara o download do CSV no navegador: Blob + URL de objeto temporária +
 * clique num link `<a download>` descartável. Padrão do browser, sem
 * biblioteca nova.
 */
export function baixarCsv(nomeArquivo: string, conteudo: string): void {
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
