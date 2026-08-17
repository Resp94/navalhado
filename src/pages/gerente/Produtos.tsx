import React, { useEffect, useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { TenantContextType } from '../../components/GerenteLayout';
import { useToast } from '../../components/Toast';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { SupabaseProdutoAdapter } from '../../modules/produtos/adapters/SupabaseProdutoAdapter';
import { ProdutoRepository } from '../../modules/produtos/ProdutoRepository';
import type {
  MovementType,
  Product,
  ProductMovement,
  ProductType,
} from '../../modules/produtos/types';

import { HugeiconsIcon } from '@hugeicons/react';
import {
  Search01Icon,
  PlusSignIcon,
  Edit01Icon,
  Clock01Icon,
  Cancel01Icon,
  Alert02Icon,
} from '@hugeicons/core-free-icons';

// Ícones Oficiais Hugeicons
const SearchIcon = () => <HugeiconsIcon icon={Search01Icon} size={18} />;
const PlusIcon = () => <HugeiconsIcon icon={PlusSignIcon} size={18} />;
const EditIcon = () => <HugeiconsIcon icon={Edit01Icon} size={16} />;
const HistoryIcon = () => <HugeiconsIcon icon={Clock01Icon} size={16} />;
const CloseIcon = () => <HugeiconsIcon icon={Cancel01Icon} size={20} />;
const AlertTriangleIcon = () => <HugeiconsIcon icon={Alert02Icon} size={14} />;


export const Produtos: React.FC = () => {
  const tenant = useOutletContext<TenantContextType>();
  const { addToast } = useToast();

  const repository = useMemo(() => {
    const adapter = new SupabaseProdutoAdapter();
    return new ProdutoRepository(adapter);
  }, []);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'retail' | 'internal_use' | 'low_stock'>('all');

  // Modal de Cadastro/Edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    category: 'Finalizadores',
    product_type: 'retail' as ProductType,
    unit_type: 'un',
    price: '',
    cost_price: '',
    stock_quantity: '0',
    min_stock_alert: '5',
    commission_percentage: '',
    is_active: true,
  });


  // Modal de Ajuste de Estoque
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustData, setAdjustData] = useState({
    quantityChange: '1',
    movementType: 'entry_manual' as MovementType,
    notes: '',
  });

  // Modal de Histórico de Movimentações
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<ProductMovement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const list = await repository.listAll(tenant.tenantId);
      setProducts(list);
    } catch (error: any) {
      console.error('Erro ao carregar produtos:', error);
      addToast('Não foi possível carregar o catálogo de produtos.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [tenant.tenantId]);

  useGSAP(() => {
    if (!loading && products.length > 0) {
      gsap.fromTo(
        '.stat-card',
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.05, ease: 'cubic-bezier(0.16, 1, 0.3, 1)' }
      );
      gsap.fromTo(
        '.product-row',
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.03, delay: 0.2, ease: 'cubic-bezier(0.16, 1, 0.3, 1)' }
      );
    }
  }, [loading, filterType, searchTerm]);

  // Helpers de formatação
  const formatPriceToBR = (digits: string): string => {
    const padded = digits.padStart(3, '0');
    const intPart = padded.slice(0, -2);
    const centPart = padded.slice(-2);
    const intFormatted = parseInt(intPart, 10).toLocaleString('pt-BR');
    return `${intFormatted},${centPart}`;
  };

  const parsePriceFromBR = (formatted: string): number => {
    const normalized = formatted.replace(/\./g, '').replace(',', '.');
    return parseFloat(normalized) || 0;
  };

  // Filtragem
  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return products.filter((p) => {
      const matchesSearch =
        !term ||
        p.name.toLowerCase().includes(term) ||
        (p.brand && p.brand.toLowerCase().includes(term)) ||
        (p.category && p.category.toLowerCase().includes(term));

      if (!matchesSearch) return false;

      if (filterType === 'retail') return p.product_type === 'retail';
      if (filterType === 'internal_use') return p.product_type === 'internal_use';
      if (filterType === 'low_stock') return p.stock_quantity <= p.min_stock_alert;

      return true;
    });
  }, [products, searchTerm, filterType]);

  // Estatísticas
  const stats = useMemo(() => {
    const total = products.length;
    const retailCount = products.filter((p) => p.product_type === 'retail').length;
    const internalCount = products.filter((p) => p.product_type === 'internal_use').length;
    const lowStockCount = products.filter((p) => p.stock_quantity <= p.min_stock_alert).length;
    return { total, retailCount, internalCount, lowStockCount };
  }, [products]);

  // Modal Handlers
  const handleOpenModal = (product: Product | null = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        brand: product.brand || '',
        category: product.category || 'Geral',
        product_type: product.product_type || 'retail',
        unit_type: product.unit_type || 'un',
        price: product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
        cost_price: product.cost_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
        stock_quantity: product.stock_quantity.toString(),
        min_stock_alert: product.min_stock_alert.toString(),
        commission_percentage:
          product.commission_percentage !== null && product.commission_percentage !== undefined
            ? product.commission_percentage.toString()
            : '',
        is_active: product.is_active,
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        brand: '',
        category: 'Finalizadores',
        product_type: 'retail',
        unit_type: 'un',
        price: '',
        cost_price: '',
        stock_quantity: '0',
        min_stock_alert: '5',
        commission_percentage: '',
        is_active: true,
      });
    }
    setIsModalOpen(true);
  };


  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      addToast('O nome do produto é obrigatório.', 'warning');
      return;
    }

    try {
      setSaving(true);
      await repository.saveProduct(tenant.tenantId, {
        id: editingProduct?.id,
        name: formData.name,
        brand: formData.brand || null,
        category: formData.category || 'Geral',
        product_type: formData.product_type,
        unit_type: formData.unit_type,
        price: parsePriceFromBR(formData.price),
        cost_price: parsePriceFromBR(formData.cost_price),
        stock_quantity: parseInt(formData.stock_quantity, 10) || 0,
        min_stock_alert: parseInt(formData.min_stock_alert, 10) || 5,
        commission_percentage: formData.commission_percentage ? parseFloat(formData.commission_percentage) : null,
        is_active: formData.is_active,
      });

      addToast(
        editingProduct ? 'Produto atualizado com sucesso!' : 'Produto cadastrado com sucesso!',
        'success'
      );

      setIsModalOpen(false);
      fetchProducts();
    } catch (error: any) {
      console.error('Erro ao salvar produto:', error);
      addToast('Erro ao salvar produto.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAdjustModal = (product: Product) => {
    setAdjustProduct(product);
    setAdjustData({
      quantityChange: '1',
      movementType: 'entry_manual',
      notes: '',
    });
    setIsAdjustModalOpen(true);
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustProduct) return;

    const qty = parseInt(adjustData.quantityChange, 10);
    if (isNaN(qty) || qty === 0) {
      addToast('Informe uma quantidade válida para ajuste.', 'warning');
      return;
    }

    try {
      setSaving(true);
      await repository.adjustStock(
        tenant.tenantId,
        adjustProduct.id,
        qty,
        adjustData.movementType,
        adjustData.notes
      );

      addToast('Estoque ajustado com sucesso!', 'success');
      setIsAdjustModalOpen(false);
      fetchProducts();
    } catch (error: any) {
      console.error('Erro ao ajustar estoque:', error);
      addToast('Erro ao ajustar estoque do produto.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenHistoryModal = async (product: Product) => {
    setHistoryProduct(product);
    setIsHistoryModalOpen(true);
    try {
      setLoadingMovements(true);
      const list = await repository.getMovements(tenant.tenantId, product.id);
      setMovements(list);
    } catch (error: any) {
      console.error('Erro ao carregar movimentações:', error);
      addToast('Não foi possível carregar o histórico de movimentações.', 'error');
    } finally {
      setLoadingMovements(false);
    }
  };

  return (
    <div className="produtos-page">
      {/* 1. ESTATÍSTICAS DO ESTOQUE */}
      <section className="stat-cards-grid">
        <div className="stat-card">
          <span className="stat-card__eyebrow">Total em Catálogo</span>
          <span className="stat-card__number">{stats.total}</span>
          <span className="stat-card__helper">Produtos cadastrados</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__eyebrow">Venda Balcão</span>
          <span className="stat-card__number text-brand">{stats.retailCount}</span>
          <span className="stat-card__helper">Pomadas, óleos e varejo</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__eyebrow">Insumos de Bancada</span>
          <span className="stat-card__number">{stats.internalCount}</span>
          <span className="stat-card__helper">Golas, lâminas e toalhas</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__eyebrow">Reposição Necessária</span>
          <span className={`stat-card__number ${stats.lowStockCount > 0 ? 'text-danger' : 'text-success'}`}>
            {stats.lowStockCount}
          </span>
          <span className="stat-card__helper">Estoque abaixo do mínimo</span>
        </div>
      </section>

      {/* 2. BARRA DE CONTROLES E BUSCA */}
      <div className="products-controls-bar">
        <div className="search-input-wrapper">
          <span className="search-icon">
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Buscar produto por nome, marca ou categoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-control"
          />
        </div>

        <div className="filter-group-container">
          <button
            onClick={() => setFilterType('all')}
            className={`btn-filter ${filterType === 'all' ? 'btn-filter--active' : ''}`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilterType('retail')}
            className={`btn-filter ${filterType === 'retail' ? 'btn-filter--active' : ''}`}
          >
            Venda Balcão
          </button>
          <button
            onClick={() => setFilterType('internal_use')}
            className={`btn-filter ${filterType === 'internal_use' ? 'btn-filter--active' : ''}`}
          >
            Insumos
          </button>
          <button
            onClick={() => setFilterType('low_stock')}
            className={`btn-filter ${filterType === 'low_stock' ? 'btn-filter--active btn-filter--alert' : ''}`}
          >
            Estoque Baixo ({stats.lowStockCount})
          </button>
        </div>

        <button onClick={() => handleOpenModal(null)} className="btn btn--primary btn-add-product">
          <PlusIcon /> Novo Produto
        </button>
      </div>

      {/* 3. TABELA DE PRODUTOS */}
      <div className="table-container shadow-glass">
        {loading ? (
          <div className="loading-state">
            <div className="spinner mb-2" />
            <p>Carregando produtos...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="empty-state">
            <p>Nenhum produto encontrado para os filtros selecionados.</p>
          </div>
        ) : (
          <table className="products-table">
            <thead>
              <tr>
                <th>Produto e Marca</th>
                <th>Tipo de Uso</th>
                <th>Categoria</th>
                <th>Preço de Venda</th>
                <th>Estoque Atual</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p) => {
                const isLowStock = p.stock_quantity <= p.min_stock_alert;
                return (
                  <tr key={p.id} className={`product-row ${isLowStock ? 'row-low-stock' : ''}`}>
                    <td>
                      <div className="product-title-cell">
                        <strong className="product-name">{p.name}</strong>
                        {p.brand && <span className="product-brand">{p.brand}</span>}
                      </div>
                    </td>
                    <td>
                      {p.product_type === 'retail' ? (
                        <span className="badge badge--retail">Venda Balcão</span>
                      ) : (
                        <span className="badge badge--internal">Insumo Bancada</span>
                      )}
                    </td>
                    <td>
                      <span className="product-category-text">{p.category || 'Geral'}</span>
                    </td>
                    <td>
                      <div className="price-info-cell">
                        <strong className="font-mono text-brand">
                          R$ {p.price.toFixed(2).replace('.', ',')}
                        </strong>
                        {p.cost_price > 0 && (
                          <span className="cost-price-hint">
                            Custo: R$ {p.cost_price.toFixed(2).replace('.', ',')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="stock-level-cell">
                        <span className={`stock-badge ${isLowStock ? 'stock-badge--alert' : 'stock-badge--ok'}`}>
                          {isLowStock && <AlertTriangleIcon />}
                          <strong>{p.stock_quantity}</strong> {p.unit_type}
                        </span>
                        {isLowStock && (
                          <span className="stock-alert-hint">Mínimo: {p.min_stock_alert}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="actions-cell">
                        <button
                          onClick={() => handleOpenAdjustModal(p)}
                          className="btn btn--outline btn--xs"
                          title="Ajustar quantidade em estoque"
                        >
                          Ajustar Estoque
                        </button>
                        <button
                          onClick={() => handleOpenHistoryModal(p)}
                          className="btn btn-icon-only"
                          title="Histórico de Movimentações"
                        >
                          <HistoryIcon />
                        </button>
                        <button
                          onClick={() => handleOpenModal(p)}
                          className="btn btn-icon-only"
                          title="Editar Produto"
                        >
                          <EditIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 4. MODAL DE CADASTRO/EDIÇÃO DE PRODUTO (DOUBLE-BEZEL) */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content shadow-xl animate-spring" style={{ maxWidth: '640px' }}>
            <header className="modal-header">
              <h3 className="modal-title">
                {editingProduct ? 'Editar Produto' : 'Novo Produto'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="btn-close-modal">
                <CloseIcon />
              </button>
            </header>

            <form onSubmit={handleSaveSubmit} className="modal-body">
              <div className="form-group">
                <label htmlFor="prod-name">Nome do Produto *</label>
                <input
                  id="prod-name"
                  type="text"
                  required
                  placeholder="Ex: Pomada Modeladora Matte 100g, Gola Higiênica"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="form-control"
                />
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label htmlFor="prod-brand">Marca / Fabricante</label>
                  <input
                    id="prod-brand"
                    type="text"
                    placeholder="Ex: Baboon, Fox For Men, Barbearia Navalhado"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="form-control"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="prod-category">Categoria</label>
                  <input
                    id="prod-category"
                    type="text"
                    placeholder="Ex: Pomadas, Barba, Higiene, Lâminas"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="form-control"
                  />
                </div>
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label htmlFor="prod-type-select">Classificação de Uso</label>
                  <select
                    id="prod-type-select"
                    value={formData.product_type}
                    onChange={(e) =>
                      setFormData({ ...formData, product_type: e.target.value as ProductType })
                    }
                    className="form-control"
                  >
                    <option value="retail">Venda no Balcão (Varejo para Cliente)</option>
                    <option value="internal_use">Insumo de Bancada (Consumo dos Barbeiros)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="unit-type-select">Unidade de Medida</label>
                  <select
                    id="unit-type-select"
                    value={formData.unit_type}
                    onChange={(e) => setFormData({ ...formData, unit_type: e.target.value })}
                    className="form-control"
                  >
                    <option value="un">Unidade (un)</option>
                    <option value="cx">Caixa / Pacote (cx)</option>
                    <option value="ml">Mililitros (ml)</option>
                    <option value="lt">Litros (lt)</option>
                    <option value="kg">Quilogramas (kg)</option>
                  </select>
                </div>
              </div>


              <div className="form-group-row">
                <div className="form-group">
                  <label htmlFor="cost-price-input">Preço de Custo (R$)</label>
                  <input
                    id="cost-price-input"
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex: 25,00"
                    value={formData.cost_price}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '');
                      setFormData({ ...formData, cost_price: digits ? formatPriceToBR(digits) : '' });
                    }}
                    className="form-control"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="price-input">Preço de Venda (R$) *</label>
                  <input
                    id="price-input"
                    type="text"
                    inputMode="decimal"
                    required
                    placeholder="Ex: 55,00"
                    value={formData.price}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '');
                      setFormData({ ...formData, price: digits ? formatPriceToBR(digits) : '' });
                    }}
                    className="form-control"
                  />
                </div>
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label htmlFor="stock-qty-input">
                    {editingProduct ? 'Estoque Atual' : 'Estoque Inicial'}
                  </label>
                  <input
                    id="stock-qty-input"
                    type="number"
                    min="0"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                    className="form-control"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="min-stock-input">Alerta de Estoque Mínimo</label>
                  <input
                    id="min-stock-input"
                    type="number"
                    min="1"
                    value={formData.min_stock_alert}
                    onChange={(e) => setFormData({ ...formData, min_stock_alert: e.target.value })}
                    className="form-control"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="prod-comm-input">Comissão do Barbeiro na Venda (%) <span className="label-optional">Opcional</span></label>
                <div className="input-group">
                  <input
                    id="prod-comm-input"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Ex: 10"
                    value={formData.commission_percentage}
                    onChange={(e) =>
                      setFormData({ ...formData, commission_percentage: e.target.value })
                    }
                    className="form-control"
                  />
                  <span className="input-group__suffix">%</span>
                </div>
              </div>

              <footer className="modal-footer">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn--outline">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn btn--primary">
                  {saving ? <div className="spinner spinner--sm" /> : 'Salvar Produto'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL DE AJUSTE RÁPIDO DE ESTOQUE */}
      {isAdjustModalOpen && adjustProduct && (
        <div className="modal-backdrop">
          <div className="modal-content shadow-xl animate-spring" style={{ maxWidth: '480px' }}>
            <header className="modal-header">
              <div>
                <span className="modal-eyebrow">Movimentação Atômica</span>
                <h3 className="modal-title">Ajustar Estoque: {adjustProduct.name}</h3>
              </div>
              <button onClick={() => setIsAdjustModalOpen(false)} className="btn-close-modal">
                <CloseIcon />
              </button>
            </header>

            <form onSubmit={handleAdjustSubmit} className="modal-body">
              <div className="current-stock-callout card">
                <span>Estoque Atual:</span>
                <strong className="font-mono text-lg">
                  {adjustProduct.stock_quantity} {adjustProduct.unit_type}
                </strong>
              </div>

              <div className="form-group">
                <label htmlFor="mov-type-select">Tipo de Movimentação</label>
                <select
                  id="mov-type-select"
                  value={adjustData.movementType}
                  onChange={(e) =>
                    setAdjustData({ ...adjustData, movementType: e.target.value as MovementType })
                  }
                  className="form-control"
                >
                  <option value="entry_purchase">Entrada por Compra / Fornecedor (+)</option>
                  <option value="entry_manual">Entrada Manual (+)</option>
                  <option value="exit_internal_use">Saída por Consumo / Uso em Bancada (-)</option>
                  <option value="exit_manual">Saída Manual / Perda / Avaria (-)</option>
                  <option value="adjustment">Ajuste de Balanço / Inventário (±)</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="qty-change-input">
                  Quantidade a {adjustData.movementType.startsWith('exit') ? 'Subtrair (-)' : 'Adicionar (+)'}
                </label>
                <input
                  id="qty-change-input"
                  type="number"
                  required
                  value={adjustData.quantityChange}
                  onChange={(e) => setAdjustData({ ...adjustData, quantityChange: e.target.value })}
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label htmlFor="adjust-notes">Observações / Motivo</label>
                <input
                  id="adjust-notes"
                  type="text"
                  placeholder="Ex: Nota Fiscal 1234, reposição semanal, quebra de frasco"
                  value={adjustData.notes}
                  onChange={(e) => setAdjustData({ ...adjustData, notes: e.target.value })}
                  className="form-control"
                />
              </div>

              <footer className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="btn btn--outline"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn btn--primary">
                  {saving ? <div className="spinner spinner--sm" /> : 'Confirmar Ajuste'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL DE HISTÓRICO DE MOVIMENTAÇÕES */}
      {isHistoryModalOpen && historyProduct && (
        <div className="modal-backdrop">
          <div className="modal-content shadow-xl animate-spring" style={{ maxWidth: '600px' }}>
            <header className="modal-header">
              <div>
                <span className="modal-eyebrow">Auditoria de Estoque</span>
                <h3 className="modal-title">Movimentações: {historyProduct.name}</h3>
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="btn-close-modal">
                <CloseIcon />
              </button>
            </header>

            <div className="modal-body">
              {loadingMovements ? (
                <div className="loading-state py-4">
                  <div className="spinner mb-2" />
                  <p>Carregando movimentações...</p>
                </div>
              ) : movements.length === 0 ? (
                <div className="empty-state">
                  <p>Nenhuma movimentação registrada para este produto.</p>
                </div>
              ) : (
                <div className="movements-list">
                  {movements.map((mov) => (
                    <div key={mov.id} className="movement-card card shadow-glass">
                      <div className="movement-card__header">
                        <span
                          className={`movement-badge ${
                            mov.quantity_change > 0 ? 'movement-badge--in' : 'movement-badge--out'
                          }`}
                        >
                          {mov.quantity_change > 0 ? `+${mov.quantity_change}` : mov.quantity_change}{' '}
                          {historyProduct.unit_type}
                        </span>
                        <span className="movement-type-label">
                          {mov.movement_type === 'entry_purchase' && 'Compra Fornecedor'}
                          {mov.movement_type === 'entry_manual' && 'Entrada Manual'}
                          {mov.movement_type === 'exit_sale_comanda' && 'Venda Comanda'}
                          {mov.movement_type === 'exit_internal_use' && 'Consumo Bancada'}
                          {mov.movement_type === 'exit_manual' && 'Saída Manual'}
                          {mov.movement_type === 'adjustment' && 'Inventário'}
                        </span>
                        <span className="text-muted text-xs">
                          {new Date(mov.created_at).toLocaleString('pt-BR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>
                      <div className="movement-card__footer">
                        <span className="text-xs text-secondary">
                          Saldo após movimentação: <strong>{mov.new_stock_level}</strong>
                        </span>
                        {mov.notes && <span className="text-xs text-italic">"{mov.notes}"</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <footer className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="btn btn--outline"
                >
                  Fechar
                </button>
              </footer>
            </div>
          </div>
        </div>
      )}

      {/* ESTILOS CSS LOCAIS */}
      <style>{`
        .produtos-page {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          width: 100%;
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .stat-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1.25rem;
        }

        .stat-card {
          background: rgba(255, 255, 255, 0.65);
          backdrop-filter: blur(8px);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          box-shadow: var(--shadow-sm);
        }

        .stat-card__eyebrow {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 600;
        }

        .stat-card__number {
          font-size: var(--font-size-3xl);
          font-weight: 800;
          color: var(--color-text-primary);
        }

        .stat-card__helper {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
        }

        .products-controls-bar {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .search-input-wrapper {
          position: relative;
          flex: 1;
          min-width: 250px;
        }

        .search-icon {
          position: absolute;
          left: 0.85rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--color-text-secondary);
          display: flex;
          align-items: center;
        }

        .search-input-wrapper .form-control {
          padding-left: 2.5rem;
          height: 42px;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border);
          background-color: var(--color-bg-secondary);
          width: 100%;
          outline: none;
          font-size: var(--font-size-sm);
        }

        .filter-group-container {
          display: flex;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 3px;
          gap: 2px;
        }

        .btn-filter {
          padding: 0.45rem 0.85rem;
          font-size: var(--font-size-xs);
          font-weight: 700;
          border: none;
          background: transparent;
          color: var(--color-text-secondary);
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-filter--active {
          background: #ffffff;
          color: var(--color-text-primary);
          box-shadow: var(--shadow-sm);
        }

        .btn-filter--alert.btn-filter--active {
          color: var(--color-danger);
        }

        .products-table {
          width: 100%;
          border-collapse: collapse;
        }

        .products-table th {
          background: var(--color-bg-secondary);
          padding: 0.85rem 1rem;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 700;
          color: var(--color-text-secondary);
          border-bottom: 1px solid var(--color-border);
          text-align: left;
        }

        .products-table td {
          padding: 0.85rem 1rem;
          border-bottom: 1px solid var(--color-border);
        }

        .product-title-cell {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .product-brand {
          font-size: 11px;
          color: var(--color-text-secondary);
          font-weight: 600;
        }

        .badge--retail {
          background: rgba(217, 108, 0, 0.1);
          color: var(--color-brand-primary);
          padding: 3px 8px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 700;
        }

        .badge--internal {
          background: rgba(14, 159, 110, 0.1);
          color: var(--color-success);
          padding: 3px 8px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 700;
        }

        .price-info-cell {
          display: flex;
          flex-direction: column;
          gap: 0.1rem;
        }

        .cost-price-hint {
          font-size: 10px;
          color: var(--color-text-secondary);
        }

        .stock-level-cell {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .stock-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 12px;
          padding: 2px 8px;
          border-radius: 6px;
          width: fit-content;
        }

        .stock-badge--ok {
          background: rgba(0, 0, 0, 0.05);
          color: var(--color-text-primary);
        }

        .stock-badge--alert {
          background: rgba(224, 36, 36, 0.12);
          color: var(--color-danger);
          font-weight: 700;
        }

        .stock-alert-hint {
          font-size: 10px;
          color: var(--color-danger);
          font-weight: 600;
        }

        .current-stock-callout {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          background: rgba(217, 108, 0, 0.06);
          border: 1px solid rgba(217, 108, 0, 0.15);
          margin-bottom: 1rem;
        }

        .movements-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          max-height: 400px;
          overflow-y: auto;
        }

        .movement-card {
          padding: 0.85rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .movement-card__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .movement-badge {
          font-weight: 800;
          font-size: 12px;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .movement-badge--in {
          background: rgba(14, 159, 110, 0.15);
          color: var(--color-success);
        }

        .movement-badge--out {
          background: rgba(224, 36, 36, 0.15);
          color: var(--color-danger);
        }

        .movement-type-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-secondary);
        }

        .movement-card__footer {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          padding-top: 0.35rem;
          border-top: 1px dashed var(--color-border);
        }

        .form-group-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
      `}</style>
    </div>
  );
};
