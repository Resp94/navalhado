import React, { useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../../components/ui/feedback/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/feedback/DataTable';
import { Badge } from '../../../../components/ui/data-display/Badge';
import { EmptyState } from '../../../../components/ui/data-display/EmptyState';
import { PercentageBar } from '../../../../components/ui/data-display/PercentageBar';
import { Select } from '../../../../components/ui/forms/Select';
import { SegmentedControl } from '../../../../components/ui/navigation/SegmentedControl';
import { formatCurrency } from '../../../../lib/currency';
import { formatCurrencyOrDash, formatPercent } from '../../../../modules/relatorios/formatacao';
import type { ProfissionalRanking, ServicoRanking } from '../../../../modules/relatorios/types';

type CriterioOrdenacao = 'net' | 'quantity';

export interface RankingServicosProps {
  services: ServicoRanking[];
  /** Todos os profissionais do ranking, usados como opções do filtro (sempre a lista inteira, nunca já filtrada). */
  professionals: ProfissionalRanking[];
  professionalId: string;
  onProfessionalIdChange: (professionalId: string) => void;
  /** Botão "Exportar CSV" desta seção, injetado pela página. */
  exportButton?: React.ReactNode;
}

/**
 * Ranking de serviços da página Equipe e Serviços (spec 038, tickets 05-06):
 * todos os serviços executados no período, inclusive arquivados (marcados
 * com `Badge`). O filtro de profissional refaz a busca no servidor com
 * `p_professional_id` -- diferente do ranking de profissionais, que é
 * sempre reordenado só na tela, este filtro muda o próprio conjunto de
 * dados (a spec pede "p_professional_id filtra só a lista de serviços").
 * A alternância líquido/quantidade, por outro lado, é reordenação pura da
 * tela sobre os dados já carregados, sem nova ida à rede -- mesmo padrão
 * do `RankingProfissionais`.
 */
export const RankingServicos: React.FC<RankingServicosProps> = ({
  services,
  professionals,
  professionalId,
  onProfessionalIdChange,
  exportButton,
}) => {
  const [criterio, setCriterio] = useState<CriterioOrdenacao>('net');

  const linhas = useMemo(
    () => [...services].sort((a, b) => b[criterio] - a[criterio]),
    [services, criterio]
  );

  return (
    <Card variant="outline">
      <CardHeader>
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Ranking de serviços</CardTitle>
            <CardDescription>Quantidade, líquido, participação e valor médio por serviço executado.</CardDescription>
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

          <SegmentedControl<CriterioOrdenacao>
            aria-label="Ordenar por"
            value={criterio}
            onChange={setCriterio}
            options={[
              { id: 'net', label: 'Por líquido' },
              { id: 'quantity', label: 'Por quantidade' },
            ]}
            size="sm"
            fullWidth={false}
          />
        </div>
      </CardHeader>
      <CardContent>
        {services.length === 0 ? (
          <EmptyState
            title="Nenhum serviço executado no período"
            description="Não há item de serviço reconhecido para o período e o filtro de profissional selecionados."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table aria-label="Ranking de serviços">
              <TableHeader>
                <TableRow>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead align="right">Quantidade</TableHead>
                  <TableHead align="right">Líquido</TableHead>
                  <TableHead align="right">Participação</TableHead>
                  <TableHead align="right">Valor médio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((servico) => (
                  <TableRow key={servico.service_id}>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        {servico.name}
                        {servico.archived && (
                          <Badge variant="neutral" size="xs">
                            Arquivado
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>{servico.category}</TableCell>
                    <TableCell align="right">{servico.quantity}</TableCell>
                    <TableCell align="right">{formatCurrency(servico.net)}</TableCell>
                    <TableCell align="right">
                      <PercentageBar
                        label=""
                        value={formatPercent(servico.share)}
                        share={servico.share}
                        className="min-w-[140px]"
                      />
                    </TableCell>
                    <TableCell align="right">{formatCurrencyOrDash(servico.average_unit_net)}</TableCell>
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
