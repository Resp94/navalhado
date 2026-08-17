import React, { useEffect, useState, useMemo, useCallback } from 'react';
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
  ShoppingBag01Icon,
  ScissorIcon,
  ArrowRight01Icon,
  Note01Icon,
} from '@hugeicons/core-free-icons';

// Ícones Oficiais Hugeicons
const SearchIcon = () => <HugeiconsIcon icon={Search01Icon} size={18} aria-hidden="true" />;
const PlusIcon = () => <HugeiconsIcon icon={PlusSignIcon} size={18} aria-hidden="true" />;
const EditIcon = () => <HugeiconsIcon icon={Edit01Icon} size={16} aria-hidden="true" />;
const HistoryIcon = () => <HugeiconsIcon icon={Clock01Icon} size={16} aria-hidden="true" />;
const CloseIcon = () => <HugeiconsIcon icon={Cancel01Icon} size={20} aria-hidden="true" />;
const AlertTriangleIcon = () => <HugeiconsIcon icon={Alert02Icon} size={14} aria-hidden="true" />;
const ShoppingBagIcon = () => <HugeiconsIcon icon={ShoppingBag01Icon} size={20} aria-hidden="true" />;
const ScissorsIcon = () => <HugeiconsIcon icon={ScissorIcon} size={20} aria-hidden="true" />;
const ArrowRightIcon = () => <HugeiconsIcon icon={ArrowRight01Icon} size={14} aria-hidden="true" />;
const NoteIcon = () => <HugeiconsIcon icon={Note01Icon} size={14} aria-hidden="true" />;

const QUICK_CATEGORIES = ['Finalizadores', 'Barba', 'Shampoos', 'Lâminas', 'Higiene', 'Bebidas'];

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

  // Filtros de listagem principal
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
  const [historyFilter, setHistoryFilter] = useState<'all' | 'entries' | 'exits' | 'adjustments'>('all');

  const fetchProducts = useCallback(async () => {
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
  }, [repository, tenant.tenantId, addToast]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Fechar modais ao pressionar tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isModalOpen) setIsModalOpen(false);
        if (isAdjustModalOpen) setIsAdjustModalOpen(false);
        if (isHistoryModalOpen) setIsHistoryModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, isAdjustModalOpen, isHistoryModalOpen]);

  // Animação de entrada da tabela
  useGSAP(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    if (!loading && products.length > 0) {
      gsap.fromTo(
        '.stat-card',
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.04, ease: 'power2.out' }
      );
      gsap.fromTo(
        '.product-row',
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.3, stagger: 0.02, delay: 0.1, ease: 'power2.out' }
      );
    }
  }, [loading]);

  // Helpers de formatação monetária
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

  // Métricas financeiras em tempo real do modal de produto
  const financialMetrics = useMemo(() => {
    const cost = parsePriceFromBR(formData.cost_price);
    const price = parsePriceFromBR(formData.price);
    const profit = price - cost;
    const marginPct = price > 0 ? (profit / price) * 100 : 0;
    const markupPct = cost > 0 ? (profit / cost) * 100 : 0;
    const commPct = parseFloat(formData.commission_percentage) || 0;
    const commValue = price > 0 && commPct > 0 ? (price * commPct) / 100 : 0;

    return {
      cost,
      price,
      profit,
      marginPct,
      markupPct,
      commPct,
      commValue,
      isLoss: price > 0 && cost > 0 && price < cost,
      hasData: price > 0 || cost > 0,
    };
  }, [formData.cost_price, formData.price, formData.commission_percentage]);

  // Filtragem da tabela principal
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

  // Estatísticas de estoque geral
  const stats = useMemo(() => {
    const total = products.length;
    const retailCount = products.filter((p) => p.product_type === 'retail').length;
    const internalCount = products.filter((p) => p.product_type === 'internal_use').length;
    const lowStockCount = products.filter((p) => p.stock_quantity <= p.min_stock_alert).length;
    return { total, retailCount, internalCount, lowStockCount };
  }, [products]);

  // Classificadores de movimentações resilientes
  const isEntryMovement = useCallback((m: ProductMovement) => {
    if (m.movement_type === 'entry_manual' || m.movement_type === 'entry_purchase') return true;
    if (m.movement_type === 'adjustment') return false;
    return (m.quantity_change !== undefined && m.quantity_change > 0);
  }, []);

  const isExitMovement = useCallback((m: ProductMovement) => {
    if (m.movement_type === 'exit_manual' || m.movement_type === 'exit_sale_comanda' || m.movement_type === 'exit_internal_use') return true;
    if (m.movement_type === 'adjustment') return false;
    return (m.quantity_change !== undefined && m.quantity_change < 0);
  }, []);

  const isAdjustmentMovement = useCallback((m: ProductMovement) => {
    return m.movement_type === 'adjustment';
  }, []);

  // Estatísticas de movimentações do histórico
  const movementStats = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    let entriesCount = 0;
    let exitsCount = 0;
    let adjustmentsCount = 0;

    movements.forEach((m) => {
      const qty = Math.abs(m.quantity ?? m.quantity_change ?? 0);
      if (isAdjustmentMovement(m)) {
        adjustmentsCount++;
      } else if (isEntryMovement(m)) {
        totalIn += qty;
        entriesCount++;
      } else if (isExitMovement(m)) {
        totalOut += qty;
        exitsCount++;
      }
    });

    return { totalIn, totalOut, entriesCount, exitsCount, adjustmentsCount };
  }, [movements, isAdjustmentMovement, isEntryMovement, isExitMovement]);

  // Movimentações filtradas no modal de histórico
  const filteredMovements = useMemo(() => {
    if (historyFilter === 'entries') {
      return movements.filter(isEntryMovement);
    }
    if (historyFilter === 'exits') {
      return movements.filter(isExitMovement);
    }
    if (historyFilter === 'adjustments') {
      return movements.filter(isAdjustmentMovement);
    }
    return movements;
  }, [movements, historyFilter, isAdjustmentMovement, isEntryMovement, isExitMovement]);

  // Handlers do Modal de Produto
  const handleOpenModal = (product: Product | null = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        brand: product.brand || '',
        category: product.category || 'Finalizadores',
        product_type: product.product_type || 'retail',
        unit_type: product.unit_type || 'un',
        price: product.price > 0 ? product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '',
        cost_price: product.cost_price > 0 ? product.cost_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '',
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

    if (formData.product_type === 'retail' && parsePriceFromBR(formData.price) <= 0) {
      addToast('Para produtos de venda no balcão, informe um preço de venda válido.', 'warning');
      return;
    }

    try {
      setSaving(true);
      await repository.saveProduct(tenant.tenantId, {
        id: editingProduct?.id,
        name: formData.name.trim(),
        brand: formData.brand.trim() || null,
        category: formData.category.trim() || 'Geral',
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

  // Handlers do Modal de Ajuste de Estoque
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

  // Handlers do Modal de Histórico de Movimentações
  const handleOpenHistoryModal = async (product: Product) => {
    setHistoryProduct(product);
    setHistoryFilter('all');
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

  // Helper para rótulo e estilo de movimentação
  const getMovementInfo = (type: MovementType, qty: number) => {
    switch (type) {
      case 'entry_purchase':
        return { label: 'Compra de fornecedor', category: 'entry', isPositive: true };
      case 'entry_manual':
        return { label: 'Entrada manual avulsa', category: 'entry', isPositive: true };
      case 'exit_sale_comanda':
        return { label: 'Venda em comanda', category: 'sale', isPositive: false };
      case 'exit_internal_use':
        return { label: 'Consumo de bancada (barbeiro)', category: 'usage', isPositive: false };
      case 'exit_manual':
        return { label: 'Saída por avaria ou perda', category: 'loss', isPositive: false };
      case 'adjustment':
        return { label: 'Ajuste de inventário', category: 'adjust', isPositive: qty >= 0 };
      default:
        return { label: 'Movimentação registrada', category: 'neutral', isPositive: qty >= 0 };
    }
  };

  return (
    <div className="produtos-page">
      {/* 1. ESTATÍSTICAS DO ESTOQUE */}
      <section className="stat-cards-grid" aria-label="Estatísticas gerais de produtos e estoque">
        <div className="stat-card">
          <span className="stat-card__eyebrow">Total no catálogo</span>
          <span className="stat-card__number">{stats.total}</span>
          <span className="stat-card__helper">Itens cadastrados</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__eyebrow">Venda no balcão</span>
          <span className="stat-card__number text-brand">{stats.retailCount}</span>
          <span className="stat-card__helper">Pomadas, óleos e varejo</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__eyebrow">Insumos de bancada</span>
          <span className="stat-card__number">{stats.internalCount}</span>
          <span className="stat-card__helper">Lâminas, golas e toalhas</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__eyebrow">Reposição necessária</span>
          <span className={`stat-card__number ${stats.lowStockCount > 0 ? 'text-error' : 'text-success'}`}>
            {stats.lowStockCount}
          </span>
          <span className="stat-card__helper">Itens abaixo do mínimo</span>
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
            placeholder="Buscar por nome, marca ou categoria..."
            aria-label="Buscar produtos por nome, marca ou categoria"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-control"
          />
        </div>

        <div className="filter-group-container" role="group" aria-label="Filtrar por tipo de produto">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`btn-filter ${filterType === 'all' ? 'btn-filter--active' : ''}`}
            aria-pressed={filterType === 'all'}
          >
            Todos ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('retail')}
            className={`btn-filter ${filterType === 'retail' ? 'btn-filter--active' : ''}`}
            aria-pressed={filterType === 'retail'}
          >
            Venda no balcão ({stats.retailCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('internal_use')}
            className={`btn-filter ${filterType === 'internal_use' ? 'btn-filter--active' : ''}`}
            aria-pressed={filterType === 'internal_use'}
          >
            Insumos ({stats.internalCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('low_stock')}
            className={`btn-filter ${filterType === 'low_stock' ? 'btn-filter--active btn-filter--alert' : ''}`}
            aria-pressed={filterType === 'low_stock'}
          >
            Estoque baixo ({stats.lowStockCount})
          </button>
        </div>

        <button
          type="button"
          onClick={() => handleOpenModal(null)}
          className="btn btn--primary btn-add-product"
        >
          <PlusIcon /> Novo produto
        </button>
      </div>

      {/* 3. TABELA DE PRODUTOS */}
      <div className="table-container shadow-glass">
        {loading ? (
          <div className="loading-state">
            <div className="spinner mb-2" />
            <p>Carregando catálogo de produtos...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="empty-state">
            <p>Nenhum produto encontrado para os filtros selecionados.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="products-table">
              <caption className="sr-only">Lista de produtos cadastrados e seus níveis de estoque</caption>
              <thead>
                <tr>
                  <th scope="col">Produto e marca</th>
                  <th scope="col">Finalidade de uso</th>
                  <th scope="col">Categoria</th>
                  <th scope="col">Preço de venda</th>
                  <th scope="col">Estoque atual</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Ações</th>
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
                          <span className="badge badge--retail">Venda no balcão</span>
                        ) : (
                          <span className="badge badge--internal">Insumo de bancada</span>
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
                            {isLowStock && (
                              <>
                                <AlertTriangleIcon />
                                <span className="sr-only">Alerta: estoque baixo</span>
                              </>
                            )}
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
                            type="button"
                            onClick={() => handleOpenAdjustModal(p)}
                            className="btn btn--outline btn--xs"
                            title={`Ajustar quantidade em estoque de ${p.name}`}
                            aria-label={`Ajustar estoque de ${p.name}`}
                          >
                            Ajustar estoque
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenHistoryModal(p)}
                            className="btn btn-icon-only"
                            title={`Histórico de movimentações de ${p.name}`}
                            aria-label={`Ver histórico de movimentações de ${p.name}`}
                          >
                            <HistoryIcon />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenModal(p)}
                            className="btn btn-icon-only"
                            title={`Editar produto ${p.name}`}
                            aria-label={`Editar produto ${p.name}`}
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
          </div>
        )}
      </div>

      {/* 4. MODAL POLIDO DE CADASTRO/EDIÇÃO DE PRODUTO */}
      {isModalOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
          role="presentation"
        >
          <div
            className="modal-content modal-content--product shadow-xl animate-spring"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-product-title"
          >
            <header className="modal-header">
              <div>
                <span className="modal-eyebrow">
                  {editingProduct ? 'Atualização de produto' : 'Novo item no catálogo'}
                </span>
                <h3 id="modal-product-title" className="modal-title">
                  {editingProduct ? `Editar: ${editingProduct.name}` : 'Cadastrar novo produto'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="btn-close-modal"
                aria-label="Fechar janela"
              >
                <CloseIcon />
              </button>
            </header>

            <form onSubmit={handleSaveSubmit} className="modal-body modal-body--polished">
              {/* SELETOR DE CLASSIFICAÇÃO COM CARDS TÁTEIS */}
              <div className="form-section">
                <span className="form-section__label">Finalidade de uso</span>
                <div className="product-type-selector" role="radiogroup" aria-label="Finalidade de uso do produto">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={formData.product_type === 'retail'}
                    className={`type-card ${formData.product_type === 'retail' ? 'type-card--active' : ''}`}
                    onClick={() => setFormData({ ...formData, product_type: 'retail' })}
                  >
                    <div className="type-card__icon type-card__icon--retail">
                      <ShoppingBagIcon />
                    </div>
                    <div className="type-card__info">
                      <strong className="type-card__title">Venda no balcão</strong>
                      <span className="type-card__desc">Produtos comercializados aos clientes, como pomadas, óleos e ceras</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    role="radio"
                    aria-checked={formData.product_type === 'internal_use'}
                    className={`type-card ${formData.product_type === 'internal_use' ? 'type-card--active' : ''}`}
                    onClick={() => setFormData({ ...formData, product_type: 'internal_use' })}
                  >
                    <div className="type-card__icon type-card__icon--internal">
                      <ScissorsIcon />
                    </div>
                    <div className="type-card__info">
                      <strong className="type-card__title">Insumo de bancada</strong>
                      <span className="type-card__desc">Materiais consumidos nos atendimentos, como lâminas, toalhas e golas</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* SEÇÃO DE IDENTIFICAÇÃO DO PRODUTO */}
              <div className="form-section">
                <div className="form-group">
                  <label htmlFor="prod-name">Nome do produto *</label>
                  <input
                    id="prod-name"
                    type="text"
                    required
                    autoFocus
                    placeholder="Ex: Pomada modeladora efeito matte 100g"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="form-control form-control--lg"
                  />
                </div>

                <div className="form-group-row">
                  <div className="form-group">
                    <label htmlFor="prod-brand">Marca ou fabricante</label>
                    <input
                      id="prod-brand"
                      type="text"
                      placeholder="Ex: Baboon, Fox For Men, Marca própria"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="unit-type-select">Unidade de medida</label>
                    <select
                      id="unit-type-select"
                      value={formData.unit_type}
                      onChange={(e) => setFormData({ ...formData, unit_type: e.target.value })}
                      className="form-control"
                    >
                      <option value="un">Unidade (un)</option>
                      <option value="cx">Caixa (cx)</option>
                      <option value="pct">Pacote (pct)</option>
                      <option value="ml">Mililitros (ml)</option>
                      <option value="lt">Litros (l)</option>
                      <option value="kg">Quilos (kg)</option>
                    </select>
                  </div>
                </div>

                {/* CATEGORIA COM CHIPS DE ESCOLHA RÁPIDA */}
                <div className="form-group">
                  <div className="category-header-line">
                    <label htmlFor="prod-category">Categoria</label>
                    <span className="category-quick-hint">Sugestões rápidas:</span>
                  </div>
                  <input
                    id="prod-category"
                    type="text"
                    placeholder="Ex: Finalizadores, Barba, Higiene"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="form-control"
                  />
                  <div className="quick-category-chips" role="group" aria-label="Sugestões de categoria">
                    {QUICK_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        className={`chip-btn ${formData.category === cat ? 'chip-btn--active' : ''}`}
                        onClick={() => setFormData({ ...formData, category: cat })}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* SEÇÃO FINANCEIRA E MARGEM EM TEMPO REAL */}
              <div className="form-section form-section--card">
                <div className="form-group-row">
                  <div className="form-group">
                    <label htmlFor="cost-price-input">Preço de custo unitário</label>
                    <div className="currency-input-wrapper">
                      <span className="currency-prefix">R$</span>
                      <input
                        id="cost-price-input"
                        type="text"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={formData.cost_price}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, '');
                          setFormData({ ...formData, cost_price: digits ? formatPriceToBR(digits) : '' });
                        }}
                        className="form-control currency-control"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="price-input">
                      Preço de venda ao cliente {formData.product_type === 'retail' ? '*' : '(opcional)'}
                    </label>
                    <div className="currency-input-wrapper">
                      <span className="currency-prefix">R$</span>
                      <input
                        id="price-input"
                        type="text"
                        inputMode="decimal"
                        required={formData.product_type === 'retail'}
                        placeholder="0,00"
                        value={formData.price}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, '');
                          setFormData({ ...formData, price: digits ? formatPriceToBR(digits) : '' });
                        }}
                        className="form-control currency-control"
                      />
                    </div>
                  </div>
                </div>

                {/* PAINEL DE INTELIGÊNCIA FINANCEIRA (MARGEM E LUCRO) */}
                {financialMetrics.hasData && (
                  <div className={`margin-intelligence-card ${financialMetrics.isLoss ? 'margin-intelligence-card--loss' : ''}`}>
                    <div className="margin-intelligence-card__row">
                      <div className="metric-item">
                        <span className="metric-item__label">Lucro bruto por unidade</span>
                        <strong className={`metric-item__value ${financialMetrics.profit >= 0 ? 'text-success' : 'text-error'}`}>
                          R$ {financialMetrics.profit.toFixed(2).replace('.', ',')}
                        </strong>
                      </div>
                      <div className="metric-item">
                        <span className="metric-item__label">Margem sobre a venda</span>
                        <strong className={`metric-item__value ${financialMetrics.marginPct >= 0 ? 'text-brand' : 'text-error'}`}>
                          {financialMetrics.marginPct.toFixed(1)}%
                        </strong>
                      </div>
                      <div className="metric-item">
                        <span className="metric-item__label">Markup sobre o custo</span>
                        <strong className="metric-item__value">
                          {financialMetrics.markupPct > 0 ? `+${financialMetrics.markupPct.toFixed(0)}%` : 'Sem custo base'}
                        </strong>
                      </div>
                    </div>
                    {financialMetrics.isLoss && (
                      <span className="loss-warning-text">
                        <AlertTriangleIcon /> O preço de venda informado é menor que o custo de compra.
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* SEÇÃO DE ESTOQUE E COMISSÕES */}
              <div className="form-section">
                <div className="form-group-row form-group-row--3cols">
                  <div className="form-group">
                    <label htmlFor="stock-qty-input">
                      {editingProduct ? 'Estoque atual' : 'Estoque inicial'}
                    </label>
                    <div className="input-group">
                      <input
                        id="stock-qty-input"
                        type="number"
                        min="0"
                        value={formData.stock_quantity}
                        onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                        className="form-control"
                      />
                      <span className="input-group__suffix">{formData.unit_type}</span>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="min-stock-input">Alerta de estoque mínimo</label>
                    <div className="input-group">
                      <input
                        id="min-stock-input"
                        type="number"
                        min="1"
                        value={formData.min_stock_alert}
                        onChange={(e) => setFormData({ ...formData, min_stock_alert: e.target.value })}
                        className="form-control"
                      />
                      <span className="input-group__suffix">{formData.unit_type}</span>
                    </div>
                  </div>

                  {formData.product_type === 'retail' && (
                    <div className="form-group">
                      <label htmlFor="prod-comm-input">Comissão do barbeiro</label>
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
                      {financialMetrics.commValue > 0 && (
                        <span className="comm-calc-hint">
                          R$ {financialMetrics.commValue.toFixed(2).replace('.', ',')} por unidade vendida
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <footer className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn--outline"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn btn--primary btn--save-product">
                  {saving ? (
                    <div className="spinner spinner--sm" />
                  ) : editingProduct ? (
                    'Salvar alterações'
                  ) : (
                    'Cadastrar produto'
                  )}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL DE AJUSTE RÁPIDO DE ESTOQUE */}
      {isAdjustModalOpen && adjustProduct && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAdjustModalOpen(false);
          }}
          role="presentation"
        >
          <div
            className="modal-content shadow-xl animate-spring"
            style={{ maxWidth: '480px' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-adjust-title"
          >
            <header className="modal-header">
              <div>
                <span className="modal-eyebrow">Movimentação de estoque</span>
                <h3 id="modal-adjust-title" className="modal-title">
                  Ajustar: {adjustProduct.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="btn-close-modal"
                aria-label="Fechar janela"
              >
                <CloseIcon />
              </button>
            </header>

            <form onSubmit={handleAdjustSubmit} className="modal-body">
              <div className="current-stock-callout card">
                <span>Saldo atual em estoque:</span>
                <strong className="font-mono text-lg text-brand">
                  {adjustProduct.stock_quantity} {adjustProduct.unit_type}
                </strong>
              </div>

              <div className="form-group">
                <label htmlFor="mov-type-select">Tipo de movimentação</label>
                <select
                  id="mov-type-select"
                  value={adjustData.movementType}
                  onChange={(e) =>
                    setAdjustData({ ...adjustData, movementType: e.target.value as MovementType })
                  }
                  className="form-control"
                >
                  <option value="entry_purchase">Entrada por compra de fornecedor (+)</option>
                  <option value="entry_manual">Entrada manual avulsa (+)</option>
                  <option value="exit_internal_use">Saída por consumo em bancada (-)</option>
                  <option value="exit_manual">Saída por avaria, perda ou validade (-)</option>
                  <option value="adjustment">Ajuste por contagem de inventário (±)</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="qty-change-input">
                  {adjustData.movementType === 'adjustment'
                    ? 'Novo saldo total apurado'
                    : adjustData.movementType.startsWith('exit')
                    ? 'Quantidade a subtrair do estoque (-)'
                    : 'Quantidade a adicionar ao estoque (+)'}
                </label>
                <input
                  id="qty-change-input"
                  type="number"
                  required
                  min="1"
                  value={adjustData.quantityChange}
                  onChange={(e) => setAdjustData({ ...adjustData, quantityChange: e.target.value })}
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label htmlFor="adjust-notes">Motivo ou justificativa da operação</label>
                <input
                  id="adjust-notes"
                  type="text"
                  placeholder="Ex: Nota fiscal 1234, reposição semanal, frasco quebrado"
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
                  {saving ? <div className="spinner spinner--sm" /> : 'Confirmar movimentação'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL POLIDO DE HISTÓRICO DE MOVIMENTAÇÕES (TIMELINE DE AUDITORIA) */}
      {isHistoryModalOpen && historyProduct && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsHistoryModalOpen(false);
          }}
          role="presentation"
        >
          <div
            className="modal-content modal-content--history shadow-xl animate-spring"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-history-title"
          >
            {/* CABEÇALHO DO MODAL COM RESUMO DO PRODUTO */}
            <header className="modal-header modal-header--history">
              <div>
                <span className="modal-eyebrow">Auditoria de estoque</span>
                <h3 id="modal-history-title" className="modal-title">
                  Histórico de movimentações
                </h3>
                <div className="product-history-badges">
                  <strong className="product-history-name">{historyProduct.name}</strong>
                  {historyProduct.brand && (
                    <span className="badge-tag">{historyProduct.brand}</span>
                  )}
                  <span className="badge-tag badge-tag--category">
                    {historyProduct.category || 'Geral'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="btn-close-modal"
                aria-label="Fechar janela"
              >
                <CloseIcon />
              </button>
            </header>

            <div className="modal-body modal-body--history">
              {/* CARD DE BALANÇO RÁPIDO DO PRODUTO */}
              <div className="history-summary-strip">
                <div className="history-summary-item">
                  <span className="history-summary-label">Estoque atual</span>
                  <strong className={`history-summary-value ${historyProduct.stock_quantity <= historyProduct.min_stock_alert ? 'text-error' : 'text-brand'}`}>
                    {historyProduct.stock_quantity} {historyProduct.unit_type}
                  </strong>
                </div>
                <div className="history-summary-divider" />
                <div className="history-summary-item">
                  <span className="history-summary-label">Total de entradas</span>
                  <strong className="history-summary-value text-success">
                    +{movementStats.totalIn} {historyProduct.unit_type}
                  </strong>
                </div>
                <div className="history-summary-divider" />
                <div className="history-summary-item">
                  <span className="history-summary-label">Total de saídas</span>
                  <strong className="history-summary-value text-error">
                    -{movementStats.totalOut} {historyProduct.unit_type}
                  </strong>
                </div>
              </div>

              {/* FILTROS DA TIMELINE */}
              <div className="history-filter-bar" role="group" aria-label="Filtrar movimentações">
                <button
                  type="button"
                  onClick={() => setHistoryFilter('all')}
                  className={`btn-history-filter ${historyFilter === 'all' ? 'btn-history-filter--active' : ''}`}
                  aria-pressed={historyFilter === 'all'}
                >
                  Todas ({movements.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFilter('entries')}
                  className={`btn-history-filter ${historyFilter === 'entries' ? 'btn-history-filter--active' : ''}`}
                  aria-pressed={historyFilter === 'entries'}
                >
                  Entradas ({movementStats.entriesCount})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFilter('exits')}
                  className={`btn-history-filter ${historyFilter === 'exits' ? 'btn-history-filter--active' : ''}`}
                  aria-pressed={historyFilter === 'exits'}
                >
                  Saídas ({movementStats.exitsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFilter('adjustments')}
                  className={`btn-history-filter ${historyFilter === 'adjustments' ? 'btn-history-filter--active' : ''}`}
                  aria-pressed={historyFilter === 'adjustments'}
                >
                  Ajustes ({movementStats.adjustmentsCount})
                </button>
              </div>

              {/* FEED DA TIMELINE DE MOVIMENTAÇÕES */}
              {loadingMovements ? (
                <div className="loading-state py-4">
                  <div className="spinner mb-2" />
                  <p>Carregando histórico de movimentações...</p>
                </div>
              ) : filteredMovements.length === 0 ? (
                <div className="empty-state empty-state--history">
                  <div className="empty-state__icon">
                    <HugeiconsIcon icon={Clock01Icon} size={28} aria-hidden="true" />
                  </div>
                  <strong>Nenhuma movimentação encontrada</strong>
                  <p>
                    {historyFilter !== 'all'
                      ? 'Nenhum registro localizado para a categoria selecionada.'
                      : 'As compras de fornecedor, vendas em comanda e baixas de bancada aparecerão aqui.'}
                  </p>
                </div>
              ) : (
                <div className="timeline-container">
                  <div className="timeline-track" />
                  <div className="timeline-list">
                    {filteredMovements.map((mov) => {
                      const isEntry = isEntryMovement(mov);
                      const isAdjustment = isAdjustmentMovement(mov);
                      const rawQty = Math.abs(mov.quantity ?? mov.quantity_change ?? 0);
                      const info = getMovementInfo(mov.movement_type, isAdjustment ? 0 : isEntry ? rawQty : -rawQty);
                      const formattedDate = new Date(mov.created_at).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const noteText = mov.notes || mov.reason;

                      return (
                        <div key={mov.id} className="timeline-item">
                          {/* NÓ VISUAL CONECTADO À LINHA */}
                          <div
                            className={`timeline-node ${
                              isAdjustment
                                ? 'timeline-node--adjust'
                                : isEntry
                                ? 'timeline-node--in'
                                : 'timeline-node--out'
                            }`}
                          >
                            <span className="timeline-node__symbol">
                              {isAdjustment ? '±' : isEntry ? '+' : '-'}
                            </span>
                          </div>

                          {/* CARD DE DETALHES DA MOVIMENTAÇÃO */}
                          <div className="timeline-card">
                            <div className="timeline-card__header">
                              <div className="timeline-card__title-line">
                                <span className={`timeline-type-pill timeline-type-pill--${info.category}`}>
                                  {info.label}
                                </span>
                                <span className="timeline-date">{formattedDate}</span>
                              </div>

                              {/* VARIAÇÃO NUMÉRICA EM DESTAQUE */}
                              <span
                                className={`timeline-qty-badge ${
                                  isAdjustment
                                    ? 'timeline-qty-badge--adjust'
                                    : isEntry
                                    ? 'timeline-qty-badge--in'
                                    : 'timeline-qty-badge--out'
                                }`}
                              >
                                {isAdjustment ? `${rawQty}` : isEntry ? `+${rawQty}` : `-${rawQty}`}{' '}
                                {historyProduct.unit_type}
                              </span>
                            </div>

                            {/* SALDO RESULTANTE */}
                            <div className="timeline-card__balance">
                              {mov.new_stock_level !== null && mov.new_stock_level !== undefined ? (
                                <span className="balance-indicator">
                                  Saldo após esta operação <ArrowRightIcon /> <strong>{mov.new_stock_level} {historyProduct.unit_type}</strong>
                                </span>
                              ) : (
                                <span className="balance-indicator">
                                  Registro auditado no estoque
                                </span>
                              )}
                            </div>

                            {/* NOTAS E JUSTIFICATIVAS */}
                            {noteText && (
                              <div className="timeline-card__notes">
                                <NoteIcon />
                                <span>"{noteText}"</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <footer className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="btn btn--outline"
                >
                  Fechar histórico
                </button>
              </footer>
            </div>
          </div>
        </div>
      )}

      {/* ESTILOS CSS REFINADOS COM NÍVEL IMPECCABLE */}
      <style>{`
        .produtos-page {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          width: 100%;
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .stat-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.25rem;
        }

        .stat-card {
          background-color: var(--color-bg-secondary);
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
          min-width: 260px;
        }

        .search-icon {
          position: absolute;
          left: 0.85rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--color-text-secondary);
          display: flex;
          align-items: center;
          pointer-events: none;
        }

        .search-input-wrapper .form-control {
          padding-left: 2.5rem;
          height: 42px;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border);
          background-color: var(--color-bg-secondary);
          color: var(--color-text-primary);
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
          padding: 0.5rem 0.85rem;
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
          background: var(--color-bg-primary);
          color: var(--color-text-primary);
          box-shadow: var(--shadow-sm);
        }

        .btn-filter--alert.btn-filter--active {
          color: var(--color-error);
        }

        .btn-add-product {
          height: 42px;
        }

        .table-container {
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }

        .table-responsive {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .products-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 680px;
        }

        .products-table th {
          background: var(--color-bg-secondary);
          padding: 0.85rem 1rem;
          font-size: var(--font-size-xs);
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
          font-size: var(--font-size-sm);
        }

        .product-title-cell {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .product-name {
          color: var(--color-text-primary);
          font-weight: 600;
        }

        .product-brand {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          font-weight: 600;
        }

        .product-category-text {
          font-size: var(--font-size-sm);
          color: var(--color-text-primary);
        }

        .badge {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          border-radius: var(--radius-full);
          font-size: var(--font-size-xs);
          font-weight: 700;
          line-height: 1;
        }

        .badge--retail {
          background: var(--color-brand-lightest);
          color: var(--color-brand-primary);
          border: 1px solid var(--color-brand-soft);
        }

        .badge--internal {
          background: var(--color-success-bg);
          color: var(--color-success);
        }

        .price-info-cell {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .cost-price-hint {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
        }

        .stock-level-cell {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .stock-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: var(--font-size-xs);
          padding: 3px 8px;
          border-radius: var(--radius-sm);
          width: fit-content;
        }

        .stock-badge--ok {
          background: var(--color-bg-primary);
          color: var(--color-text-primary);
          border: 1px solid var(--color-border);
        }

        .stock-badge--alert {
          background: var(--color-error-bg);
          color: var(--color-error);
          font-weight: 700;
          border: 1px solid rgba(240, 82, 82, 0.2);
        }

        .stock-alert-hint {
          font-size: var(--font-size-xs);
          color: var(--color-error);
          font-weight: 600;
        }

        .actions-cell {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.5rem;
        }

        .btn-icon-only {
          background: transparent;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          color: var(--color-text-secondary);
          width: 36px;
          height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-icon-only:hover {
          background: var(--color-bg-primary);
          color: var(--color-brand-primary);
          border-color: var(--color-brand-soft);
        }

        .btn--xs {
          padding: 0.4rem 0.75rem;
          font-size: var(--font-size-xs);
          height: 36px;
        }

        .btn--outline {
          background: transparent;
          border: 1px solid var(--color-border);
          color: var(--color-text-primary);
        }

        .btn--outline:hover {
          background: var(--color-bg-primary);
          border-color: var(--color-brand-soft);
        }

        /* MODAIS GERAIS */
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(20, 17, 15, 0.65);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }

        .modal-content {
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl);
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }

        .modal-content--product {
          max-width: 680px;
        }

        .modal-content--history {
          max-width: 680px;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--color-border);
        }

        .modal-header--history {
          align-items: flex-start;
        }

        .modal-eyebrow {
          font-size: var(--font-size-xs);
          color: var(--color-brand-primary);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 700;
          display: block;
          margin-bottom: 0.15rem;
        }

        .modal-title {
          font-size: var(--font-size-xl);
          color: var(--color-text-primary);
          font-weight: 700;
          margin: 0;
          letter-spacing: -0.01em;
        }

        .product-history-badges {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: 0.35rem;
        }

        .product-history-name {
          font-size: var(--font-size-sm);
          color: var(--color-text-primary);
        }

        .badge-tag {
          background: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          padding: 2px 8px;
          border-radius: var(--radius-full);
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          font-weight: 600;
        }

        .badge-tag--category {
          color: var(--color-brand-primary);
          border-color: var(--color-brand-soft);
        }

        .btn-close-modal {
          background: transparent;
          border: none;
          color: var(--color-text-secondary);
          width: 36px;
          height: 36px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-close-modal:hover {
          background: var(--color-bg-primary);
          color: var(--color-text-primary);
        }

        .modal-body {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .modal-body--polished {
          gap: 1.5rem;
        }

        .modal-body--history {
          gap: 1rem;
        }

        /* BARRA DE BALANÇO DO HISTÓRICO */
        .history-summary-strip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 0.85rem 1.25rem;
          gap: 1rem;
        }

        .history-summary-item {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .history-summary-label {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          font-weight: 600;
        }

        .history-summary-value {
          font-size: var(--font-size-lg);
          font-weight: 800;
        }

        .history-summary-divider {
          width: 1px;
          height: 32px;
          background: var(--color-border);
        }

        /* FILTROS DO HISTÓRICO */
        .history-filter-bar {
          display: flex;
          gap: 0.4rem;
          overflow-x: auto;
          padding-bottom: 0.25rem;
        }

        .btn-history-filter {
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          color: var(--color-text-secondary);
          padding: 0.35rem 0.75rem;
          font-size: var(--font-size-xs);
          font-weight: 700;
          border-radius: var(--radius-full);
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
        }

        .btn-history-filter:hover {
          border-color: var(--color-brand-soft);
          color: var(--color-brand-primary);
        }

        .btn-history-filter--active {
          background: var(--color-brand-primary);
          color: #FFF1E6;
          border-color: var(--color-brand-primary);
        }

        /* TIMELINE FEED */
        .timeline-container {
          position: relative;
          max-height: 420px;
          overflow-y: auto;
          padding-left: 1.5rem;
          padding-right: 0.5rem;
          padding-top: 0.5rem;
          padding-bottom: 0.5rem;
        }

        .timeline-track {
          position: absolute;
          left: 27px;
          top: 10px;
          bottom: 10px;
          width: 2px;
          background: var(--color-border);
        }

        .timeline-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .timeline-item {
          position: relative;
          display: flex;
          align-items: flex-start;
          gap: 1rem;
        }

        .timeline-node {
          width: 24px;
          height: 24px;
          border-radius: var(--radius-full);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          z-index: 1;
          margin-top: 0.4rem;
          font-weight: 800;
          font-size: 14px;
          border: 2px solid var(--color-bg-secondary);
        }

        .timeline-node--in {
          background: var(--color-success);
          color: #ffffff;
        }

        .timeline-node--out {
          background: var(--color-error);
          color: #ffffff;
        }

        .timeline-node--adjust {
          background: var(--color-warning);
          color: #ffffff;
        }

        .timeline-card {
          flex: 1;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 0.85rem 1.1rem;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          box-shadow: var(--shadow-sm);
          transition: border-color 0.2s ease;
        }

        .timeline-card:hover {
          border-color: var(--color-brand-soft);
        }

        .timeline-card__header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 0.75rem;
        }

        .timeline-card__title-line {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .timeline-type-pill {
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .timeline-type-pill--entry {
          color: var(--color-success);
        }

        .timeline-type-pill--sale {
          color: var(--color-brand-primary);
        }

        .timeline-type-pill--usage {
          color: var(--color-text-primary);
        }

        .timeline-type-pill--loss {
          color: var(--color-error);
        }

        .timeline-type-pill--adjust {
          color: var(--color-warning);
        }

        .timeline-date {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
        }

        .timeline-qty-badge {
          font-weight: 800;
          font-size: var(--font-size-sm);
          padding: 3px 8px;
          border-radius: var(--radius-sm);
          white-space: nowrap;
        }

        .timeline-qty-badge--in {
          background: var(--color-success-bg);
          color: var(--color-success);
        }

        .timeline-qty-badge--out {
          background: var(--color-error-bg);
          color: var(--color-error);
        }

        .timeline-qty-badge--adjust {
          background: var(--color-warning-bg);
          color: var(--color-warning);
        }

        .timeline-card__balance {
          display: flex;
          align-items: center;
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          padding-top: 0.35rem;
          border-top: 1px dashed var(--color-border);
        }

        .balance-indicator {
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }

        .balance-indicator strong {
          color: var(--color-text-primary);
        }

        .timeline-card__notes {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          font-style: italic;
          background: var(--color-bg-primary);
          padding: 0.35rem 0.65rem;
          border-radius: var(--radius-sm);
        }

        /* EMPTY STATE HISTÓRICO */
        .empty-state--history {
          padding: 3rem 1.5rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
        }

        .empty-state__icon {
          width: 56px;
          height: 56px;
          border-radius: var(--radius-full);
          background: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-brand-primary);
          margin-bottom: 0.25rem;
        }

        /* SELETOR DE CLASSIFICAÇÃO COM CARDS TÁTEIS */
        .form-section {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .form-section__label {
          font-size: var(--font-size-xs);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-secondary);
        }

        .form-section--card {
          background: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 1.25rem;
        }

        .product-type-selector {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.85rem;
        }

        .type-card {
          background: var(--color-bg-secondary);
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 1rem;
          display: flex;
          align-items: flex-start;
          gap: 0.85rem;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .type-card:hover {
          border-color: var(--color-brand-soft);
          background: var(--color-brand-lightest);
        }

        .type-card--active {
          border-color: var(--color-brand-primary);
          background: var(--color-brand-lightest);
          box-shadow: var(--shadow-sm);
        }

        .type-card__icon {
          width: 38px;
          height: 38px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .type-card__icon--retail {
          background: rgba(217, 108, 0, 0.12);
          color: var(--color-brand-primary);
        }

        .type-card__icon--internal {
          background: var(--color-success-bg);
          color: var(--color-success);
        }

        .type-card__info {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .type-card__title {
          font-size: var(--font-size-sm);
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .type-card__desc {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          line-height: 1.35;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .form-group label {
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .form-group .form-control {
          height: 42px;
          padding: 0 0.85rem;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border);
          background-color: var(--color-bg-secondary);
          color: var(--color-text-primary);
          font-size: var(--font-size-sm);
          outline: none;
          transition: all 0.2s ease;
        }

        .form-group .form-control:focus {
          border-color: var(--color-brand-primary);
          box-shadow: 0 0 0 3px rgba(217, 108, 0, 0.12);
        }

        .form-control--lg {
          height: 46px !important;
          font-size: var(--font-size-base) !important;
          font-weight: 500;
        }

        .form-group-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .form-group-row--3cols {
          grid-template-columns: 1fr 1fr 1fr;
        }

        .category-header-line {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .category-quick-hint {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
        }

        .quick-category-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          margin-top: 0.25rem;
        }

        .chip-btn {
          background: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          color: var(--color-text-secondary);
          font-size: var(--font-size-xs);
          font-weight: 600;
          padding: 0.25rem 0.65rem;
          border-radius: var(--radius-full);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .chip-btn:hover {
          border-color: var(--color-brand-soft);
          color: var(--color-brand-primary);
        }

        .chip-btn--active {
          background: var(--color-brand-primary);
          color: #FFF1E6;
          border-color: var(--color-brand-primary);
        }

        .currency-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .currency-prefix {
          position: absolute;
          left: 0.85rem;
          color: var(--color-text-secondary);
          font-weight: 700;
          font-size: var(--font-size-sm);
          pointer-events: none;
        }

        .currency-control {
          padding-left: 2.25rem !important;
          font-weight: 700;
          font-family: monospace;
          letter-spacing: 0.02em;
        }

        .margin-intelligence-card {
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 0.85rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .margin-intelligence-card--loss {
          border-color: rgba(240, 82, 82, 0.3);
          background: var(--color-error-bg);
        }

        .margin-intelligence-card__row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
        }

        .metric-item {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .metric-item__label {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          font-weight: 600;
        }

        .metric-item__value {
          font-size: var(--font-size-base);
          font-weight: 800;
        }

        .loss-warning-text {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          color: var(--color-error);
          font-size: var(--font-size-xs);
          font-weight: 700;
        }

        .input-group {
          display: flex;
          align-items: center;
          position: relative;
        }

        .input-group .form-control {
          width: 100%;
          padding-right: 2.5rem;
        }

        .input-group__suffix {
          position: absolute;
          right: 0.85rem;
          color: var(--color-text-secondary);
          font-weight: 700;
          font-size: var(--font-size-sm);
          pointer-events: none;
        }

        .comm-calc-hint {
          font-size: var(--font-size-xs);
          color: var(--color-brand-primary);
          font-weight: 600;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          padding-top: 0.75rem;
          border-top: 1px solid var(--color-border);
        }

        .btn--save-product {
          min-width: 160px;
        }

        .current-stock-callout {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.85rem 1.25rem;
          background: var(--color-brand-lightest);
          border: 1px solid var(--color-brand-soft);
          border-radius: var(--radius-md);
          color: var(--color-text-primary);
          font-size: var(--font-size-sm);
        }

        .loading-state,
        .empty-state {
          padding: 3rem 1.5rem;
          text-align: center;
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
        }

        /* Responsividade Mobile e Tablet */
        @media (max-width: 768px) {
          .products-controls-bar {
            flex-direction: column;
            align-items: stretch;
          }

          .search-input-wrapper {
            min-width: 100%;
          }

          .filter-group-container {
            width: 100%;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }

          .btn-filter {
            flex: 1;
            white-space: nowrap;
            text-align: center;
          }

          .btn-add-product {
            width: 100%;
          }

          .product-type-selector {
            grid-template-columns: 1fr;
          }

          .history-summary-strip {
            flex-direction: column;
            align-items: stretch;
            gap: 0.75rem;
          }

          .history-summary-divider {
            width: 100%;
            height: 1px;
          }
        }

        @media (max-width: 640px) {
          .form-group-row,
          .form-group-row--3cols {
            grid-template-columns: 1fr;
            gap: 1rem;
          }

          .stat-cards-grid {
            grid-template-columns: 1fr 1fr;
            gap: 0.75rem;
          }

          .stat-card {
            padding: 1rem;
          }

          .stat-card__number {
            font-size: var(--font-size-2xl);
          }

          .modal-body {
            padding: 1rem;
          }

          .margin-intelligence-card__row {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }

          .modal-footer {
            flex-direction: column-reverse;
          }

          .modal-footer .btn {
            width: 100%;
          }

          .timeline-container {
            padding-left: 1rem;
            padding-right: 0;
          }

          .timeline-track {
            left: 19px;
          }
        }

        @media (max-width: 440px) {
          .stat-cards-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};
