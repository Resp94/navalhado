import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../../components/ui/feedback/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/feedback/DataTable';
import { EmptyState } from '../../../../components/ui/data-display/EmptyState';
import type { RelatorioAgendaMotivoCancelamento } from '../../../../modules/relatorios/types';

function capitalizar(texto: string): string {
  if (!texto) return texto;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export interface AgendaMotivosCancelamentoProps {
  reasons: RelatorioAgendaMotivoCancelamento[];
  /** Botão "Exportar CSV" desta seção, injetado pela página. */
  exportButton?: React.ReactNode;
}

/**
 * Motivos de cancelamento do período (spec 038, ticket 07, história 47):
 * já chegam normalizados (trim + minúsculas) e ordenados por frequência
 * pelo núcleo do banco -- "sem motivo informado" para vazio, "outros"
 * agrupando o resto além dos dez primeiros. A tela só capitaliza a
 * primeira letra para exibição, sem reordenar nem re-normalizar.
 */
export const AgendaMotivosCancelamento: React.FC<AgendaMotivosCancelamentoProps> = ({ reasons, exportButton }) => {
  return (
    <Card variant="outline" className="relatorios-agenda-motivos-card">
      <CardHeader>
        <div className="relatorios-faturamento-secao-header">
          <div className="relatorios-faturamento-secao-titulo">
            <CardTitle>Motivos de cancelamento</CardTitle>
            <CardDescription>Motivos mais frequentes dos Agendamentos cancelados no período.</CardDescription>
          </div>
          {exportButton}
        </div>
      </CardHeader>
      <CardContent>
        {reasons.length === 0 ? (
          <EmptyState
            title="Nenhum cancelamento no período"
            description="Não há Agendamento cancelado no período e no filtro de profissional selecionados."
          />
        ) : (
          <div className="relatorios-faturamento-tabela-wrap">
            <Table aria-label="Motivos de cancelamento">
              <TableHeader>
                <TableRow>
                  <TableHead>Motivo</TableHead>
                  <TableHead align="right">Cancelamentos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reasons.map((motivo) => (
                  <TableRow key={motivo.reason}>
                    <TableCell>{capitalizar(motivo.reason)}</TableCell>
                    <TableCell align="right">{motivo.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
