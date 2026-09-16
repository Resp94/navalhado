import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/feedback/DataTable';
import { Badge } from '../../../../components/ui/data-display/Badge';
import { EmptyState } from '../../../../components/ui/data-display/EmptyState';
import { formatDisplayDate } from '../../../../modules/relatorios/formatacao';
import type { ClienteUmaVisita } from '../../../../modules/relatorios/types';

export interface ClientesUmaVisitaListaProps {
  items: ClienteUmaVisita[];
}

/**
 * Lista de Clientes de Uma Visita (spec 038, ticket 10): Cliente Novo do
 * período cuja única Visita, até hoje, é a do período -- já vem do
 * contrato limitada a 200, mais recentes primeiro, sem paginação própria
 * na tela. Ação por linha: abrir a Central 360º do cliente, mesmo
 * mecanismo de navegação já usado em Clientes sem Retorno (ticket 09) --
 * `/clientes?customerId=...`, que a página de Clientes já sabe abrir na
 * gaveta. Telefone ausente vira um `Badge` neutro (nunca "warning":
 * ausência de telefone não é um alerta), mesma decisão de
 * `ClientesSemRetornoTabela`.
 */
export const ClientesUmaVisitaLista: React.FC<ClientesUmaVisitaListaProps> = ({ items }) => {
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <EmptyState
        title="Nenhum Cliente de Uma Visita neste período"
        description="Não há Cliente Novo do período cuja única Visita, até hoje, seja a deste período."
      />
    );
  }

  return (
    <div className="relatorios-faturamento-tabela-wrap">
      <Table aria-label="Clientes de Uma Visita">
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Data da visita</TableHead>
            <TableHead>Profissional</TableHead>
            <TableHead align="right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.customer_id}>
              <TableCell>{item.name}</TableCell>
              <TableCell>
                {item.phone || (
                  <Badge variant="neutral" size="xs">
                    Sem telefone
                  </Badge>
                )}
              </TableCell>
              <TableCell>{formatDisplayDate(item.visit_date)}</TableCell>
              <TableCell>{item.professional_name ?? '--'}</TableCell>
              <TableCell align="right">
                <button
                  type="button"
                  className="btn btn--outline btn--xs"
                  onClick={() => navigate(`/clientes?customerId=${item.customer_id}`)}
                >
                  Central 360º
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
