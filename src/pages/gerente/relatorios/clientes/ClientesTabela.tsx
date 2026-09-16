import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/feedback/DataTable';
import type { RelatorioClientesBucket } from '../../../../modules/relatorios/types';
import { formatDisplayDate } from '../../../../modules/relatorios/formatacao';

export interface ClientesTabelaProps {
  buckets: RelatorioClientesBucket[];
}

/**
 * Tabela por agrupamento de Novos x recorrentes (spec 038, ticket 10): é a
 * mesma tabela que o CSV exporta -- toda visualização tem equivalente em
 * tabela, mesmo padrão de `FaturamentoTabela`. Rola na horizontal dentro
 * do próprio contêiner (`overflow-x-auto`), nunca a página inteira.
 */
export const ClientesTabela: React.FC<ClientesTabelaProps> = ({ buckets }) => {
  return (
    <div className="overflow-x-auto">
      <Table aria-label="Novos x recorrentes por agrupamento">
        <TableHeader>
          <TableRow>
            <TableHead>Período</TableHead>
            <TableHead align="right">Novos</TableHead>
            <TableHead align="right">Recorrentes</TableHead>
            <TableHead align="right">Total</TableHead>
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
              <TableCell align="right">{bucket.new_customers}</TableCell>
              <TableCell align="right">{bucket.returning_customers}</TableCell>
              <TableCell align="right">{bucket.new_customers + bucket.returning_customers}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
