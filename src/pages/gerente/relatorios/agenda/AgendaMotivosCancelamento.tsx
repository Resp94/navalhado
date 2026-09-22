import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../../components/ui/feedback/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/feedback/DataTable';
import { EmptyState } from '../../../../components/ui/data-display/EmptyState';
import { Badge } from '../../../../components/ui/data-display/Badge';
import type { BadgeVariant } from '../../../../components/ui/data-display/Badge';
import type { RelatorioAgendaMotivoCancelamento, RelatorioAgendaMotivosCancelamento } from '../../../../modules/relatorios/types';

function capitalizar(texto: string): string {
  if (!texto) return texto;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Mesmo vocabulário e cores já usados no Painel de Cancelados do Dia da
 * Agenda para "quem cancelou" (spec 044, ticket 13): rótulo e selo sutil,
 * nunca fundo sólido.
 */
const GRUPOS: Array<{ chave: keyof RelatorioAgendaMotivosCancelamento; rotulo: string; variante: BadgeVariant }> = [
  { chave: 'shop', rotulo: 'Barbearia', variante: 'brand' },
  { chave: 'customer', rotulo: 'Cliente', variante: 'info' },
  { chave: 'desconhecida', rotulo: 'Desconhecido', variante: 'neutral' },
];

function TabelaDoGrupo({ motivos }: { motivos: RelatorioAgendaMotivoCancelamento[] }) {
  return (
    <div className="overflow-x-auto">
      <Table aria-label="Motivos de cancelamento do grupo">
        <TableHeader>
          <TableRow>
            <TableHead>Motivo</TableHead>
            <TableHead align="right">Cancelamentos</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {motivos.map((motivo) => (
            <TableRow key={motivo.reason}>
              <TableCell>{capitalizar(motivo.reason)}</TableCell>
              <TableCell align="right">{motivo.count}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export interface AgendaMotivosCancelamentoProps {
  reasons: RelatorioAgendaMotivosCancelamento;
  /** Botão "Exportar CSV" desta seção, injetado pela página. */
  exportButton?: React.ReactNode;
}

/**
 * Motivos de cancelamento do período (spec 038, ticket 07, história 47),
 * separados por quem cancelou (spec 044, ticket 16): Barbearia, Cliente e
 * Desconhecido (cancelamento anterior à spec 043, sem autoria gravada). Cada
 * grupo já chega normalizado (trim + minúsculas) e ordenado por frequência
 * pelo núcleo do banco -- "sem motivo informado" para vazio, "outros"
 * agrupando o resto além dos dez primeiros. A tela só capitaliza a primeira
 * letra para exibição, sem reordenar nem re-normalizar. Grupo vazio não
 * aparece.
 */
export const AgendaMotivosCancelamento: React.FC<AgendaMotivosCancelamentoProps> = ({ reasons, exportButton }) => {
  const gruposComMotivo = GRUPOS.filter((grupo) => reasons[grupo.chave].length > 0);

  return (
    <Card variant="outline">
      <CardHeader>
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Motivos de cancelamento</CardTitle>
            <CardDescription>Motivos mais frequentes dos Agendamentos cancelados no período, separados por quem cancelou.</CardDescription>
          </div>
          {exportButton}
        </div>
      </CardHeader>
      <CardContent>
        {gruposComMotivo.length === 0 ? (
          <EmptyState
            title="Nenhum cancelamento no período"
            description="Não há Agendamento cancelado no período e no filtro de profissional selecionados."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {gruposComMotivo.map((grupo) => (
              <div key={grupo.chave} className="flex flex-col gap-2">
                <Badge variant={grupo.variante} badgeType="subtle" size="sm">
                  {grupo.rotulo}
                </Badge>
                <TabelaDoGrupo motivos={reasons[grupo.chave]} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
