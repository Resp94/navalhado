import { HugeiconsIcon } from '@hugeicons/react';
import { Download04Icon } from '@hugeicons/core-free-icons';
import { Button } from '../forms/Button';
import type { CsvColumn } from '../../../modules/relatorios/csv';
import { baixarCsv, gerarCsv, montarNomeArquivoCsv } from '../../../modules/relatorios/csv';

export interface ExportarCsvButtonProps<T> {
  /** Colunas e linhas já carregadas -- o mesmo dado que a tabela da tela mostra. */
  columns: CsvColumn<T>[];
  rows: T[];
  /** Nome curto do relatório/seção, ex. "faturamento" ou "recebido-por-forma". */
  reportSlug: string;
  startDate: string;
  endDate: string;
  label?: string;
}

/**
 * Botão "Exportar CSV" reutilizável (spec 038, ticket 04, histórias 76-77):
 * qualquer página do Módulo de Relatórios passa suas colunas e linhas já
 * carregadas -- nenhuma ida nova à rede -- e o clique gera o CSV em memória
 * e dispara o download. Desabilitado quando não há linha para exportar.
 */
export function ExportarCsvButton<T>({
  columns,
  rows,
  reportSlug,
  startDate,
  endDate,
  label = 'Exportar CSV',
}: ExportarCsvButtonProps<T>) {
  const handleClick = () => {
    const csv = gerarCsv(columns, rows);
    const nomeArquivo = montarNomeArquivoCsv(reportSlug, startDate, endDate);
    baixarCsv(nomeArquivo, csv);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      leftIcon={<HugeiconsIcon icon={Download04Icon} size={16} />}
      onClick={handleClick}
      disabled={rows.length === 0}
    >
      {label}
    </Button>
  );
}
