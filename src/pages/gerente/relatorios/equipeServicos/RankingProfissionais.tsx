import React, { useMemo, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowUp01Icon, ArrowDown01Icon } from '@hugeicons/core-free-icons';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../../components/ui/feedback/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/feedback/DataTable';
import { Badge } from '../../../../components/ui/data-display/Badge';
import { EmptyState } from '../../../../components/ui/data-display/EmptyState';
import { formatCurrency } from '../../../../lib/currency';
import { formatCurrencyOrDash, formatPercent } from '../../../../modules/relatorios/formatacao';
import type { ProfissionalRanking } from '../../../../modules/relatorios/types';

type ColunaOrdenavel =
  | 'name'
  | 'net'
  | 'share'
  | 'attendances'
  | 'services_quantity'
  | 'products_net'
  | 'average_ticket'
  | 'commission';

interface ColunaDefinicao {
  key: ColunaOrdenavel;
  label: string;
  align: 'left' | 'right';
  /** Direção do primeiro clique: nome começa crescente, números começam decrescente. */
  defaultDirection: 'asc' | 'desc';
}

const COLUNAS: ColunaDefinicao[] = [
  { key: 'name', label: 'Profissional', align: 'left', defaultDirection: 'asc' },
  { key: 'net', label: 'Líquido', align: 'right', defaultDirection: 'desc' },
  { key: 'share', label: 'Participação', align: 'right', defaultDirection: 'desc' },
  { key: 'attendances', label: 'Atendimentos', align: 'right', defaultDirection: 'desc' },
  { key: 'services_quantity', label: 'Serviços executados', align: 'right', defaultDirection: 'desc' },
  { key: 'products_net', label: 'Produtos', align: 'right', defaultDirection: 'desc' },
  { key: 'average_ticket', label: 'Ticket médio', align: 'right', defaultDirection: 'desc' },
  { key: 'commission', label: 'Comissão gerada', align: 'right', defaultDirection: 'desc' },
];

interface OrdenacaoState {
  column: ColunaOrdenavel;
  direction: 'asc' | 'desc';
}

/**
 * Compara duas linhas por uma coluna, já aplicando a direção -- não apenas
 * o valor bruto -- porque `null` precisa ficar por último independente da
 * direção (mesma decisão de "ausência nunca parece zero" usada na
 * formatação -- aqui, na ordenação, ausência nunca parece o menor nem o
 * maior valor real). Multiplicar o resultado desta função por um sinal de
 * direção, como uma comparação numérica comum, inverteria esse ramo junto
 * com o resto e faria `null` aparecer primeiro em ordenação decrescente.
 */
function compararColuna(
  a: ProfissionalRanking,
  b: ProfissionalRanking,
  column: ColunaOrdenavel,
  direction: 'asc' | 'desc'
): number {
  if (column === 'name') {
    const comparacao = a.name.localeCompare(b.name, 'pt-BR');
    return direction === 'asc' ? comparacao : -comparacao;
  }

  const va = a[column] as number | null;
  const vb = b[column] as number | null;
  if (va === null && vb === null) return 0;
  if (va === null) return 1;
  if (vb === null) return -1;
  return direction === 'asc' ? va - vb : vb - va;
}

export interface RankingProfissionaisProps {
  professionals: ProfissionalRanking[];
  /** Botão "Exportar CSV" desta seção, injetado pela página. */
  exportButton?: React.ReactNode;
}

/**
 * Ranking de profissionais da página Equipe e Serviços (spec 038, ticket
 * 05, histórias 32-37): todos os profissionais com item no período,
 * inclusive inativos e arquivados (marcados com `Badge`), ordenados por
 * líquido decrescente na ordem que a API devolve. Cada cabeçalho de coluna
 * é clicável e reordena os dados já carregados na tela -- a API não tem
 * parâmetro de ordenação (spec: "reordenação por coluna feita na tela").
 * Sem clique nenhum, a tabela mantém a ordem original da API.
 */
export const RankingProfissionais: React.FC<RankingProfissionaisProps> = ({ professionals, exportButton }) => {
  const [ordenacao, setOrdenacao] = useState<OrdenacaoState | null>(null);

  const linhas = useMemo(() => {
    if (!ordenacao) return professionals;
    return [...professionals].sort((a, b) => compararColuna(a, b, ordenacao.column, ordenacao.direction));
  }, [professionals, ordenacao]);

  const handleHeaderClick = (coluna: ColunaDefinicao) => {
    setOrdenacao((atual) => {
      if (!atual || atual.column !== coluna.key) {
        return { column: coluna.key, direction: coluna.defaultDirection };
      }
      return { column: coluna.key, direction: atual.direction === 'asc' ? 'desc' : 'asc' };
    });
  };

  return (
    <Card variant="outline" className="relatorios-ranking-profissionais-card">
      <CardHeader>
        <div className="relatorios-faturamento-secao-header">
          <div className="relatorios-faturamento-secao-titulo">
            <CardTitle>Ranking de profissionais</CardTitle>
            <CardDescription>
              Comissão gerada, não paga. Clique numa coluna para reordenar a tabela.
            </CardDescription>
          </div>
          {exportButton}
        </div>
      </CardHeader>
      <CardContent>
        {professionals.length === 0 ? (
          <EmptyState
            title="Nenhum profissional com item no período"
            description="Não há item reconhecido de nenhum profissional no período selecionado."
          />
        ) : (
          <div className="relatorios-faturamento-tabela-wrap">
            <Table aria-label="Ranking de profissionais">
              <TableHeader>
                <TableRow>
                  {COLUNAS.map((coluna) => {
                    const ativa = ordenacao?.column === coluna.key;
                    const ariaSort = ativa ? (ordenacao!.direction === 'asc' ? 'ascending' : 'descending') : 'none';
                    return (
                      <TableHead key={coluna.key} align={coluna.align} aria-sort={ariaSort as any}>
                        <button
                          type="button"
                          className="relatorios-ranking-coluna-btn"
                          onClick={() => handleHeaderClick(coluna)}
                        >
                          {coluna.label}
                          {ativa && (
                            <HugeiconsIcon
                              icon={ordenacao!.direction === 'asc' ? ArrowUp01Icon : ArrowDown01Icon}
                              size={12}
                            />
                          )}
                        </button>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((profissional) => (
                  <TableRow key={profissional.professional_id}>
                    <TableCell>
                      <span className="relatorios-ranking-profissional-nome">
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
                    <TableCell align="right">{formatPercent(profissional.share)}</TableCell>
                    <TableCell align="right">{profissional.attendances}</TableCell>
                    <TableCell align="right">{profissional.services_quantity}</TableCell>
                    <TableCell align="right">{formatCurrency(profissional.products_net)}</TableCell>
                    <TableCell align="right">{formatCurrencyOrDash(profissional.average_ticket)}</TableCell>
                    <TableCell align="right">{formatCurrency(profissional.commission)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <style>{`
        .relatorios-ranking-profissional-nome {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }

        .relatorios-ranking-coluna-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          border: none;
          background: transparent;
          padding: 0;
          font: inherit;
          color: inherit;
          text-transform: inherit;
          letter-spacing: inherit;
          cursor: pointer;
        }

        .relatorios-ranking-coluna-btn:hover,
        .relatorios-ranking-coluna-btn:focus-visible {
          color: var(--color-brand-primary, #D96C00);
        }
      `}</style>
    </Card>
  );
};
