import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../../components/ui/feedback/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/feedback/DataTable';
import { Badge } from '../../../../components/ui/data-display/Badge';
import { EmptyState } from '../../../../components/ui/data-display/EmptyState';
import { Select } from '../../../../components/ui/forms/Select';
import { formatCurrency } from '../../../../lib/currency';
import { formatCurrencyOrDash, formatPercent } from '../../../../modules/relatorios/formatacao';
import type { ProfissionalRanking, ServicoRanking } from '../../../../modules/relatorios/types';

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
 * Ranking de serviços da página Equipe e Serviços (spec 038, ticket 05):
 * todos os serviços executados no período, inclusive arquivados (marcados
 * com `Badge`), na ordem de líquido decrescente devolvida pela API. O
 * filtro de profissional refaz a busca no servidor com `p_professional_id`
 * -- diferente do ranking de profissionais, que é sempre reordenado só na
 * tela, este filtro muda o próprio conjunto de dados (a spec pede
 * "p_professional_id filtra só a lista de serviços").
 */
export const RankingServicos: React.FC<RankingServicosProps> = ({
  services,
  professionals,
  professionalId,
  onProfessionalIdChange,
  exportButton,
}) => {
  return (
    <Card variant="outline" className="relatorios-ranking-servicos-card">
      <CardHeader>
        <div className="relatorios-faturamento-secao-header">
          <div className="relatorios-faturamento-secao-titulo">
            <CardTitle>Ranking de serviços</CardTitle>
            <CardDescription>Quantidade, líquido, participação e valor médio por serviço executado.</CardDescription>
          </div>
          {exportButton}
        </div>

        <Select
          aria-label="Filtrar por profissional"
          value={professionalId}
          onChange={(event) => onProfessionalIdChange(event.target.value)}
          className="relatorios-ranking-servicos-filtro"
          selectSize="sm"
        >
          <option value="">Todos os profissionais</option>
          {professionals.map((profissional) => (
            <option key={profissional.professional_id} value={profissional.professional_id}>
              {profissional.name}
            </option>
          ))}
        </Select>
      </CardHeader>
      <CardContent>
        {services.length === 0 ? (
          <EmptyState
            title="Nenhum serviço executado no período"
            description="Não há item de serviço reconhecido para o período e o filtro de profissional selecionados."
          />
        ) : (
          <div className="relatorios-faturamento-tabela-wrap">
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
                {services.map((servico) => (
                  <TableRow key={servico.service_id}>
                    <TableCell>
                      <span className="relatorios-ranking-servico-nome">
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
                    <TableCell align="right">{formatPercent(servico.share)}</TableCell>
                    <TableCell align="right">{formatCurrencyOrDash(servico.average_unit_net)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <style>{`
        .relatorios-ranking-servico-nome {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }

        .relatorios-ranking-servicos-filtro {
          max-width: 260px;
          margin-top: 0.75rem;
        }
      `}</style>
    </Card>
  );
};
