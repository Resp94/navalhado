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

import {
  StatCard,
  SearchInput,
  SegmentedControl,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  Button,
  IconButton,
  EmptyState,
  EmptyBoxIllustration,
  Select,
} from '../../components/ui';

// Ícones Oficiais Hugeicons
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
    const prefersReducedMotion =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;
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
    if (m.movement_type === 'entry_manual' || m.movement_type === 'entry_purchase' || m.movement_type === 'entry_reversal') return true;
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
      case 'entry_reversal':
        return { label: 'Estorno de reabertura de comanda', category: 'entry', isPositive: true };
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
    <div className="flex flex-col gap-6 w-full animate-[slideUp_0.3s_cubic-bezier(0.16,1,0.3,1)]">
      {/* 1. ESTATÍSTICAS DO ESTOQUE */}
      <section
        className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-5 max-[640px]:grid-cols-2 max-[640px]:gap-3 max-[440px]:grid-cols-1"
        aria-label="Estatísticas gerais de produtos e estoque"
      >
        <StatCard
          title="Total no catálogo"
          value={stats.total}
          subtext="Itens cadastrados"
          className="stat-card"
        />
        <StatCard
          title="Venda no balcão"
          value={<span className="text-brand">{stats.retailCount}</span>}
          subtext="Pomadas, óleos e varejo"
          className="stat-card"
        />
        <StatCard
          title="Insumos de bancada"
          value={stats.internalCount}
          subtext="Lâminas, golas e toalhas"
          className="stat-card"
        />
        <StatCard
          title="Reposição necessária"
          value={
            <span className={stats.lowStockCount > 0 ? 'text-error' : 'text-success'}>
              {stats.lowStockCount}
            </span>
          }
          subtext="Itens abaixo do mínimo"
          className="stat-card"
        />
      </section>

      {/* 2. BARRA DE CONTROLES E BUSCA */}
      <div className="flex items-center gap-4 flex-wrap max-[768px]:flex-col max-[768px]:flex-nowrap max-[768px]:items-stretch">
        <div className="flex-1 min-w-0 md:min-w-[260px]">
          <SearchInput
            placeholder="Buscar por nome, marca ou categoria..."
            aria-label="Buscar produtos por nome, marca ou categoria"
            value={searchTerm}
            onChange={setSearchTerm}
          />
        </div>

        <SegmentedControl<'all' | 'retail' | 'internal_use' | 'low_stock'>
          aria-label="Filtrar por tipo de produto"
          fullWidth={false}
          value={filterType}
          onChange={setFilterType}
          options={[
            { id: 'all', label: 'Todos', count: products.length },
            { id: 'retail', label: 'Venda no balcão', count: stats.retailCount },
            { id: 'internal_use', label: 'Insumos', count: stats.internalCount },
            { id: 'low_stock', label: 'Estoque baixo', count: stats.lowStockCount },
          ]}
        />

        <Button
          type="button"
          variant="primary"
          onClick={() => handleOpenModal(null)}
          className="max-[768px]:w-full"
          icon={<PlusIcon />}
        >
          Novo produto
        </Button>
      </div>

      {/* 3. TABELA DE PRODUTOS */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 gap-3 text-text-secondary text-sm">
          <div className="spinner mb-2" />
          <p>Carregando catálogo de produtos...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          title="Nenhum produto encontrado"
          description={products.length > 0 ? "Nenhum produto encontrado para os filtros selecionados." : undefined}
          illustration={products.length === 0 ? <EmptyBoxIllustration size={130} /> : undefined}
        />
      ) : (
        <Table className="shadow-glass">
          <caption className="sr-only">Lista de produtos cadastrados e seus níveis de estoque</caption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Produto e marca</TableHead>
              <TableHead scope="col">Finalidade de uso</TableHead>
              <TableHead scope="col">Categoria</TableHead>
              <TableHead scope="col">Preço de venda</TableHead>
              <TableHead scope="col">Estoque atual</TableHead>
              <TableHead scope="col" className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.map((p) => {
              const isLowStock = p.stock_quantity <= p.min_stock_alert;
              return (
                <TableRow key={p.id} className={`product-row ${isLowStock ? 'bg-[rgba(239,68,68,0.04)]' : ''}`}>
                  <TableCell>
                    <div className="flex flex-col gap-[0.2rem]">
                      <strong className="text-text-primary font-semibold">{p.name}</strong>
                      {p.brand && <span className="text-xs text-text-secondary font-semibold">{p.brand}</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {p.product_type === 'retail' ? (
                      <Badge variant="brand">Venda no balcão</Badge>
                    ) : (
                      <Badge variant="success">Insumo de bancada</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-text-primary">{p.category || 'Geral'}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-[0.15rem]">
                      <strong className="font-mono text-brand">
                        R$ {p.price.toFixed(2).replace('.', ',')}
                      </strong>
                      {p.cost_price > 0 && (
                        <span className="text-xs text-text-secondary">
                          Custo: R$ {p.cost_price.toFixed(2).replace('.', ',')}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-[0.2rem]">
                      <Badge
                        variant={isLowStock ? 'error' : 'neutral'}
                        icon={isLowStock ? <AlertTriangleIcon /> : undefined}
                      >
                        <strong>{p.stock_quantity}</strong> {p.unit_type}
                      </Badge>
                      {isLowStock && (
                        <span className="text-xs text-error font-semibold">Mínimo: {p.min_stock_alert}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => handleOpenAdjustModal(p)}
                        title={`Ajustar quantidade em estoque de ${p.name}`}
                        aria-label={`Ajustar estoque de ${p.name}`}
                      >
                        Ajustar estoque
                      </Button>
                      <IconButton
                        icon={<HistoryIcon />}
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenHistoryModal(p)}
                        title={`Histórico de movimentações de ${p.name}`}
                        aria-label={`Ver histórico de movimentações de ${p.name}`}
                      />
                      <IconButton
                        icon={<EditIcon />}
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenModal(p)}
                        title={`Editar produto ${p.name}`}
                        aria-label={`Editar produto ${p.name}`}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* 4. MODAL POLIDO DE CADASTRO/EDIÇÃO DE PRODUTO */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-[rgba(20,17,15,0.65)] backdrop-blur-md flex items-center justify-center z-[1000] p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
          role="presentation"
        >
          <div
            className="bg-bg-secondary border border-border rounded-xl w-full max-h-[90dvh] overflow-y-auto flex flex-col max-w-[680px] shadow-xl animate-spring"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-product-title"
          >
            <header className="flex justify-between items-center px-6 py-5 border-b border-border">
              <div>
                <h3 id="modal-product-title" className="text-xl text-text-primary font-bold m-0 tracking-[-0.01em]">
                  {editingProduct ? `Editar: ${editingProduct.name}` : 'Cadastrar novo produto'}
                </h3>
              </div>
              <IconButton
                icon={<CloseIcon />}
                variant="ghost"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                aria-label="Fechar janela"
              />
            </header>

            <form onSubmit={handleSaveSubmit} className="p-6 flex flex-col gap-6">
              {/* SELETOR DE CLASSIFICAÇÃO COM CARDS TÁTEIS */}
              <div className="flex flex-col gap-[0.85rem]">
                <span className="text-xs font-bold uppercase tracking-[0.05em] text-text-primary">Finalidade de uso</span>
                <div className="grid grid-cols-2 gap-[0.85rem] max-[768px]:grid-cols-1" role="radiogroup" aria-label="Finalidade de uso do produto">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={formData.product_type === 'retail'}
                    className={`group bg-bg-secondary rounded-lg p-4 flex items-start gap-[0.85rem] cursor-pointer text-left transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-2 ${
                      formData.product_type === 'retail'
                        ? 'shadow-[0_0_0_1.5px_var(--color-brand-hover)] hover:bg-brand-lightest hover:shadow-[0_0_0_1.8px_var(--color-brand-hover),0_4px_14px_rgba(217,108,0,0.12)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[0_0_0_1.5px_var(--color-brand-hover)]'
                        : 'shadow-[0_0_0_0.5px_var(--color-text-primary)] hover:bg-brand-lightest hover:shadow-[0_0_0_0.8px_var(--color-text-primary),0_4px_12px_rgba(45,35,30,0.06)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[0_0_0_0.8px_var(--color-text-primary)]'
                    }`}
                    onClick={() => setFormData({ ...formData, product_type: 'retail' })}
                  >
                    <div
                      className={`w-[38px] h-[38px] rounded-md flex items-center justify-center shrink-0 bg-transparent text-text-primary transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                        formData.product_type === 'retail'
                          ? 'shadow-[0_0_0_0.5px_var(--color-text-primary)] group-hover:shadow-[0_0_0_1px_var(--color-brand-hover)] group-hover:scale-105'
                          : 'shadow-[0_0_0_0.5px_var(--color-text-primary)] group-hover:shadow-[0_0_0_0.8px_var(--color-text-primary)] group-hover:scale-105'
                      }`}
                    >
                      <ShoppingBagIcon />
                    </div>
                    <div className="flex flex-col gap-[0.2rem]">
                      <strong className="text-sm font-bold text-text-primary">Venda no balcão</strong>
                      <span className="text-xs text-text-primary leading-[1.35]">Produtos comercializados aos clientes, como pomadas, óleos e ceras</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    role="radio"
                    aria-checked={formData.product_type === 'internal_use'}
                    className={`group bg-bg-secondary rounded-lg p-4 flex items-start gap-[0.85rem] cursor-pointer text-left transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-2 ${
                      formData.product_type === 'internal_use'
                        ? 'shadow-[0_0_0_1.5px_var(--color-brand-hover)] hover:bg-brand-lightest hover:shadow-[0_0_0_1.8px_var(--color-brand-hover),0_4px_14px_rgba(217,108,0,0.12)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[0_0_0_1.5px_var(--color-brand-hover)]'
                        : 'shadow-[0_0_0_0.5px_var(--color-text-primary)] hover:bg-brand-lightest hover:shadow-[0_0_0_0.8px_var(--color-text-primary),0_4px_12px_rgba(45,35,30,0.06)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[0_0_0_0.8px_var(--color-text-primary)]'
                    }`}
                    onClick={() => setFormData({ ...formData, product_type: 'internal_use' })}
                  >
                    <div
                      className={`w-[38px] h-[38px] rounded-md flex items-center justify-center shrink-0 bg-transparent text-text-primary transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                        formData.product_type === 'internal_use'
                          ? 'shadow-[0_0_0_0.5px_var(--color-text-primary)] group-hover:shadow-[0_0_0_1px_var(--color-brand-hover)] group-hover:scale-105'
                          : 'shadow-[0_0_0_0.5px_var(--color-text-primary)] group-hover:shadow-[0_0_0_0.8px_var(--color-text-primary)] group-hover:scale-105'
                      }`}
                    >
                      <ScissorsIcon />
                    </div>
                    <div className="flex flex-col gap-[0.2rem]">
                      <strong className="text-sm font-bold text-text-primary">Insumo de bancada</strong>
                      <span className="text-xs text-text-primary leading-[1.35]">Materiais consumidos nos atendimentos, como lâminas, toalhas e golas</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* SEÇÃO DE IDENTIFICAÇÃO DO PRODUTO */}
              <div className="flex flex-col gap-[0.85rem]">
                <div className="flex flex-col gap-[0.4rem]">
                  <label htmlFor="prod-name" className="text-xs font-bold text-text-primary">Nome do produto *</label>
                  <input
                    id="prod-name"
                    type="text"
                    required
                    autoFocus
                    placeholder="Ex: Pomada modeladora efeito matte 100g"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="h-[46px] px-[0.85rem] rounded-md border-none shadow-[0_0_0_0.8px_var(--color-text-primary)] bg-bg-secondary text-text-primary text-base font-medium outline-none transition-all duration-200 ease focus:shadow-[0_0_0_1.5px_var(--color-text-primary)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
                  <div className="flex flex-col gap-[0.4rem]">
                    <label htmlFor="prod-brand" className="text-xs font-bold text-text-primary">Marca ou fabricante</label>
                    <input
                      id="prod-brand"
                      type="text"
                      placeholder="Ex: Baboon, Fox For Men, Marca própria"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      className="h-[42px] px-[0.85rem] rounded-md border-none shadow-[0_0_0_0.8px_var(--color-text-primary)] bg-bg-secondary text-text-primary text-sm outline-none transition-all duration-200 ease focus:shadow-[0_0_0_1.5px_var(--color-text-primary)]"
                    />
                  </div>
                  <Select
                    label="Unidade de medida"
                    id="unit-type-select"
                    value={formData.unit_type}
                    onChange={(e) => setFormData({ ...formData, unit_type: e.target.value })}
                  >
                    <option value="un">Unidade (un)</option>
                    <option value="cx">Caixa (cx)</option>
                    <option value="pct">Pacote (pct)</option>
                    <option value="ml">Mililitros (ml)</option>
                    <option value="lt">Litros (l)</option>
                    <option value="kg">Quilos (kg)</option>
                  </Select>
                </div>

                {/* CATEGORIA COM CHIPS DE ESCOLHA RÁPIDA */}
                <div className="flex flex-col gap-[0.4rem]">
                  <div className="flex justify-between items-center">
                    <label htmlFor="prod-category" className="text-xs font-bold text-text-primary">Categoria</label>
                    <span className="text-xs text-text-primary">Sugestões rápidas:</span>
                  </div>
                  <input
                    id="prod-category"
                    type="text"
                    placeholder="Ex: Finalizadores, Barba, Higiene"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="h-[42px] px-[0.85rem] rounded-md border-none shadow-[0_0_0_0.8px_var(--color-text-primary)] bg-bg-secondary text-text-primary text-sm outline-none transition-all duration-200 ease focus:shadow-[0_0_0_1.5px_var(--color-text-primary)]"
                  />
                  <div className="flex flex-wrap gap-[0.4rem] mt-1" role="group" aria-label="Sugestões de categoria">
                    {QUICK_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        className={
                          formData.category === cat
                            ? 'bg-brand-lightest text-brand-deep shadow-[0_0_0_0.8px_var(--color-brand-primary)] font-extrabold text-xs px-3 py-[0.35rem] min-h-[32px] rounded-full cursor-pointer transition-all duration-150 ease focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-2'
                            : 'bg-bg-secondary shadow-[0_0_0_0.8px_var(--color-text-primary)] text-text-primary text-xs font-semibold px-3 py-[0.35rem] min-h-[32px] rounded-full cursor-pointer transition-all duration-150 ease hover:shadow-[0_0_0_1.2px_var(--color-text-primary)] hover:bg-brand-lightest focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-2'
                        }
                        onClick={() => setFormData({ ...formData, category: cat })}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* SEÇÃO FINANCEIRA E MARGEM EM TEMPO REAL */}
              <div className="flex flex-col gap-[0.85rem] bg-transparent shadow-[0_0_0_0.8px_var(--color-text-primary)] rounded-lg p-5">
                <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
                  <div className="flex flex-col gap-[0.4rem]">
                    <label htmlFor="cost-price-input" className="text-xs font-bold text-text-primary">Preço de custo unitário</label>
                    <div className="relative flex items-center">
                      <span className="absolute left-[0.85rem] text-text-secondary font-bold text-sm pointer-events-none">R$</span>
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
                        className="h-[42px] pl-9 pr-[0.85rem] rounded-md border-none shadow-[0_0_0_0.8px_var(--color-text-primary)] bg-bg-secondary text-text-primary text-sm font-bold font-mono tracking-[0.02em] outline-none transition-all duration-200 ease focus:shadow-[0_0_0_1.5px_var(--color-text-primary)]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-[0.4rem]">
                    <label htmlFor="price-input" className="text-xs font-bold text-text-primary">
                      Preço de venda ao cliente {formData.product_type === 'retail' ? '*' : '(opcional)'}
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-[0.85rem] text-text-secondary font-bold text-sm pointer-events-none">R$</span>
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
                        className="h-[42px] pl-9 pr-[0.85rem] rounded-md border-none shadow-[0_0_0_0.8px_var(--color-text-primary)] bg-bg-secondary text-text-primary text-sm font-bold font-mono tracking-[0.02em] outline-none transition-all duration-200 ease focus:shadow-[0_0_0_1.5px_var(--color-text-primary)]"
                      />
                    </div>
                  </div>
                </div>

                {/* PAINEL DE INTELIGÊNCIA FINANCEIRA (MARGEM E LUCRO) */}
                {financialMetrics.hasData && (
                  <div
                    className={`flex flex-col gap-2 rounded-md px-4 py-[0.85rem] ${
                      financialMetrics.isLoss
                        ? 'border border-[rgba(240,82,82,0.3)] bg-error-bg'
                        : 'bg-bg-secondary border border-border'
                    }`}
                  >
                    <div className="flex justify-between items-center gap-4 max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-2">
                      <div className="flex flex-col gap-[0.15rem]">
                        <span className="text-xs text-text-secondary font-semibold">Lucro bruto por unidade</span>
                        <strong className={`text-base font-extrabold ${financialMetrics.profit >= 0 ? 'text-success' : 'text-error'}`}>
                          R$ {financialMetrics.profit.toFixed(2).replace('.', ',')}
                        </strong>
                      </div>
                      <div className="flex flex-col gap-[0.15rem]">
                        <span className="text-xs text-text-secondary font-semibold">Margem sobre a venda</span>
                        <strong className={`text-base font-extrabold ${financialMetrics.marginPct >= 0 ? 'text-brand' : 'text-error'}`}>
                          {financialMetrics.marginPct.toFixed(1)}%
                        </strong>
                      </div>
                      <div className="flex flex-col gap-[0.15rem]">
                        <span className="text-xs text-text-secondary font-semibold">Markup sobre o custo</span>
                        <strong className="text-base font-extrabold">
                          {financialMetrics.markupPct > 0 ? `+${financialMetrics.markupPct.toFixed(0)}%` : 'Sem custo base'}
                        </strong>
                      </div>
                    </div>
                    {financialMetrics.isLoss && (
                      <span className="flex items-center gap-[0.35rem] text-error text-xs font-bold">
                        <AlertTriangleIcon /> O preço de venda informado é menor que o custo de compra.
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* SEÇÃO DE ESTOQUE E COMISSÕES */}
              <div className="flex flex-col gap-[0.85rem]">
                <div className="grid grid-cols-3 gap-4 max-[640px]:grid-cols-1">
                  <div className="flex flex-col gap-[0.4rem]">
                    <label htmlFor="stock-qty-input" className="text-xs font-bold text-text-primary">
                      {editingProduct ? 'Estoque atual' : 'Estoque inicial'}
                    </label>
                    <div className="flex items-center relative">
                      <input
                        id="stock-qty-input"
                        type="number"
                        min="0"
                        value={formData.stock_quantity}
                        onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                        className="w-full h-[42px] pl-[0.85rem] pr-10 rounded-md border-none shadow-[0_0_0_0.8px_var(--color-text-primary)] bg-bg-secondary text-text-primary text-sm outline-none transition-all duration-200 ease focus:shadow-[0_0_0_1.5px_var(--color-text-primary)]"
                      />
                      <span className="absolute right-[0.85rem] text-text-secondary font-bold text-sm pointer-events-none">{formData.unit_type}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-[0.4rem]">
                    <label htmlFor="min-stock-input" className="text-xs font-bold text-text-primary">Alerta de estoque mínimo</label>
                    <div className="flex items-center relative">
                      <input
                        id="min-stock-input"
                        type="number"
                        min="1"
                        value={formData.min_stock_alert}
                        onChange={(e) => setFormData({ ...formData, min_stock_alert: e.target.value })}
                        className="w-full h-[42px] pl-[0.85rem] pr-10 rounded-md border-none shadow-[0_0_0_0.8px_var(--color-text-primary)] bg-bg-secondary text-text-primary text-sm outline-none transition-all duration-200 ease focus:shadow-[0_0_0_1.5px_var(--color-text-primary)]"
                      />
                      <span className="absolute right-[0.85rem] text-text-secondary font-bold text-sm pointer-events-none">{formData.unit_type}</span>
                    </div>
                  </div>

                  {formData.product_type === 'retail' && (
                    <div className="flex flex-col gap-[0.4rem]">
                      <label htmlFor="prod-comm-input" className="text-xs font-bold text-text-primary">Comissão do barbeiro</label>
                      <div className="flex items-center relative">
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
                          className="w-full h-[42px] pl-[0.85rem] pr-10 rounded-md border-none shadow-[0_0_0_0.8px_var(--color-text-primary)] bg-bg-secondary text-text-primary text-sm outline-none transition-all duration-200 ease focus:shadow-[0_0_0_1.5px_var(--color-text-primary)]"
                        />
                        <span className="absolute right-[0.85rem] text-text-secondary font-bold text-sm pointer-events-none">%</span>
                      </div>
                      {financialMetrics.commValue > 0 && (
                        <span className="text-xs text-brand-primary font-semibold">
                          R$ {financialMetrics.commValue.toFixed(2).replace('.', ',')} por unidade vendida
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <footer className="flex justify-end gap-3 pt-3 border-t border-border max-[640px]:flex-col-reverse">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={saving}
                  className="min-w-[160px]"
                >
                  {editingProduct ? 'Salvar alterações' : 'Cadastrar produto'}
                </Button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL DE AJUSTE RÁPIDO DE ESTOQUE */}
      {isAdjustModalOpen && adjustProduct && (
        <div
          className="fixed inset-0 bg-[rgba(20,17,15,0.65)] backdrop-blur-md flex items-center justify-center z-[1000] p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAdjustModalOpen(false);
          }}
          role="presentation"
        >
          <div
            className="bg-bg-secondary border border-border rounded-xl w-full max-h-[90dvh] overflow-y-auto flex flex-col max-w-[480px] shadow-xl animate-spring"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-adjust-title"
          >
            <header className="flex justify-between items-center px-6 py-5 border-b border-border">
              <div>
                <span className="block text-xs text-brand-primary uppercase tracking-[0.06em] font-bold mb-[0.15rem]">Movimentação de estoque</span>
                <h3 id="modal-adjust-title" className="text-xl text-text-primary font-bold m-0 tracking-[-0.01em]">
                  Ajustar: {adjustProduct.name}
                </h3>
              </div>
              <IconButton
                icon={<CloseIcon />}
                variant="ghost"
                size="sm"
                onClick={() => setIsAdjustModalOpen(false)}
                aria-label="Fechar janela"
              />
            </header>

            <form onSubmit={handleAdjustSubmit} className="p-6 flex flex-col gap-5">
              <div className="card flex justify-between items-center px-5 py-[0.85rem] bg-brand-lightest border border-brand-soft rounded-md text-text-primary text-sm">
                <span>Saldo atual em estoque:</span>
                <strong className="font-mono text-lg text-brand">
                  {adjustProduct.stock_quantity} {adjustProduct.unit_type}
                </strong>
              </div>

              <Select
                label="Tipo de movimentação"
                id="mov-type-select"
                value={adjustData.movementType}
                onChange={(e) =>
                  setAdjustData({ ...adjustData, movementType: e.target.value as MovementType })
                }
              >
                <option value="entry_purchase">Entrada por compra de fornecedor (+)</option>
                <option value="entry_manual">Entrada manual avulsa (+)</option>
                <option value="exit_internal_use">Saída por consumo em bancada (-)</option>
                <option value="exit_manual">Saída por avaria, perda ou validade (-)</option>
                <option value="adjustment">Ajuste por contagem de inventário (±)</option>
              </Select>

              <div className="flex flex-col gap-[0.4rem]">
                <label htmlFor="qty-change-input" className="text-xs font-bold text-text-primary">
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
                  className="h-[42px] px-[0.85rem] rounded-md border-none shadow-[0_0_0_0.8px_var(--color-text-primary)] bg-bg-secondary text-text-primary text-sm outline-none transition-all duration-200 ease focus:shadow-[0_0_0_1.5px_var(--color-text-primary)]"
                />
              </div>

              <div className="flex flex-col gap-[0.4rem]">
                <label htmlFor="adjust-notes" className="text-xs font-bold text-text-primary">Motivo ou justificativa da operação</label>
                <input
                  id="adjust-notes"
                  type="text"
                  placeholder="Ex: Nota fiscal 1234, reposição semanal, frasco quebrado"
                  value={adjustData.notes}
                  onChange={(e) => setAdjustData({ ...adjustData, notes: e.target.value })}
                  className="h-[42px] px-[0.85rem] rounded-md border-none shadow-[0_0_0_0.8px_var(--color-text-primary)] bg-bg-secondary text-text-primary text-sm outline-none transition-all duration-200 ease focus:shadow-[0_0_0_1.5px_var(--color-text-primary)]"
                />
              </div>

              <footer className="flex justify-end gap-3 pt-3 border-t border-border max-[640px]:flex-col-reverse">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAdjustModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" loading={saving}>
                  Confirmar movimentação
                </Button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL POLIDO DE HISTÓRICO DE MOVIMENTAÇÕES (TIMELINE DE AUDITORIA) */}
      {isHistoryModalOpen && historyProduct && (
        <div
          className="fixed inset-0 bg-[rgba(20,17,15,0.65)] backdrop-blur-md flex items-center justify-center z-[1000] p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsHistoryModalOpen(false);
          }}
          role="presentation"
        >
          <div
            className="bg-bg-secondary border border-border rounded-xl w-full max-h-[90dvh] overflow-y-auto flex flex-col max-w-[680px] shadow-xl animate-spring"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-history-title"
          >
            {/* CABEÇALHO DO MODAL COM RESUMO DO PRODUTO */}
            <header className="flex justify-between items-start px-6 py-5 border-b border-border">
              <div>
                <span className="block text-xs text-brand-primary uppercase tracking-[0.06em] font-bold mb-[0.15rem]">Auditoria de estoque</span>
                <h3 id="modal-history-title" className="text-xl text-text-primary font-bold m-0 tracking-[-0.01em]">
                  Histórico de movimentações
                </h3>
                <div className="flex items-center flex-wrap gap-2 mt-[0.35rem]">
                  <strong className="text-sm text-text-primary">{historyProduct.name}</strong>
                  {historyProduct.brand && (
                    <span className="bg-bg-primary border border-border px-2 py-0.5 rounded-full text-xs text-text-secondary font-semibold">{historyProduct.brand}</span>
                  )}
                  <span className="bg-bg-primary border border-brand-soft px-2 py-0.5 rounded-full text-xs text-brand-primary font-semibold">
                    {historyProduct.category || 'Geral'}
                  </span>
                </div>
              </div>
              <IconButton
                icon={<CloseIcon />}
                variant="ghost"
                size="sm"
                onClick={() => setIsHistoryModalOpen(false)}
                aria-label="Fechar janela"
              />
            </header>

            <div className="p-6 flex flex-col gap-4">
              {/* CARD DE BALANÇO RÁPIDO DO PRODUTO */}
              <div className="flex items-center justify-between bg-bg-primary border border-border rounded-lg px-5 py-[0.85rem] gap-4">
                <div className="flex flex-col gap-[0.15rem]">
                  <span className="text-xs text-text-secondary font-semibold">Estoque atual</span>
                  <strong className={`text-lg font-extrabold ${historyProduct.stock_quantity <= historyProduct.min_stock_alert ? 'text-error' : 'text-brand'}`}>
                    {historyProduct.stock_quantity} {historyProduct.unit_type}
                  </strong>
                </div>
                <div className="w-px h-8 bg-border max-[768px]:w-full max-[768px]:h-px" />
                <div className="flex flex-col gap-[0.15rem]">
                  <span className="text-xs text-text-secondary font-semibold">Total de entradas</span>
                  <strong className="text-lg font-extrabold text-success">
                    +{movementStats.totalIn} {historyProduct.unit_type}
                  </strong>
                </div>
                <div className="w-px h-8 bg-border max-[768px]:w-full max-[768px]:h-px" />
                <div className="flex flex-col gap-[0.15rem]">
                  <span className="text-xs text-text-secondary font-semibold">Total de saídas</span>
                  <strong className="text-lg font-extrabold text-error">
                    -{movementStats.totalOut} {historyProduct.unit_type}
                  </strong>
                </div>
              </div>

              {/* FILTROS DA TIMELINE */}
              <div className="flex gap-[0.4rem] overflow-x-auto pb-1" role="group" aria-label="Filtrar movimentações">
                <button
                  type="button"
                  onClick={() => setHistoryFilter('all')}
                  className={`px-3 py-[0.35rem] text-xs font-bold rounded-full cursor-pointer transition-all duration-150 ease whitespace-nowrap ${
                    historyFilter === 'all'
                      ? 'bg-brand-primary text-brand-lightest border border-brand-primary'
                      : 'bg-bg-secondary border border-border text-text-secondary hover:border-brand-soft hover:text-brand-primary'
                  }`}
                  aria-pressed={historyFilter === 'all'}
                >
                  Todas ({movements.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFilter('entries')}
                  className={`px-3 py-[0.35rem] text-xs font-bold rounded-full cursor-pointer transition-all duration-150 ease whitespace-nowrap ${
                    historyFilter === 'entries'
                      ? 'bg-brand-primary text-brand-lightest border border-brand-primary'
                      : 'bg-bg-secondary border border-border text-text-secondary hover:border-brand-soft hover:text-brand-primary'
                  }`}
                  aria-pressed={historyFilter === 'entries'}
                >
                  Entradas ({movementStats.entriesCount})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFilter('exits')}
                  className={`px-3 py-[0.35rem] text-xs font-bold rounded-full cursor-pointer transition-all duration-150 ease whitespace-nowrap ${
                    historyFilter === 'exits'
                      ? 'bg-brand-primary text-brand-lightest border border-brand-primary'
                      : 'bg-bg-secondary border border-border text-text-secondary hover:border-brand-soft hover:text-brand-primary'
                  }`}
                  aria-pressed={historyFilter === 'exits'}
                >
                  Saídas ({movementStats.exitsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFilter('adjustments')}
                  className={`px-3 py-[0.35rem] text-xs font-bold rounded-full cursor-pointer transition-all duration-150 ease whitespace-nowrap ${
                    historyFilter === 'adjustments'
                      ? 'bg-brand-primary text-brand-lightest border border-brand-primary'
                      : 'bg-bg-secondary border border-border text-text-secondary hover:border-brand-soft hover:text-brand-primary'
                  }`}
                  aria-pressed={historyFilter === 'adjustments'}
                >
                  Ajustes ({movementStats.adjustmentsCount})
                </button>
              </div>

              {/* FEED DA TIMELINE DE MOVIMENTAÇÕES */}
              {loadingMovements ? (
                <div className="flex flex-col items-center justify-center py-4 px-4 gap-3 text-text-secondary text-sm">
                  <div className="spinner mb-2" />
                  <p>Carregando histórico de movimentações...</p>
                </div>
              ) : filteredMovements.length === 0 ? (
                <EmptyState
                  title="Nenhuma movimentação encontrada"
                  description={
                    historyFilter !== 'all'
                      ? 'Nenhum registro localizado para a categoria selecionada.'
                      : 'As compras de fornecedor, vendas em comanda e baixas de bancada aparecerão aqui.'
                  }
                />
              ) : (
                <div className="relative max-h-[420px] overflow-y-auto pl-6 pr-2 pt-2 pb-2 max-[640px]:pl-4 max-[640px]:pr-0">
                  <div className="absolute left-[27px] top-[10px] bottom-[10px] w-0.5 bg-border max-[640px]:left-[19px]" />
                  <div className="flex flex-col gap-4">
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
                      const nodeColorClass = isAdjustment
                        ? 'bg-warning text-white'
                        : isEntry
                        ? 'bg-success text-white'
                        : 'bg-error text-white';
                      const pillColorClass =
                        info.category === 'entry'
                          ? 'text-success'
                          : info.category === 'sale'
                          ? 'text-brand-primary'
                          : info.category === 'loss'
                          ? 'text-error'
                          : info.category === 'adjust'
                          ? 'text-warning'
                          : 'text-text-primary';
                      const qtyBadgeColorClass = isAdjustment
                        ? 'bg-warning-bg text-warning'
                        : isEntry
                        ? 'bg-success-bg text-success'
                        : 'bg-error-bg text-error';

                      return (
                        <div key={mov.id} className="relative flex items-start gap-4">
                          {/* NÓ VISUAL CONECTADO À LINHA */}
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-[1] mt-[0.4rem] font-extrabold text-sm border-2 border-bg-secondary ${nodeColorClass}`}
                          >
                            <span>
                              {isAdjustment ? '±' : isEntry ? '+' : '-'}
                            </span>
                          </div>

                          {/* CARD DE DETALHES DA MOVIMENTAÇÃO */}
                          <div className="flex-1 bg-bg-secondary border border-border rounded-lg px-[1.1rem] py-[0.85rem] flex flex-col gap-[0.4rem] shadow-sm transition-colors duration-200 ease hover:border-brand-soft">
                            <div className="flex justify-between items-start gap-3">
                              <div className="flex flex-col gap-[0.15rem]">
                                <span className={`text-xs font-bold ${pillColorClass}`}>
                                  {info.label}
                                </span>
                                <span className="text-xs text-text-secondary">{formattedDate}</span>
                              </div>

                              {/* VARIAÇÃO NUMÉRICA EM DESTAQUE */}
                              <span
                                className={`font-extrabold text-sm px-2 py-[3px] rounded-sm whitespace-nowrap ${qtyBadgeColorClass}`}
                              >
                                {isAdjustment ? `${rawQty}` : isEntry ? `+${rawQty}` : `-${rawQty}`}{' '}
                                {historyProduct.unit_type}
                              </span>
                            </div>

                            {/* SALDO RESULTANTE */}
                            <div className="flex items-center text-xs text-text-secondary pt-[0.35rem] border-t border-dashed border-border">
                              {mov.new_stock_level !== null && mov.new_stock_level !== undefined ? (
                                <span className="flex items-center gap-[0.35rem]">
                                  Saldo após esta operação <ArrowRightIcon /> <strong className="text-text-primary">{mov.new_stock_level} {historyProduct.unit_type}</strong>
                                </span>
                              ) : (
                                <span className="flex items-center gap-[0.35rem]">
                                  Registro auditado no estoque
                                </span>
                              )}
                            </div>

                            {/* NOTAS E JUSTIFICATIVAS */}
                            {noteText && (
                              <div className="flex items-center gap-[0.4rem] text-xs text-text-secondary italic bg-bg-primary px-[0.65rem] py-[0.35rem] rounded-sm">
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

              <footer className="flex justify-end gap-3 pt-3 border-t border-border max-[640px]:flex-col-reverse">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsHistoryModalOpen(false)}
                >
                  Fechar histórico
                </Button>
              </footer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
