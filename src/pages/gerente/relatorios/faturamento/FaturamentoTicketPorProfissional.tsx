import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../../components/ui/feedback/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/feedback/DataTable';
import { Badge } from '../../../../components/ui/data-display/Badge';
import { EmptyState } from '../../../../components/ui/data-display/EmptyState';
import { formatCurrency } from '../../../../lib/currency';
import { formatCurrencyOrDash } from '../../../../modules/relatorios/formatacao';
import type { TicketPorProfissional } from '../../../../modules/relatorios/types';

export interface FaturamentoTicketPorProfissionalProps {
  ticketByProfessional: TicketPorProfissional[];
}

/**
 * Seção "Ticket por profissional" do Faturamento por período (spec 038,
 * ticket 03, histórias 30-31): todos os profissionais com ao menos um item
 * reconhecido no período, inclusive inativos e arquivados (marcados com
 * `Badge`), já ordenados por líquido decrescente (mesma ordem devolvida
 * pela API -- a tela nunca reordena). Uma Comanda dividida entre
 * profissionais conta uma Comanda distinta para cada um, e o aviso abaixo
 * do título deixa isso explícito para o gestor não estranhar a soma das
 * Comandas por profissional não bater com `closed_comandas` do período.
 * Item sem profissional (ex.: produto vendido sem executor) também fica
 * fora desta lista, então o líquido somado aqui pode ser menor que o
 * líquido total do período -- avisado também.
 */
export const FaturamentoTicketPorProfissional: React.FC<FaturamentoTicketPorProfissionalProps> = ({
  ticketByProfessional,
}) => {
  return (
    <Card variant="outline" className="relatorios-ticket-profissional-card">
      <CardHeader>
        <CardTitle>Ticket por profissional</CardTitle>
        <CardDescription>
          Comanda dividida conta para cada profissional. Item sem profissional associado não entra
          nesta lista, então a soma do líquido pode ser menor que o total do período.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {ticketByProfessional.length === 0 ? (
          <EmptyState
            title="Nenhum profissional com item no período"
            description="Os itens reconhecidos no período não têm profissional associado."
          />
        ) : (
          <div className="relatorios-faturamento-tabela-wrap">
            <Table aria-label="Ticket por profissional">
              <TableHeader>
                <TableRow>
                  <TableHead>Profissional</TableHead>
                  <TableHead align="right">Líquido</TableHead>
                  <TableHead align="right">Comandas</TableHead>
                  <TableHead align="right">Ticket médio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ticketByProfessional.map((profissional) => (
                  <TableRow key={profissional.professional_id}>
                    <TableCell>
                      <span className="relatorios-ticket-profissional-nome">
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
                    <TableCell align="right">{formatCurrency(profissional.net)}</TableCell>
                    <TableCell align="right">{profissional.comandas}</TableCell>
                    <TableCell align="right">{formatCurrencyOrDash(profissional.average_ticket)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <style>{`
        .relatorios-ticket-profissional-nome {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }
      `}</style>
    </Card>
  );
};
