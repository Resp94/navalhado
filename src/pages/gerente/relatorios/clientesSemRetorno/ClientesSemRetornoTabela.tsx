import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { WhatsappIcon } from '@hugeicons/core-free-icons';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/feedback/DataTable';
import { Badge } from '../../../../components/ui/data-display/Badge';
import { EmptyState } from '../../../../components/ui/data-display/EmptyState';
import { Pagination } from '../../../../components/ui/navigation/Pagination';
import { formatWhatsAppUrl } from '../../../../modules/clientes/utils';
import { formatDisplayDate } from '../../../../modules/relatorios/formatacao';
import type { ClienteSemRetornoItem } from '../../../../modules/relatorios/types';

export interface ClientesSemRetornoTabelaProps {
  items: ClienteSemRetornoItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

/**
 * Tabela paginada da página Clientes sem Retorno (spec 038, ticket 09,
 * história 61): mais atrasado primeiro (ordenação já vem do banco).
 * Ações por linha: Central 360º do cliente (navega para a página de
 * Clientes, que abre a gaveta pelo `customerId` da URL -- mesma Central
 * 360 já usada lá, sem duplicar UI) e WhatsApp com `formatWhatsAppUrl`
 * SEM texto pré-preenchido (a spec é explícita: o relatório não dispara
 * mensagem, só abre o link para o gestor mandar manualmente) -- o botão
 * some quando `has_phone` é falso, e o telefone ausente vira um `Badge`
 * neutro (nunca "warning": ausência de telefone não é um alerta).
 */
export const ClientesSemRetornoTabela: React.FC<ClientesSemRetornoTabelaProps> = ({
  items,
  totalCount,
  page,
  pageSize,
  onPageChange,
}) => {
  const navigate = useNavigate();
  const totalPages = Math.max(Math.ceil(totalCount / pageSize), 1);

  if (items.length === 0) {
    return (
      <EmptyState
        title="Nenhum cliente sem retorno"
        description="Não há cliente nesta faixa/profissional que tenha passado do prazo de retorno sem Agendamento futuro."
      />
    );
  }

  return (
    <>
      <div className="relatorios-faturamento-tabela-wrap">
        <Table aria-label="Clientes sem retorno">
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Última visita</TableHead>
              <TableHead>Último serviço</TableHead>
              <TableHead>Profissional</TableHead>
              <TableHead align="right">Prazo (dias)</TableHead>
              <TableHead align="right">Dias desde</TableHead>
              <TableHead align="right">Dias de atraso</TableHead>
              <TableHead align="right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.customer_id}>
                <TableCell>{item.name}</TableCell>
                <TableCell>
                  {item.has_phone && item.phone ? (
                    item.phone
                  ) : (
                    <Badge variant="neutral" size="xs">
                      Sem telefone
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{formatDisplayDate(item.last_visit_date)}</TableCell>
                <TableCell>{item.last_service_name ?? '--'}</TableCell>
                <TableCell>{item.last_professional_name ?? '--'}</TableCell>
                <TableCell align="right">{item.return_period_days}</TableCell>
                <TableCell align="right">{item.days_since}</TableCell>
                <TableCell align="right">{item.days_overdue}</TableCell>
                <TableCell align="right">
                  <div className="relatorios-clientes-sem-retorno-acoes">
                    <button
                      type="button"
                      className="btn btn--outline btn--xs"
                      onClick={() => navigate(`/clientes?customerId=${item.customer_id}`)}
                    >
                      Central 360º
                    </button>
                    {item.has_phone && item.phone ? (
                      <a
                        href={formatWhatsAppUrl(item.phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relatorios-clientes-sem-retorno-whatsapp"
                        title={`WhatsApp para ${item.name}`}
                        aria-label={`WhatsApp para ${item.name}`}
                      >
                        <HugeiconsIcon icon={WhatsappIcon} size={16} />
                      </a>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
        totalItems={totalCount}
        itemsPerPage={pageSize}
      />

      <style>{`
        .relatorios-clientes-sem-retorno-acoes {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          justify-content: flex-end;
        }

        .relatorios-clientes-sem-retorno-whatsapp {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: var(--radius-sm, 6px);
          color: #25d366;
          background: rgba(37, 211, 102, 0.1);
          box-shadow: 0 0 0 0.8px var(--color-text-primary, #2D231E);
          flex-shrink: 0;
        }

        .relatorios-clientes-sem-retorno-whatsapp:hover {
          background: rgba(37, 211, 102, 0.2);
        }
      `}</style>
    </>
  );
};
