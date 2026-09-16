import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/feedback/DataTable';
import { formatCurrency } from '../../../../lib/currency';
import type { RelatorioFaturamentoBucket } from '../../../../modules/relatorios/types';
import { formatDisplayDate } from '../../../../modules/relatorios/formatacao';

export interface FaturamentoTabelaProps {
  buckets: RelatorioFaturamentoBucket[];
}

/**
 * Tabela por agrupamento do Faturamento por período (spec 038, ticket 01):
 * é a mesma tabela que o CSV (ticket futuro) exportaria -- toda
 * visualização tem equivalente em tabela. Rola na horizontal dentro do
 * próprio contêiner (`.relatorios-faturamento-tabela-wrap`), nunca a
 * página inteira.
 */
export const FaturamentoTabela: React.FC<FaturamentoTabelaProps> = ({ buckets }) => {
  return (
    <div className="relatorios-faturamento-tabela-wrap">
      <Table aria-label="Faturamento por agrupamento">
        <TableHeader>
          <TableRow>
            <TableHead>Período</TableHead>
            <TableHead align="right">Bruto</TableHead>
            <TableHead align="right">Descontos</TableHead>
            <TableHead align="right">Líquido</TableHead>
            <TableHead align="right">Serviços</TableHead>
            <TableHead align="right">Produtos</TableHead>
            <TableHead align="right">Gorjetas</TableHead>
            <TableHead align="right">Comandas fechadas</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {buckets.map((bucket) => (
            <TableRow key={`${bucket.start_date}-${bucket.end_date}`}>
              <TableCell>
                {bucket.start_date === bucket.end_date
                  ? formatDisplayDate(bucket.start_date)
                  : `${formatDisplayDate(bucket.start_date)} a ${formatDisplayDate(bucket.end_date)}`}
              </TableCell>
              <TableCell align="right">{formatCurrency(bucket.gross)}</TableCell>
              <TableCell align="right">{formatCurrency(bucket.discounts)}</TableCell>
              <TableCell align="right">{formatCurrency(bucket.net)}</TableCell>
              <TableCell align="right">{formatCurrency(bucket.services_net)}</TableCell>
              <TableCell align="right">{formatCurrency(bucket.products_net)}</TableCell>
              <TableCell align="right">{formatCurrency(bucket.tips)}</TableCell>
              <TableCell align="right">{bucket.closed_comandas}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
