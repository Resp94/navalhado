import React, { useMemo, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { PlanoContasRepository } from '../../../modules/plano-contas/PlanoContasRepository';
import { SupabasePlanoContasAdapter } from '../../../modules/plano-contas/adapters/SupabasePlanoContasAdapter';
import { usePlanoContas } from '../../../modules/plano-contas/usePlanoContas';
import { normalizarDocumento, formatarDocumento } from '../../../modules/plano-contas/documento';
import type { CategoriaDespesa, Fornecedor } from '../../../modules/plano-contas/types';
import type { TenantContextType } from '../../../components/GerenteLayout';
import { CategoriaDespesaForm } from '../../../components/financeiro/CategoriaDespesaForm';
import { FornecedorForm } from '../../../components/financeiro/FornecedorForm';
import { Badge, Checkbox, Card, EmptyState, Skeleton, SegmentedControl, SearchInput } from '../../../components/ui';
import { Button } from '../../../components/ui/forms/Button';
import { Drawer } from '../../../components/ui/feedback/Drawer';
import { ConfirmDialog } from '../../../components/ui/feedback/ConfirmDialog';
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

type Secao = 'categorias' | 'fornecedores';

/**
 * Aba "Plano de contas" do Hub Financeiro, montada pela rota `/financeiro/cadastros`. Ao
 * contrário de Caixa e Comissões, não tem período: é rota-filha direta do layout do Hub, fora do
 * layout do painel, e lê só o contexto do tenant. Cria o repositório do Plano de Contas com o
 * adaptador Supabase uma vez por montagem (padrão de `clientes`, não o de `caixa`/`comissoes`).
 *
 * Ticket 035/04: criar, renomear, arquivar e reativar Categoria de Despesa. Ticket 035/06:
 * cadastro de Fornecedores, com controle segmentado entre as duas seções refletido na URL
 * (`?secao=categorias|fornecedores`), para que a spec 036 leve o gestor direto aos fornecedores.
 * Os formulários (`CategoriaDespesaForm`, `FornecedorForm`) são compostos dentro do Drawer do kit
 * de UI; arquivar pede confirmação pelo `ConfirmDialog` do kit (não o modal de exclusão de
 * serviços da spec 013); reativar não pede confirmação, porque desfaz a si mesmo.
 */
export const PlanoContasTab: React.FC<PlanoContasTabProps> = ({ repository: repositoryProp }) => {
  const tenant = useOutletContext<TenantContextType>();
  const [searchParams, setSearchParams] = useSearchParams();

  const defaultRepository = useMemo(
    () => new PlanoContasRepository(new SupabasePlanoContasAdapter(supabase)),
    []
  );
  const repository = repositoryProp || defaultRepository;

  const {
    categoriasDespesa,
    loading,
    error,
    reload,
    arquivarCategoriaDespesa,
    reativarCategoriaDespesa,
    fornecedores,
    loadingFornecedores,
    errorFornecedores,
    reloadFornecedores,
    arquivarFornecedor,
    reativarFornecedor,
  } = usePlanoContas(tenant?.tenantId || '', repository);

  const secaoParam = searchParams.get('secao');
  const secao: Secao = secaoParam === 'fornecedores' ? 'fornecedores' : 'categorias';
  const mudarSecao = (nova: Secao) => {
    const proximos = new URLSearchParams(searchParams);
    if (nova === 'categorias') {
      proximos.delete('secao');
    } else {
      proximos.set('secao', nova);
    }
    setSearchParams(proximos, { replace: true });
  };

  const [showArchived, setShowArchived] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [categoriaEmEdicao, setCategoriaEmEdicao] = useState<CategoriaDespesa | null>(null);
  const [categoriaParaArquivar, setCategoriaParaArquivar] = useState<CategoriaDespesa | null>(null);
  const [arquivando, setArquivando] = useState(false);
  const [reativandoId, setReativandoId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [showArchivedFornecedores, setShowArchivedFornecedores] = useState(false);
  const [buscaFornecedor, setBuscaFornecedor] = useState('');
  const [drawerFornecedorOpen, setDrawerFornecedorOpen] = useState(false);
  const [fornecedorEmEdicao, setFornecedorEmEdicao] = useState<Fornecedor | null>(null);
  const [fornecedorParaArquivar, setFornecedorParaArquivar] = useState<Fornecedor | null>(null);
  const [arquivandoFornecedor, setArquivandoFornecedor] = useState(false);
  const [reativandoFornecedorId, setReativandoFornecedorId] = useState<string | null>(null);
  const [fornecedorActionError, setFornecedorActionError] = useState<string | null>(null);

  const categoriasVisiveis = categoriasDespesa.filter((categoria) =>
    showArchived ? categoria.archived_at !== null : categoria.archived_at === null
  );
  const categoriasAtivas = categoriasDespesa.filter((categoria) => categoria.archived_at === null);

  const buscaNormalizada = buscaFornecedor.trim().toLowerCase();
  const buscaDocumentoNormalizada = normalizarDocumento(buscaFornecedor);
  const fornecedoresVisiveis = fornecedores
    .filter((fornecedor) =>
      showArchivedFornecedores ? fornecedor.archived_at !== null : fornecedor.archived_at === null
    )
    .filter((fornecedor) => {
      if (!buscaNormalizada) return true;
      const nomeBate = fornecedor.name.toLowerCase().includes(buscaNormalizada);
      const documentoBate =
        buscaDocumentoNormalizada.length > 0 &&
        (fornecedor.document || '').includes(buscaDocumentoNormalizada);
      return nomeBate || documentoBate;
    });

  const abrirCriar = () => {
    setActionError(null);
    setCategoriaEmEdicao(null);
    setDrawerOpen(true);
  };

  const abrirEditar = (categoria: CategoriaDespesa) => {
    setActionError(null);
    setCategoriaEmEdicao(categoria);
    setDrawerOpen(true);
  };

  const fecharDrawer = () => setDrawerOpen(false);

  const handleSalvar = async () => {
    // O formulário grava pelo repositório injetado diretamente (autônomo, sem
    // depender do hook). A aba refaz a leitura aqui para que a lista nunca
    // fique desatualizada com o que acabou de ser criado/renomeado/reativado.
    setDrawerOpen(false);
    await reload();
  };

  const pedirArquivamento = (categoria: CategoriaDespesa) => {
    setActionError(null);
    setCategoriaParaArquivar(categoria);
  };

  const confirmarArquivamento = async () => {
    if (!categoriaParaArquivar) return;
    setArquivando(true);
    setActionError(null);
    try {
      await arquivarCategoriaDespesa(categoriaParaArquivar.id);
      setCategoriaParaArquivar(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Não foi possível arquivar a categoria.');
    } finally {
      setArquivando(false);
    }
  };

  const handleReativar = async (categoria: CategoriaDespesa) => {
    setActionError(null);
    setReativandoId(categoria.id);
    try {
      await reativarCategoriaDespesa(categoria.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Não foi possível reativar a categoria.');
    } finally {
      setReativandoId(null);
    }
  };

  const abrirCriarFornecedor = () => {
    setFornecedorActionError(null);
    setFornecedorEmEdicao(null);
    setDrawerFornecedorOpen(true);
  };

  const abrirEditarFornecedor = (fornecedor: Fornecedor) => {
    setFornecedorActionError(null);
    setFornecedorEmEdicao(fornecedor);
    setDrawerFornecedorOpen(true);
  };

  const fecharDrawerFornecedor = () => setDrawerFornecedorOpen(false);

  const handleSalvarFornecedor = async () => {
    setDrawerFornecedorOpen(false);
    await reloadFornecedores();
  };

  const pedirArquivamentoFornecedor = (fornecedor: Fornecedor) => {
    setFornecedorActionError(null);
    setFornecedorParaArquivar(fornecedor);
  };

  const confirmarArquivamentoFornecedor = async () => {
    if (!fornecedorParaArquivar) return;
    setArquivandoFornecedor(true);
    setFornecedorActionError(null);
    try {
      await arquivarFornecedor(fornecedorParaArquivar.id);
      setFornecedorParaArquivar(null);
    } catch (err) {
      setFornecedorActionError(err instanceof Error ? err.message : 'Não foi possível arquivar o fornecedor.');
    } finally {
      setArquivandoFornecedor(false);
    }
  };

  const handleReativarFornecedor = async (fornecedor: Fornecedor) => {
    setFornecedorActionError(null);
    setReativandoFornecedorId(fornecedor.id);
    try {
      await reativarFornecedor(fornecedor.id);
    } catch (err) {
      setFornecedorActionError(err instanceof Error ? err.message : 'Não foi possível reativar o fornecedor.');
    } finally {
      setReativandoFornecedorId(null);
    }
  };

  return (
    <div className="financeiro-tab-content plano-contas-tab">
      <SegmentedControl
        value={secao}
        onChange={mudarSecao}
        aria-label="Seção do Plano de Contas"
        options={[
          { id: 'categorias', label: 'Categorias de Despesa' },
          { id: 'fornecedores', label: 'Fornecedores' },
        ]}
      />

      {secao === 'categorias' && (
        <section className="plano-contas-section" aria-label="Categorias de Despesa">
          <header className="plano-contas-section-header">
            <h2 className="plano-contas-section-title">Categorias de Despesa</h2>
            <div className="plano-contas-section-actions">
              <Checkbox
                label="Mostrar arquivadas"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
              />
              <Button variant="primary" size="sm" onClick={abrirCriar}>
                Nova categoria
              </Button>
            </div>
          </header>

          {actionError && (
            <div className="plano-contas-action-error" role="alert">
              {actionError}
            </div>
          )}

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
                      <TableHead>Ações</TableHead>
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
                        <TableCell>
                          <div className="plano-contas-row-actions">
                            {categoria.archived_at ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                loading={reativandoId === categoria.id}
                                onClick={() => handleReativar(categoria)}
                              >
                                Reativar
                              </Button>
                            ) : (
                              <>
                                <Button variant="secondary" size="sm" onClick={() => abrirEditar(categoria)}>
                                  Editar
                                </Button>
                                <Button
                                  variant="danger-outline"
                                  size="sm"
                                  onClick={() => pedirArquivamento(categoria)}
                                >
                                  Arquivar
                                </Button>
                              </>
                            )}
                          </div>
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
                    <div className="plano-contas-row-actions">
                      {categoria.archived_at ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          fullWidth
                          loading={reativandoId === categoria.id}
                          onClick={() => handleReativar(categoria)}
                        >
                          Reativar
                        </Button>
                      ) : (
                        <>
                          <Button variant="secondary" size="sm" onClick={() => abrirEditar(categoria)}>
                            Editar
                          </Button>
                          <Button
                            variant="danger-outline"
                            size="sm"
                            onClick={() => pedirArquivamento(categoria)}
                          >
                            Arquivar
                          </Button>
                        </>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {secao === 'fornecedores' && (
        <section className="plano-contas-section" aria-label="Fornecedores">
          <header className="plano-contas-section-header">
            <h2 className="plano-contas-section-title">Fornecedores</h2>
            <div className="plano-contas-section-actions">
              <Checkbox
                label="Mostrar arquivados"
                checked={showArchivedFornecedores}
                onChange={(event) => setShowArchivedFornecedores(event.target.checked)}
              />
              <Button variant="primary" size="sm" onClick={abrirCriarFornecedor}>
                Novo fornecedor
              </Button>
            </div>
          </header>

          <SearchInput
            value={buscaFornecedor}
            onChange={setBuscaFornecedor}
            placeholder="Buscar por nome ou documento"
            aria-label="Buscar fornecedor por nome ou documento"
          />

          {fornecedorActionError && (
            <div className="plano-contas-action-error" role="alert">
              {fornecedorActionError}
            </div>
          )}

          {loadingFornecedores && (
            <div className="plano-contas-skeleton-list" aria-label="Carregando fornecedores">
              <Skeleton height={44} />
              <Skeleton height={44} />
              <Skeleton height={44} />
            </div>
          )}

          {!loadingFornecedores && errorFornecedores && (
            <EmptyState title="Não foi possível carregar os fornecedores" description={errorFornecedores} />
          )}

          {!loadingFornecedores && !errorFornecedores && fornecedoresVisiveis.length === 0 && (
            <EmptyState
              title={
                buscaNormalizada
                  ? 'Nenhum fornecedor encontrado'
                  : showArchivedFornecedores
                  ? 'Nenhum fornecedor arquivado'
                  : 'Nenhum fornecedor ativo'
              }
              description={
                buscaNormalizada
                  ? 'Tente buscar por outro nome ou documento.'
                  : showArchivedFornecedores
                  ? 'Fornecedores arquivados aparecem aqui.'
                  : 'Os fornecedores da barbearia aparecerão aqui.'
              }
            />
          )}

          {!loadingFornecedores && !errorFornecedores && fornecedoresVisiveis.length > 0 && (
            <>
              <div className="financeiro-desktop-view">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Categoria padrão</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fornecedoresVisiveis.map((fornecedor) => (
                      <TableRow key={fornecedor.id}>
                        <TableCell>{fornecedor.name}</TableCell>
                        <TableCell>
                          {fornecedor.document ? formatarDocumento(fornecedor.document) : '—'}
                        </TableCell>
                        <TableCell>
                          {fornecedor.default_category ? (
                            <>
                              {fornecedor.default_category.name}
                              {fornecedor.default_category.archived && (
                                <Badge variant="neutral"> arquivada</Badge>
                              )}
                            </>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>
                          {fornecedor.archived_at ? (
                            <Badge variant="neutral">Arquivado</Badge>
                          ) : (
                            <Badge variant="success">Ativo</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="plano-contas-row-actions">
                            {fornecedor.archived_at ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                loading={reativandoFornecedorId === fornecedor.id}
                                onClick={() => handleReativarFornecedor(fornecedor)}
                              >
                                Reativar
                              </Button>
                            ) : (
                              <>
                                <Button variant="secondary" size="sm" onClick={() => abrirEditarFornecedor(fornecedor)}>
                                  Editar
                                </Button>
                                <Button
                                  variant="danger-outline"
                                  size="sm"
                                  onClick={() => pedirArquivamentoFornecedor(fornecedor)}
                                >
                                  Arquivar
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="financeiro-mobile-view plano-contas-cards">
                {fornecedoresVisiveis.map((fornecedor) => (
                  <Card key={fornecedor.id} className="plano-contas-card">
                    <div className="plano-contas-card-row">
                      <span className="plano-contas-card-name">{fornecedor.name}</span>
                      {fornecedor.archived_at ? (
                        <Badge variant="neutral">Arquivado</Badge>
                      ) : (
                        <Badge variant="success">Ativo</Badge>
                      )}
                    </div>
                    {fornecedor.document && (
                      <p className="plano-contas-card-detail">{formatarDocumento(fornecedor.document)}</p>
                    )}
                    {fornecedor.default_category && (
                      <p className="plano-contas-card-detail">
                        Categoria padrão: {fornecedor.default_category.name}
                        {fornecedor.default_category.archived && ' (arquivada)'}
                      </p>
                    )}
                    <div className="plano-contas-row-actions">
                      {fornecedor.archived_at ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          fullWidth
                          loading={reativandoFornecedorId === fornecedor.id}
                          onClick={() => handleReativarFornecedor(fornecedor)}
                        >
                          Reativar
                        </Button>
                      ) : (
                        <>
                          <Button variant="secondary" size="sm" onClick={() => abrirEditarFornecedor(fornecedor)}>
                            Editar
                          </Button>
                          <Button
                            variant="danger-outline"
                            size="sm"
                            onClick={() => pedirArquivamentoFornecedor(fornecedor)}
                          >
                            Arquivar
                          </Button>
                        </>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      <Drawer
        isOpen={drawerOpen}
        onClose={fecharDrawer}
        title={categoriaEmEdicao ? 'Renomear categoria' : 'Nova categoria de despesa'}
      >
        <CategoriaDespesaForm
          repository={repository}
          tenantId={tenant?.tenantId || ''}
          categoria={categoriaEmEdicao}
          onSalvar={handleSalvar}
          onCancelar={fecharDrawer}
        />
      </Drawer>

      <ConfirmDialog
        isOpen={Boolean(categoriaParaArquivar)}
        onClose={() => setCategoriaParaArquivar(null)}
        onConfirm={confirmarArquivamento}
        title="Arquivar categoria de despesa"
        description={
          <>
            &ldquo;{categoriaParaArquivar?.name}&rdquo; sai das opções de lançamento, o histórico já classificado
            nela é preservado, e é possível reativá-la a qualquer momento. Fornecedores que a usam como categoria
            padrão mantêm o vínculo, mas deixam de tê-la pré-preenchida.
          </>
        }
        variant="warning"
        confirmText="Arquivar"
        loading={arquivando}
      />

      <Drawer
        isOpen={drawerFornecedorOpen}
        onClose={fecharDrawerFornecedor}
        title={fornecedorEmEdicao ? 'Editar fornecedor' : 'Novo fornecedor'}
      >
        <FornecedorForm
          repository={repository}
          tenantId={tenant?.tenantId || ''}
          fornecedor={fornecedorEmEdicao}
          categoriasAtivas={categoriasAtivas}
          onSalvar={handleSalvarFornecedor}
          onCancelar={fecharDrawerFornecedor}
        />
      </Drawer>

      <ConfirmDialog
        isOpen={Boolean(fornecedorParaArquivar)}
        onClose={() => setFornecedorParaArquivar(null)}
        onConfirm={confirmarArquivamentoFornecedor}
        title="Arquivar fornecedor"
        description={
          <>
            &ldquo;{fornecedorParaArquivar?.name}&rdquo; sai das opções de lançamento, o histórico já
            registrado com ele é preservado, e é possível reativá-lo a qualquer momento.
          </>
        }
        variant="warning"
        confirmText="Arquivar"
        loading={arquivandoFornecedor}
      />
    </div>
  );
};
