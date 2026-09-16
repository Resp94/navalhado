import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { ContasPagarRepository } from '../../../modules/contas-pagar/ContasPagarRepository';
import { SupabaseContasPagarAdapter } from '../../../modules/contas-pagar/adapters/SupabaseContasPagarAdapter';
import { useContasPagar } from '../../../modules/contas-pagar/useContasPagar';
import { useContasPagarAlerta } from '../../../modules/contas-pagar/useContasPagarAlerta';
import { PlanoContasRepository } from '../../../modules/plano-contas/PlanoContasRepository';
import { SupabasePlanoContasAdapter } from '../../../modules/plano-contas/adapters/SupabasePlanoContasAdapter';
import { usePlanoContas } from '../../../modules/plano-contas/usePlanoContas';
import { CaixaRepository } from '../../../modules/caixa/CaixaRepository';
import { SupabaseCaixaAdapter } from '../../../modules/caixa/adapters/SupabaseCaixaAdapter';
import type { ContaPagarListada, TotaisContasPagar } from '../../../modules/contas-pagar/types';
import type { FinanceiroHubContextType } from './HubLayout';
import { ContaPagarForm } from '../../../components/financeiro/ContaPagarForm';
import { ContaPagarDetalheDrawer } from '../../../components/financeiro/ContaPagarDetalheDrawer';
import { Badge, Card, EmptyState, Skeleton, StatCard } from '../../../components/ui';
import { Button } from '../../../components/ui/forms/Button';
import { Select } from '../../../components/ui/forms/Select';
import { Drawer } from '../../../components/ui/feedback/Drawer';
import { Pagination } from '../../../components/ui/navigation/Pagination';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui/feedback/DataTable';
import '../Financeiro.css';

export interface ContasPagarTabProps {
  /** Repositório de Contas a Pagar injetado para teste. */
  repository?: ContasPagarRepository;
  /** Repositório do Plano de Contas injetado para teste (categorias e fornecedores do formulário). */
  planoContasRepository?: PlanoContasRepository;
  /** Repositório de Caixa injetado para teste (ticket 15/036: Baixa pela gaveta). */
  caixaRepository?: CaixaRepository;
}

const ROTULO_SITUACAO: Record<string, { label: string; variant: 'neutral' | 'success' | 'warning' | 'error' }> = {
  open: { label: 'Em aberto', variant: 'neutral' },
  partially_paid: { label: 'Parcialmente paga', variant: 'warning' },
  paid: { label: 'Paga', variant: 'success' },
  cancelled: { label: 'Cancelada', variant: 'neutral' },
  overdue: { label: 'Vencida', variant: 'error' },
};

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

/**
 * Aba "Contas a pagar" do Hub Financeiro (`/financeiro/contas-a-pagar`, ticket 06/036). Como
 * Plano de Contas, não tem período do painel de Caixa e Comissões: usa filtro de vencimento
 * próprio. Este ticket cobre só o lançamento avulso e a lista paginada; filtros completos,
 * totais e alerta chegam no ticket 09.
 */
export const ContasPagarTab: React.FC<ContasPagarTabProps> = ({
  repository: repositoryProp,
  planoContasRepository: planoContasRepositoryProp,
  caixaRepository: caixaRepositoryProp,
}) => {
  const tenant = useOutletContext<FinanceiroHubContextType>();
  const tenantId = tenant?.tenantId || '';

  const defaultRepository = useMemo(
    () => new ContasPagarRepository(new SupabaseContasPagarAdapter(supabase)),
    []
  );
  const repository = repositoryProp || defaultRepository;

  const defaultPlanoContasRepository = useMemo(
    () => new PlanoContasRepository(new SupabasePlanoContasAdapter(supabase)),
    []
  );
  const planoContasRepository = planoContasRepositoryProp || defaultPlanoContasRepository;

  const defaultCaixaRepository = useMemo(() => new CaixaRepository(new SupabaseCaixaAdapter()), []);
  const caixaRepository = caixaRepositoryProp || defaultCaixaRepository;

  const { contas, totalCount, page, setPage, pageSize, loading, error, filtro, mudarFiltro, reload } =
    useContasPagar(tenantId, repository);
  const { alerta, reload: recarregarAlertaLocal } = useContasPagarAlerta(tenantId, repository);

  const {
    categoriasDespesa,
    fornecedores,
    reload: recarregarCategoriasDespesa,
    reloadFornecedores: recarregarFornecedores,
  } = usePlanoContas(tenantId, planoContasRepository);
  const categoriasAtivas = categoriasDespesa.filter((categoria) => categoria.archived_at === null);
  const fornecedoresAtivos = fornecedores.filter((fornecedor) => fornecedor.archived_at === null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [contaSelecionadaId, setContaSelecionadaId] = useState<string | null>(null);
  const [totais, setTotais] = useState<TotaisContasPagar | null>(null);
  const [totaisCarregando, setTotaisCarregando] = useState(true);

  // Notifica o selo de alerta na navegação do Hub sempre que algo é escrito
  // aqui (história 34) — o selo em si vive no HubLayout, que passa esta
  // função pelo contexto da rota, não como propriedade nova no componente de
  // abas.
  const notificarAlteracao = () => {
    void recarregarAlertaLocal();
    tenant?.onContasPagarAlteradas?.();
  };

  // Bumping esta versão força o efeito de totais abaixo a recarregar mesmo
  // quando nenhum filtro mudou -- é o gatilho que faltava depois de criar,
  // dar Baixa, estornar ou cancelar uma conta (bug encontrado na validação
  // da spec 036: totais ficavam parados até a página ser recarregada).
  const [totaisVersao, setTotaisVersao] = useState(0);

  useEffect(() => {
    let cancelado = false;
    if (!tenantId) return;
    setTotaisCarregando(true);
    repository
      .obterTotais(tenantId, {
        dueDateFrom: filtro.dueDateFrom,
        dueDateTo: filtro.dueDateTo,
        categoryId: filtro.categoryId,
        supplierId: filtro.supplierId,
      })
      .then((resultado) => {
        if (!cancelado) setTotais(resultado);
      })
      .catch(() => {
        if (!cancelado) setTotais(null);
      })
      .finally(() => {
        if (!cancelado) setTotaisCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [tenantId, repository, filtro.dueDateFrom, filtro.dueDateTo, filtro.categoryId, filtro.supplierId, totaisVersao]);

  const abrirCriar = () => setDrawerOpen(true);
  const fecharDrawer = () => setDrawerOpen(false);

  const handleSalvar = async () => {
    setDrawerOpen(false);
    await reload();
    notificarAlteracao();
    setTotaisVersao((versao) => versao + 1);
  };

  const abrirDetalhe = (payableId: string) => setContaSelecionadaId(payableId);
  const fecharDetalhe = () => setContaSelecionadaId(null);

  const handleAtualizadoNoDetalhe = async () => {
    await reload();
    notificarAlteracao();
    setTotaisVersao((versao) => versao + 1);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const renderLinha = (conta: ContaPagarListada) => {
    const situacao = ROTULO_SITUACAO[conta.situation] || ROTULO_SITUACAO.open;
    return { situacao };
  };

  return (
    <div className="financeiro-tab-content w-full">
      <header className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <h2 className="m-0 text-[1.1rem] font-extrabold text-text-primary">Contas a pagar</h2>
        <Button variant="primary" size="sm" onClick={abrirCriar}>
          Nova conta
        </Button>
      </header>

      {alerta && (alerta.overdueCount > 0 || alerta.dueTodayCount > 0) && (
        <div
          className="flex flex-wrap gap-x-6 gap-y-2 mb-4 rounded-md bg-brand-lightest py-3 px-4 text-text-primary text-sm font-bold shadow-[0_0_0_0.8px_var(--color-error)]"
          role="status"
        >
          {alerta.overdueCount > 0 && (
            <span>
              {alerta.overdueCount} conta{alerta.overdueCount > 1 ? 's' : ''} vencida
              {alerta.overdueCount > 1 ? 's' : ''} ({formatarMoeda(alerta.overdueBalance)})
            </span>
          )}
          {alerta.dueTodayCount > 0 && (
            <span>
              {alerta.dueTodayCount} conta{alerta.dueTodayCount > 1 ? 's' : ''} vence
              {alerta.dueTodayCount > 1 ? 'm' : ''} hoje ({formatarMoeda(alerta.dueTodayBalance)})
            </span>
          )}
        </div>
      )}

      <div className="grid gap-4 mb-4 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
        <StatCard title="Em aberto" value={formatarMoeda(totais?.openBalance || 0)} loading={totaisCarregando} />
        <StatCard
          title="Vencido"
          value={formatarMoeda(totais?.overdueBalance || 0)}
          loading={totaisCarregando}
        />
        <StatCard
          title="Pago no período"
          value={formatarMoeda(totais?.paidInPeriod || 0)}
          loading={totaisCarregando}
        />
      </div>

      <div className="flex items-end gap-4 flex-wrap mb-4">
        <label className="flex flex-col gap-[0.35rem] text-sm text-text-secondary">
          <span>Vencimento de</span>
          <input
            type="date"
            value={filtro.dueDateFrom || ''}
            onChange={(event) => mudarFiltro({ dueDateFrom: event.target.value || null })}
            className="py-2 px-3 rounded-sm shadow-[0_0_0_0.8px_var(--color-text-primary)] bg-bg-secondary text-text-primary font-base"
          />
        </label>
        <label className="flex flex-col gap-[0.35rem] text-sm text-text-secondary">
          <span>Vencimento até</span>
          <input
            type="date"
            value={filtro.dueDateTo || ''}
            onChange={(event) => mudarFiltro({ dueDateTo: event.target.value || null })}
            className="py-2 px-3 rounded-sm shadow-[0_0_0_0.8px_var(--color-text-primary)] bg-bg-secondary text-text-primary font-base"
          />
        </label>
        <Select
          label="Estado"
          value={filtro.status}
          onChange={(event) =>
            mudarFiltro({ status: event.target.value as typeof filtro.status })
          }
          options={[
            { value: 'not_cancelled', label: 'Todas exceto canceladas' },
            { value: 'open', label: 'Em aberto' },
            { value: 'overdue', label: 'Vencidas' },
            { value: 'paid', label: 'Pagas' },
            { value: 'cancelled', label: 'Canceladas' },
          ]}
        />
        <Select
          label="Categoria"
          value={filtro.categoryId || ''}
          onChange={(event) => mudarFiltro({ categoryId: event.target.value || null })}
          options={[
            { value: '', label: 'Todas as categorias' },
            ...categoriasDespesa.map((categoria) => ({ value: categoria.id, label: categoria.name })),
          ]}
        />
        <Select
          label="Fornecedor"
          value={filtro.supplierId || ''}
          onChange={(event) => mudarFiltro({ supplierId: event.target.value || null })}
          options={[
            { value: '', label: 'Todos os fornecedores' },
            ...fornecedores.map((fornecedor) => ({ value: fornecedor.id, label: fornecedor.name })),
          ]}
        />
      </div>

      {loading && (
        <div className="flex flex-col gap-3" aria-label="Carregando contas a pagar">
          <Skeleton height={44} />
          <Skeleton height={44} />
          <Skeleton height={44} />
        </div>
      )}

      {!loading && error && (
        <EmptyState title="Não foi possível carregar as contas a pagar" description={error} />
      )}

      {!loading && !error && contas.length === 0 && (
        <EmptyState
          title="Nenhuma conta a pagar encontrada"
          description="As Contas a Pagar da barbearia aparecerão aqui."
        />
      )}

      {!loading && !error && contas.length > 0 && (
        <>
          <div className="financeiro-desktop-view">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Saldo</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contas.map((conta) => {
                  const { situacao } = renderLinha(conta);
                  return (
                    <TableRow
                      key={conta.id}
                      onClick={() => abrirDetalhe(conta.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <TableCell>{conta.description}</TableCell>
                      <TableCell>{conta.category_name}</TableCell>
                      <TableCell>{conta.supplier_name || '—'}</TableCell>
                      <TableCell>{formatarData(conta.due_date)}</TableCell>
                      <TableCell>{formatarMoeda(conta.amount)}</TableCell>
                      <TableCell>{formatarMoeda(conta.remaining_amount)}</TableCell>
                      <TableCell>
                        <Badge variant={situacao.variant}>{situacao.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="financeiro-mobile-view max-md:flex max-md:flex-col max-md:gap-3">
            {contas.map((conta) => {
              const { situacao } = renderLinha(conta);
              return (
                <Card
                  key={conta.id}
                  className="p-4"
                  onClick={() => abrirDetalhe(conta.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold text-text-primary">{conta.description}</span>
                    <Badge variant={situacao.variant}>{situacao.label}</Badge>
                  </div>
                  <p className="mt-[0.35rem] text-sm text-text-secondary">{conta.category_name}</p>
                  {conta.supplier_name && (
                    <p className="mt-[0.35rem] text-sm text-text-secondary">{conta.supplier_name}</p>
                  )}
                  <p className="mt-[0.35rem] text-sm text-text-secondary">
                    Vencimento: {formatarData(conta.due_date)}
                  </p>
                  <p className="mt-[0.35rem] text-sm text-text-secondary">
                    {formatarMoeda(conta.amount)} · saldo {formatarMoeda(conta.remaining_amount)}
                  </p>
                </Card>
              );
            })}
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalCount}
            itemsPerPage={pageSize}
            onPageChange={setPage}
          />
        </>
      )}

      <Drawer isOpen={drawerOpen} onClose={fecharDrawer} title="Nova conta a pagar">
        <ContaPagarForm
          repository={repository}
          tenantId={tenantId}
          categoriasAtivas={categoriasAtivas}
          fornecedoresAtivos={fornecedoresAtivos}
          planoContasRepository={planoContasRepository}
          onCategoriaCriada={() => void recarregarCategoriasDespesa()}
          onFornecedorCriado={() => void recarregarFornecedores()}
          onSalvar={handleSalvar}
          onCancelar={fecharDrawer}
        />
      </Drawer>

      {contaSelecionadaId && (
        <ContaPagarDetalheDrawer
          isOpen={!!contaSelecionadaId}
          repository={repository}
          caixaRepository={caixaRepository}
          tenantId={tenantId}
          payableId={contaSelecionadaId}
          categoriasAtivas={categoriasAtivas}
          fornecedoresAtivos={fornecedoresAtivos}
          onClose={fecharDetalhe}
          onAtualizado={handleAtualizadoNoDetalhe}
        />
      )}
    </div>
  );
};
