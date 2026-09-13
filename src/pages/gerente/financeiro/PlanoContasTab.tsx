import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { PlanoContasRepository } from '../../../modules/plano-contas/PlanoContasRepository';
import { SupabasePlanoContasAdapter } from '../../../modules/plano-contas/adapters/SupabasePlanoContasAdapter';
import { usePlanoContas } from '../../../modules/plano-contas/usePlanoContas';
import type { TenantContextType } from '../../../components/GerenteLayout';
import { Badge, Checkbox, Card, EmptyState, Skeleton } from '../../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui/feedback/DataTable';
import '../Financeiro.css';
import './PlanoContas.css';

export interface PlanoContasTabProps {
  /**
   * Repositório injetado para teste (adaptador em memória). Em produção a aba
   * cria o repositório com o adaptador Supabase uma vez por montagem, no
   * mesmo padrão de outros componentes do kit (`caixaRepo?`, `comandaRepo?`).
   */
  repository?: PlanoContasRepository;
}

/**
 * Aba "Plano de contas" do Hub Financeiro, montada pela rota `/financeiro/cadastros`. Ao
 * contrário de Caixa e Comissões, não tem período: é rota-filha direta do layout do Hub, fora do
 * layout do painel, e lê só o contexto do tenant. Cria o repositório do Plano de Contas com o
 * adaptador Supabase uma vez por montagem (padrão de `clientes`, não o de `caixa`/`comissoes`).
 *
 * Neste ticket (035/03) mostra só a seção de Categorias de Despesa, semeadas no nascimento do
 * tenant. Criar, renomear, arquivar e reativar chegam no ticket 035/04; a seção de Fornecedores e
 * o controle segmentado entre as duas seções chegam no ticket 035/06.
 */
export const PlanoContasTab: React.FC<PlanoContasTabProps> = ({ repository: repositoryProp }) => {
  const tenant = useOutletContext<TenantContextType>();

  const defaultRepository = useMemo(
    () => new PlanoContasRepository(new SupabasePlanoContasAdapter(supabase)),
    []
  );
  const repository = repositoryProp || defaultRepository;

  const { categoriasDespesa, loading, error } = usePlanoContas(tenant?.tenantId || '', repository);
  const [showArchived, setShowArchived] = useState(false);

  const categoriasVisiveis = categoriasDespesa.filter((categoria) =>
    showArchived ? categoria.archived_at !== null : categoria.archived_at === null
  );

  return (
    <div className="financeiro-tab-content plano-contas-tab">
      <section className="plano-contas-section" aria-label="Categorias de Despesa">
        <header className="plano-contas-section-header">
          <h2 className="plano-contas-section-title">Categorias de Despesa</h2>
          <Checkbox
            label="Mostrar arquivadas"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
          />
        </header>

        {loading && (
          <div className="plano-contas-skeleton-list" aria-label="Carregando categorias de despesa">
            <Skeleton height={44} />
            <Skeleton height={44} />
            <Skeleton height={44} />
          </div>
        )}

        {!loading && error && (
          <EmptyState title="Não foi possível carregar as categorias" description={error} />
        )}

        {!loading && !error && categoriasVisiveis.length === 0 && (
          <EmptyState
            title={showArchived ? 'Nenhuma categoria arquivada' : 'Nenhuma categoria de despesa ativa'}
            description={
              showArchived
                ? 'Categorias arquivadas aparecem aqui.'
                : 'As Categorias de Despesa da barbearia aparecerão aqui.'
            }
          />
        )}

        {!loading && !error && categoriasVisiveis.length > 0 && (
          <>
            <div className="financeiro-desktop-view">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoriasVisiveis.map((categoria) => (
                    <TableRow key={categoria.id}>
                      <TableCell>{categoria.name}</TableCell>
                      <TableCell>
                        {categoria.archived_at ? (
                          <Badge variant="neutral">Arquivada</Badge>
                        ) : (
                          <Badge variant="success">Ativa</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="financeiro-mobile-view plano-contas-cards">
              {categoriasVisiveis.map((categoria) => (
                <Card key={categoria.id} className="plano-contas-card">
                  <div className="plano-contas-card-row">
                    <span className="plano-contas-card-name">{categoria.name}</span>
                    {categoria.archived_at ? (
                      <Badge variant="neutral">Arquivada</Badge>
                    ) : (
                      <Badge variant="success">Ativa</Badge>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
};
