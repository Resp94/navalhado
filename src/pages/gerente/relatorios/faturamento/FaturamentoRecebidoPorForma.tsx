import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../../components/ui/feedback/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/feedback/DataTable';
import { PercentageBar } from '../../../../components/ui/data-display/PercentageBar';
import { formatCurrency } from '../../../../lib/currency';
import { formatPercent } from '../../../../modules/relatorios/formatacao';
import type { RelatorioRecebidoPorForma } from '../../../../modules/relatorios/types';

export interface FaturamentoRecebidoPorFormaProps {
  receivedByMethod: RelatorioRecebidoPorForma[];
}

/**
 * Seção "Recebido por forma de pagamento" do Faturamento por período (spec
 * 038, ticket 02, histórias 22-27): barras horizontais de participação
 * (`share`) por forma, com valor, percentual e quantidade de pagamentos
 * escritos como texto -- a distinção entre formas nunca depende só de cor
 * ou do tamanho da barra (rótulo PIX/Dinheiro/Crédito/Débito/Outros
 * sempre visível). A tabela abaixo é o mesmo dado em forma equivalente,
 * mesmo padrão de "toda visualização tem tabela equivalente" da
 * `FaturamentoTabela`. `share` nulo (período sem recebimento) mostra
 * "--", nunca "0%".
 */
export const FaturamentoRecebidoPorForma: React.FC<FaturamentoRecebidoPorFormaProps> = ({ receivedByMethod }) => {
  return (
    <Card variant="outline" className="relatorios-recebido-card">
      <CardHeader>
        <CardTitle>Recebido por forma de pagamento</CardTitle>
        <CardDescription>
          Quanto entrou em PIX, dinheiro, cartão de crédito, cartão de débito e outros no período,
          pela data do pagamento.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relatorios-recebido-barras" role="list">
          {receivedByMethod.map((item) => (
            <div role="listitem" key={item.method}>
              <PercentageBar
                label={item.label}
                value={`${formatCurrency(item.amount)} · ${formatPercent(item.share)}`}
                share={item.share}
                trailing={`${item.payments_count} ${item.payments_count === 1 ? 'pagamento' : 'pagamentos'}`}
              />
            </div>
          ))}
        </div>

        <div className="relatorios-faturamento-tabela-wrap">
          <Table aria-label="Recebido por forma de pagamento">
            <TableHeader>
              <TableRow>
                <TableHead>Forma</TableHead>
                <TableHead align="right">Valor</TableHead>
                <TableHead align="right">Participação</TableHead>
                <TableHead align="right">Pagamentos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receivedByMethod.map((item) => (
                <TableRow key={item.method}>
                  <TableCell>{item.label}</TableCell>
                  <TableCell align="right">{formatCurrency(item.amount)}</TableCell>
                  <TableCell align="right">{formatPercent(item.share)}</TableCell>
                  <TableCell align="right">{item.payments_count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
