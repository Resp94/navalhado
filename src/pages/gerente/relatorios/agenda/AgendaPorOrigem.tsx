import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../../components/ui/feedback/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/feedback/DataTable';
import { EmptyState } from '../../../../components/ui/data-display/EmptyState';
import { formatPercent } from '../../../../modules/relatorios/formatacao';
import type { RelatorioAgendaOrigem, RelatorioAgendaOrigemTotais } from '../../../../modules/relatorios/types';

/** Rótulo de exibição de cada origem do Agendamento (spec 038, ticket 07). */
export const ORIGEM_LABELS: Record<RelatorioAgendaOrigem, string> = {
  manual: 'Painel',
  online: 'Link público',
  client_channel: 'Canal do Cliente',
  whatsapp: 'WhatsApp',
};

export function formatOrigemLabel(origin: string): string {
  return ORIGEM_LABELS[origin as RelatorioAgendaOrigem] ?? origin;
}

export interface AgendaPorOrigemProps {
  origins: RelatorioAgendaOrigemTotais[];
  /** Botão "Exportar CSV" desta seção, injetado pela página. */
  exportButton?: React.ReactNode;
}

/**
 * Totais por origem do Agendamento (spec 038, ticket 07, história 45):
 * Painel, Link público, Canal do Cliente e WhatsApp -- ajuda o gestor a ver
 * se o agendamento online traz cliente que aparece. Segue o filtro de
 * profissional da página (`p_professional_id` filtra esta lista).
 */
export const AgendaPorOrigem: React.FC<AgendaPorOrigemProps> = ({ origins, exportButton }) => {
  return (
    <Card variant="outline" className="relatorios-agenda-por-origem-card">
      <CardHeader>
        <div className="relatorios-faturamento-secao-header">
          <div className="relatorios-faturamento-secao-titulo">
            <CardTitle>Agendamentos por origem</CardTitle>
            <CardDescription>De onde vieram os Agendamentos do período e quantos viraram atendimento.</CardDescription>
          </div>
          {exportButton}
        </div>
      </CardHeader>
      <CardContent>
        {origins.length === 0 ? (
          <EmptyState
            title="Nenhum Agendamento no período"
            description="Não há Agendamento com início no período e no filtro de profissional selecionados."
          />
        ) : (
          <div className="relatorios-faturamento-tabela-wrap">
            <Table aria-label="Agendamentos por origem">
              <TableHeader>
                <TableRow>
                  <TableHead>Origem</TableHead>
                  <TableHead align="right">Total</TableHead>
                  <TableHead align="right">Concluídos</TableHead>
                  <TableHead align="right">Faltas</TableHead>
                  <TableHead align="right">Cancelados</TableHead>
                  <TableHead align="right">Sem desfecho</TableHead>
                  <TableHead align="right">Taxa de comparecimento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {origins.map((origem) => (
                  <TableRow key={origem.origin}>
                    <TableCell>{formatOrigemLabel(origem.origin)}</TableCell>
                    <TableCell align="right">{origem.total}</TableCell>
                    <TableCell align="right">{origem.completed}</TableCell>
                    <TableCell align="right">{origem.no_show}</TableCell>
                    <TableCell align="right">{origem.canceled}</TableCell>
                    <TableCell align="right">{origem.unresolved}</TableCell>
                    <TableCell align="right">{formatPercent(origem.attendance_rate)}</TableCell>
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
