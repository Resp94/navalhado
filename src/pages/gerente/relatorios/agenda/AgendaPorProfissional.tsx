import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../../components/ui/feedback/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/feedback/DataTable';
import { Badge } from '../../../../components/ui/data-display/Badge';
import { EmptyState } from '../../../../components/ui/data-display/EmptyState';
import { Select } from '../../../../components/ui/forms/Select';
import { formatPercent } from '../../../../modules/relatorios/formatacao';
import type { RelatorioAgendaProfissionalTotais } from '../../../../modules/relatorios/types';

export interface AgendaPorProfissionalProps {
  professionals: RelatorioAgendaProfissionalTotais[];
  professionalId: string;
  onProfessionalIdChange: (professionalId: string) => void;
  /** Botão "Exportar CSV" desta seção, injetado pela página. */
  exportButton?: React.ReactNode;
}

/**
 * Totais por profissional da Agenda (spec 038, ticket 07, história 46):
 * SEMPRE a lista inteira de profissionais do tenant com Agendamento no
 * período, inclusive inativos e arquivados -- o filtro de profissional
 * desta mesma página (`p_professional_id`) NUNCA atinge esta tabela, o
 * inverso da regra do ranking de serviços do ticket 05/06 (lá o filtro
 * também vivia perto de uma tabela que ele não afetava, mas era a de
 * profissionais; aqui é a de serviços/origem/motivos que ele afeta, e esta
 * tabela de profissionais que fica de fora). O `<Select>` mora aqui, perto
 * da tabela que NÃO é filtrada por ele, com um aviso textual explícito
 * logo abaixo do título -- decisão de UI deste ticket: colocar o filtro ao
 * lado da única tabela que ele não afeta, sem aviso, confundiria mais o
 * gestor do que ajudar (ele veria o `<Select>` e assumiria que a tabela ao
 * lado reage a ele).
 */
export const AgendaPorProfissional: React.FC<AgendaPorProfissionalProps> = ({
  professionals,
  professionalId,
  onProfessionalIdChange,
  exportButton,
}) => {
  return (
    <Card variant="outline">
      <CardHeader>
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Agendamentos por profissional</CardTitle>
            <CardDescription>
              Sempre todos os profissionais com Agendamento no período, inclusive inativos e arquivados -- esta
              tabela nunca é filtrada pelo seletor abaixo.
            </CardDescription>
          </div>
          {exportButton}
        </div>

        <div className="flex items-center gap-3 flex-wrap mt-3">
          <Select
            aria-label="Filtrar por profissional"
            value={professionalId}
            onChange={(event) => onProfessionalIdChange(event.target.value)}
            className="max-w-[260px]"
            selectSize="sm"
          >
            <option value="">Todos os profissionais</option>
            {professionals.map((profissional) => (
              <option key={profissional.professional_id} value={profissional.professional_id}>
                {profissional.name}
              </option>
            ))}
          </Select>
          <span className="text-xs text-text-secondary">
            Filtra os cartões, a tabela por origem e os motivos de cancelamento acima -- não filtra esta tabela.
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {professionals.length === 0 ? (
          <EmptyState
            title="Nenhum profissional com Agendamento no período"
            description="Não há Agendamento com início no período para nenhum profissional."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table aria-label="Agendamentos por profissional">
              <TableHeader>
                <TableRow>
                  <TableHead>Profissional</TableHead>
                  <TableHead align="right">Total</TableHead>
                  <TableHead align="right">Concluídos</TableHead>
                  <TableHead align="right">Faltas</TableHead>
                  <TableHead align="right">Cancelados</TableHead>
                  <TableHead align="right">Sem desfecho</TableHead>
                  <TableHead align="right">Taxa de comparecimento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {professionals.map((profissional) => (
                  <TableRow key={profissional.professional_id}>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        {profissional.name}
                        {profissional.archived && (
                          <Badge variant="neutral" size="xs">
                            Arquivado
                          </Badge>
                        )}
                        {!profissional.archived && !profissional.is_active && (
                          <Badge variant="neutral" size="xs">
                            Inativo
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell align="right">{profissional.total}</TableCell>
                    <TableCell align="right">{profissional.completed}</TableCell>
                    <TableCell align="right">{profissional.no_show}</TableCell>
                    <TableCell align="right">{profissional.canceled}</TableCell>
                    <TableCell align="right">{profissional.unresolved}</TableCell>
                    <TableCell align="right">{formatPercent(profissional.attendance_rate)}</TableCell>
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
