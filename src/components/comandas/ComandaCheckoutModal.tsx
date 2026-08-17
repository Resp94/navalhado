import React, { useEffect, useMemo, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Delete02Icon,
  ScissorIcon,
  ShoppingBag01Icon,
} from '@hugeicons/core-free-icons';
import { ComandaRepository } from '../../modules/comandas/ComandaRepository';
import { SupabaseComandaAdapter } from '../../modules/comandas/adapters/SupabaseComandaAdapter';
import { CaixaRepository } from '../../modules/caixa/CaixaRepository';
import { SupabaseCaixaAdapter } from '../../modules/caixa/adapters/SupabaseCaixaAdapter';
import { ProdutoRepository } from '../../modules/produtos/ProdutoRepository';
import { SupabaseProdutoAdapter } from '../../modules/produtos/adapters/SupabaseProdutoAdapter';
import { AberturaAssistidaCaixaModal } from '../caixa/AberturaAssistidaCaixaModal';
import type {
  Comanda,
  MetodoPagamento,
} from '../../modules/comandas/types';
import type { Product } from '../../modules/produtos/types';
import type { CashSession } from '../../modules/caixa/types';

interface ServiceOption {
  id: string;
  name: string;
  price: number;
}

interface ProfessionalOption {
  id: string;
  name: string;
}

interface ComandaCheckoutModalProps {
  isOpen: boolean;
  tenantId: string;
  appointmentId?: string | null;
  customerId?: string | null;
  customerName: string;
  customerPhone?: string | null;
  initialServices?: Array<{
    service_id: string;
    name: string;
    price: number;
    professional_id: string;
  }>;
  availableServices?: ServiceOption[];
  availableProfessionals?: ProfessionalOption[];
  onClose: () => void;
  onFinalizado: (comanda: Comanda) => void;
  comandaRepo?: ComandaRepository;
  caixaRepo?: CaixaRepository;
  produtoRepo?: ProdutoRepository;
}

interface ItemLocal {
  tempId: string;
  id?: string;
  item_type: 'servico' | 'produto';
  service_id?: string | null;
  product_id?: string | null;
  professional_id?: string | null;
  name: string;
  quantity: number;
  unit_price: number;
}

interface PagamentoLinha {
  method: MetodoPagamento;
  amount: number;
  receivedCash: number;
}

const mapInitialServices = (services?: Array<{ service_id: string; name: string; price: number; professional_id?: string | null }>): ItemLocal[] => {
  return (services || []).map((s, idx) => ({
    tempId: `init-${idx}`,
    item_type: 'servico',
    service_id: s.service_id,
    professional_id: s.professional_id,
    name: s.name,
    quantity: 1,
    unit_price: s.price,
  }));
};

export const ComandaCheckoutModal: React.FC<ComandaCheckoutModalProps> = ({
  isOpen,
  tenantId,
  appointmentId,
  customerId,
  customerName,
  customerPhone,
  initialServices = [],
  availableServices = [],
  availableProfessionals = [],
  onClose,
  onFinalizado,
  comandaRepo,
  caixaRepo,
  produtoRepo,
}) => {
  const comRepo = useMemo(() => comandaRepo || new ComandaRepository(new SupabaseComandaAdapter()), [comandaRepo]);
  const cxaRepo = useMemo(() => caixaRepo || new CaixaRepository(new SupabaseCaixaAdapter()), [caixaRepo]);
  const prodRepo = useMemo(() => produtoRepo || new ProdutoRepository(new SupabaseProdutoAdapter()), [produtoRepo]);

  const [comandaId, setComandaId] = useState<string | null>(null);
  const [loadedComanda, setLoadedComanda] = useState<Comanda | null>(null);
  const [itens, setItens] = useState<ItemLocal[]>([]);
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('fixed');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [tipValue, setTipValue] = useState<number>(0);
  const [isSplitting, setIsSplitting] = useState(false);
  const [pagamentos, setPagamentos] = useState<PagamentoLinha[]>([
    { method: 'pix', amount: 0, receivedCash: 0 },
  ]);

  // Seletor de novos itens
  const [isAddingService, setIsAddingService] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedProfId, setSelectedProfId] = useState<string>('');

  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  // Abertura de caixa assistida
  const [isCaixaModalOpen, setIsCaixaModalOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<CashSession | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingComanda, setIsLoadingComanda] = useState(true);
  const [isReopening, setIsReopening] = useState(false);
  const [reopenConfirmOpen, setReopenConfirmOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const initialServicesKey = useMemo(() => {
    return (initialServices || []).map((s) => `${s.service_id}:${s.price}`).join('|');
  }, [initialServices]);

  useEffect(() => {
    if (!isOpen) return;

    // Reset de estados
    setIsLoadingComanda(true);
    setLoadedComanda(null);
    setDiscountValue(0);
    setTipValue(0);
    setIsSplitting(false);
    setReopenConfirmOpen(false);
    setErrorMsg(null);

    // Carregar catálogo de produtos
    prodRepo.listActive(tenantId).then(setCatalogProducts).catch(console.error);

    // Carregar sessão de caixa ativa
    cxaRepo.getActiveSession(tenantId).then(setActiveSession).catch(console.error);

    // Inicializar itens da comanda
    if (appointmentId) {
      comRepo.getByAppointmentId(appointmentId).then((existing) => {
        if (existing) {
          setComandaId(existing.id);
          setLoadedComanda(existing);

          if (existing.itens && existing.itens.length > 0) {
            setItens(
              existing.itens.map((it) => ({
                tempId: it.id,
                id: it.id,
                item_type: it.item_type,
                service_id: it.service_id,
                product_id: it.product_id,
                professional_id: it.professional_id,
                name: it.name || (it.item_type === 'servico' ? 'Serviço' : 'Produto'),
                quantity: it.quantity,
                unit_price: it.unit_price,
              }))
            );
          }

          if (existing.discount_amount) {
            setDiscountValue(existing.discount_amount);
            setDiscountType('fixed');
          }
          if (existing.tip_amount) {
            setTipValue(existing.tip_amount);
          }
          if (existing.pagamentos && existing.pagamentos.length > 0) {
            setPagamentos(
              existing.pagamentos.map((p) => ({
                method: p.payment_method,
                amount: p.amount,
                receivedCash: p.amount + (p.change_amount || 0),
              }))
            );
            if (existing.pagamentos.length > 1) {
              setIsSplitting(true);
            }
          }
        } else {
          // Itens iniciais a partir do agendamento
          setItens(mapInitialServices(initialServices));
        }
      }).catch((err) => {
        console.error('Erro ao verificar comanda existente:', err);
        setItens(mapInitialServices(initialServices));
      }).finally(() => {
        setIsLoadingComanda(false);
      });
    } else {
      setItens(mapInitialServices(initialServices));
      setIsLoadingComanda(false);
    }

  }, [isOpen, appointmentId, tenantId, initialServicesKey, comRepo, cxaRepo, prodRepo]);

  const isClosed = loadedComanda?.status === 'fechada';

  // Cálculos de Totais
  const subtotal = useMemo(() => {
    return itens.reduce((acc, it) => acc + (it.quantity || 1) * (it.unit_price || 0), 0);
  }, [itens]);

  const discountAmount = useMemo(() => {
    if (discountType === 'percent') {
      return (subtotal * (discountValue || 0)) / 100;
    }
    return Math.min(discountValue || 0, subtotal);
  }, [subtotal, discountType, discountValue]);

  const totalFinal = useMemo(() => {
    if (isClosed && loadedComanda) {
      return loadedComanda.total_amount;
    }
    return Math.max(0, subtotal - discountAmount + (tipValue || 0));
  }, [subtotal, discountAmount, tipValue, isClosed, loadedComanda]);

  // Sincronizar valor padrão da primeira linha de pagamento com o totalFinal se não estiver dividindo
  useEffect(() => {
    if (isClosed || isSplitting) return;
    setPagamentos((prev) => {
      if (prev.length <= 1) {
        return [{ method: prev[0]?.method || 'pix', amount: totalFinal, receivedCash: totalFinal }];
      }
      return prev;
    });
  }, [totalFinal, isClosed, isSplitting]);

  const totalPago = useMemo(() => {
    return pagamentos.reduce((acc, p) => acc + (p.amount || 0), 0);
  }, [pagamentos]);

  const saldoRestante = useMemo(() => {
    return Number(Math.max(0, totalFinal - totalPago).toFixed(2));
  }, [totalFinal, totalPago]);

  if (!isOpen) return null;

  const handleAddServiceConfirm = () => {
    const srv = availableServices.find((s) => s.id === selectedServiceId);
    if (!srv) return;

    setItens((prev) => [
      ...prev,
      {
        tempId: `srv-${Date.now()}`,
        item_type: 'servico',
        service_id: srv.id,
        professional_id: selectedProfId || availableProfessionals[0]?.id || null,
        name: srv.name,
        quantity: 1,
        unit_price: srv.price,
      },
    ]);

    setSelectedServiceId('');
    setSelectedProfId('');
    setIsAddingService(false);
  };

  const handleAddProductConfirm = () => {
    const prod = catalogProducts.find((p) => p.id === selectedProductId);
    if (!prod) return;

    setItens((prev) => [
      ...prev,
      {
        tempId: `prod-${Date.now()}`,
        item_type: 'produto',
        product_id: prod.id,
        name: prod.name,
        quantity: 1,
        unit_price: prod.price,
      },
    ]);

    setSelectedProductId('');
    setIsAddingProduct(false);
  };

  const handleRemoveItem = (tempId: string) => {
    setItens((prev) => prev.filter((it) => it.tempId !== tempId));
  };

  const handleSelectSingleMethod = (method: MetodoPagamento) => {
    setPagamentos([{ method, amount: totalFinal, receivedCash: totalFinal }]);
  };

  const handleEnableSplit = () => {
    setIsSplitting(true);
    const half1 = Number((totalFinal / 2).toFixed(2));
    const half2 = Number((totalFinal - half1).toFixed(2));
    setPagamentos([
      { method: pagamentos[0]?.method || 'pix', amount: half1, receivedCash: half1 },
      { method: 'credit_card', amount: half2, receivedCash: half2 },
    ]);
  };

  const handleDisableSplit = () => {
    setIsSplitting(false);
    setPagamentos([
      { method: pagamentos[0]?.method || 'pix', amount: totalFinal, receivedCash: totalFinal },
    ]);
  };

  const handleReopenComanda = async () => {
    if (!comandaId) return;
    try {
      setIsReopening(true);
      setErrorMsg(null);
      const reopened = await comRepo.reopenComanda(comandaId, tenantId);
      setLoadedComanda(reopened);

      if (reopened.itens && reopened.itens.length > 0) {
        setItens(
          reopened.itens.map((it) => ({
            tempId: it.id,
            id: it.id,
            item_type: it.item_type,
            service_id: it.service_id,
            product_id: it.product_id,
            professional_id: it.professional_id,
            name: it.name || (it.item_type === 'servico' ? 'Serviço' : 'Produto'),
            quantity: it.quantity,
            unit_price: it.unit_price,
          }))
        );
      }

      setPagamentos([
        { method: 'pix', amount: reopened.total_amount || totalFinal, receivedCash: reopened.total_amount || totalFinal },
      ]);
      setIsSplitting(false);
      setReopenConfirmOpen(false);
      if (onFinalizado) {
        onFinalizado(reopened);
      }
    } catch (err: any) {
      console.error('Erro ao reabrir comanda:', err);
      setErrorMsg(err.message || 'Não foi possível reabrir a comanda.');
    } finally {
      setIsReopening(false);
    }
  };

  const handleAddPagamentoLinha = () => {
    const nextAmount = saldoRestante > 0 ? saldoRestante : 0;
    setPagamentos((prev) => [
      ...prev,
      { method: 'cash', amount: nextAmount, receivedCash: nextAmount },
    ]);
  };

  const handleRemovePagamentoLinha = (index: number) => {
    if (pagamentos.length <= 2) {
      handleDisableSplit();
      return;
    }
    setPagamentos((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleFinalizar = async () => {
    setErrorMsg(null);

    if (itens.length === 0) {
      setErrorMsg('Adicione pelo menos um item à comanda.');
      return;
    }

    const effectivePagamentos =
      pagamentos.length <= 1 && !isSplitting
        ? [{ method: pagamentos[0]?.method || 'pix', amount: totalFinal, receivedCash: totalFinal }]
        : pagamentos;
    const effectiveTotalPago = effectivePagamentos.reduce((acc, p) => acc + (p.amount || 0), 0);

    if (Math.abs(effectiveTotalPago - totalFinal) > 0.01) {
      setErrorMsg(
        `O total dos pagamentos (R$ ${effectiveTotalPago.toFixed(2)}) deve ser igual ao valor total da comanda (R$ ${totalFinal.toFixed(2)}).`
      );
      return;
    }

    // Verificar se o caixa está aberto
    const sessao = activeSession || (await cxaRepo.getActiveSession(tenantId));
    if (!sessao || sessao.status !== 'open') {
      setIsCaixaModalOpen(true);
      return;
    }

    setIsSubmitting(true);
    try {
      let comandaEfetivaId = comandaId;

      if (!comandaEfetivaId) {
        const nova = await comRepo.createComanda({
          tenant_id: tenantId,
          appointment_id: appointmentId,
          customer_id: customerId,
          itens: itens.map((it) => ({
            item_type: it.item_type,
            service_id: it.service_id,
            product_id: it.product_id,
            professional_id: it.professional_id,
            quantity: it.quantity,
            unit_price: it.unit_price,
          })),
        });
        comandaEfetivaId = nova.id;
      }

      const comandaLiquidada = await comRepo.settleComanda({
        comanda_id: comandaEfetivaId,
        tenant_id: tenantId,
        discount_amount: discountAmount,
        tip_amount: tipValue,
        cash_session_id: sessao.id,
        pagamentos: effectivePagamentos.map((p) => ({
          payment_method: p.method,
          amount: p.amount,
          received_cash: p.method === 'cash' ? p.receivedCash : undefined,
        })),
      });

      onFinalizado(comandaLiquidada);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao liquidar comanda.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const methodLabels: Record<MetodoPagamento, string> = {
    pix: 'PIX',
    credit_card: 'Cartão de crédito',
    debit_card: 'Cartão de débito',
    cash: 'Dinheiro',
    other: 'Outro',
  };

  return (
    <>
      <div
        className="comanda-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-checkout-title"
      >
        <div className="comanda-modal-shell">
          {/* Header */}
          <div className="comanda-modal-header">
            <div className="comanda-modal-header-info">
              <h3 id="modal-checkout-title" className="comanda-modal-title">
                {loadedComanda?.comanda_number ? `Comanda #${loadedComanda.comanda_number}` : 'Comanda de atendimento'}
              </h3>
              <p className="comanda-modal-subtitle">
                Cliente: <strong>{customerName}</strong> {customerPhone && `• ${customerPhone}`}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="comanda-btn-close"
              aria-label="Fechar modal de comanda"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={20} />
            </button>
          </div>

          {/* Banner de Confirmação de Reabertura */}
          {reopenConfirmOpen && (
            <div style={{ margin: '0.75rem 1.25rem 0', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-warning-bg)', border: '1px solid var(--color-warning)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>
                Deseja realmente reabrir esta comanda?
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                Ao reabrir, os pagamentos registrados serão estornados e a comanda voltará para edição.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
                <button
                  type="button"
                  onClick={() => setReopenConfirmOpen(false)}
                  className="btn-link-sm"
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isReopening}
                  onClick={handleReopenComanda}
                  style={{ padding: '0.4rem 0.85rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-brand-primary)', color: 'white', border: 'none', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
                >
                  {isReopening ? 'Reabrindo...' : 'Confirmar reabertura'}
                </button>
              </div>
            </div>
          )}

          {/* Body */}
          <div className="comanda-modal-body">
            {isLoadingComanda ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3.5rem 1rem', gap: '1rem', minHeight: '260px' }}>
                <div style={{ width: '32px', height: '32px', border: '3px solid var(--color-brand-soft)', borderTopColor: 'var(--color-brand-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Carregando dados da comanda...</p>
              </div>
            ) : (
              <>
            {/* Banner de Comanda Fechada / Somente Leitura */}
            {errorMsg && (
              <div className="comanda-error-alert">
                {errorMsg}
              </div>
            )}

            {/* Banner de Comanda Fechada / Liquidada */}
            {isClosed && (
              <div className="comanda-closed-badge-banner">
                <div className="comanda-closed-banner-left">
                  <div className="comanda-closed-icon-badge">
                    <HugeiconsIcon icon={CheckmarkCircle01Icon} size={20} />
                  </div>
                  <div>
                    <strong className="comanda-closed-title">Atendimento liquidado e pago</strong>
                    {loadedComanda?.closed_at && (
                      <span className="closed-time-detail">
                        {new Date(loadedComanda.closed_at).toLocaleDateString('pt-BR')} às{' '}
                        {new Date(loadedComanda.closed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
                <span className="comanda-receipt-badge">Recibo</span>
              </div>
            )}

            {/* Lista de Itens */}
            <div className="comanda-section">
              <div className="comanda-section-header">
                <h4 className="comanda-section-title">
                  Itens consumidos ({itens.length})
                </h4>
                {!isClosed && (
                  <div className="comanda-section-actions">
                    <button
                      type="button"
                      onClick={() => { setIsAddingService(true); setIsAddingProduct(false); }}
                      className="btn-add-item"
                    >
                      <HugeiconsIcon icon={ScissorIcon} size={14} />
                      <span>Serviço</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIsAddingProduct(true); setIsAddingService(false); }}
                      className="btn-add-item"
                    >
                      <HugeiconsIcon icon={ShoppingBag01Icon} size={14} />
                      <span>Produto</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Formulário Embutido: Adicionar Serviço */}
              {!isClosed && isAddingService && (
                <div className="add-item-box">
                  <div className="add-item-header">
                    <span className="add-item-title">Adicionar serviço</span>
                    <button
                      type="button"
                      onClick={() => setIsAddingService(false)}
                      className="btn-cancel-item"
                    >
                      Cancelar
                    </button>
                  </div>
                  <div className="add-item-row">
                    <select
                      value={selectedServiceId}
                      onChange={(e) => setSelectedServiceId(e.target.value)}
                      className="comanda-select flex-1"
                    >
                      <option value="">Selecione o serviço...</option>
                      {availableServices.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>

                    <select
                      value={selectedProfId}
                      onChange={(e) => setSelectedProfId(e.target.value)}
                      className="comanda-select flex-1"
                    >
                      <option value="">Profissional...</option>
                      {availableProfessionals.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={!selectedServiceId}
                      onClick={handleAddServiceConfirm}
                      className="btn-confirm-item"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>
              )}

              {/* Formulário Embutido: Adicionar Produto */}
              {!isClosed && isAddingProduct && (
                <div className="add-item-box">
                  <div className="add-item-header">
                    <span className="add-item-title">Adicionar produto</span>
                    <button
                      type="button"
                      onClick={() => setIsAddingProduct(false)}
                      className="btn-cancel-item"
                    >
                      Cancelar
                    </button>
                  </div>
                  <div className="add-item-row">
                    <select
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      className="comanda-select flex-1"
                    >
                      <option value="">Selecione o produto...</option>
                      {catalogProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={!selectedProductId}
                      onClick={handleAddProductConfirm}
                      className="btn-confirm-item"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>
              )}

              {/* Lista dos Itens da Comanda */}
              <div className="comanda-items-list">
                {itens.map((it) => (
                  <div key={it.tempId} className="comanda-item-card">
                    <div className="comanda-item-info">
                      <div className="comanda-item-icon-tag">
                        <HugeiconsIcon icon={it.item_type === 'servico' ? ScissorIcon : ShoppingBag01Icon} size={15} />
                      </div>
                      <div>
                        <strong className="comanda-item-name">{it.name}</strong>
                        <span className="comanda-item-detail">
                          {it.item_type === 'servico' ? 'Serviço' : 'Produto'} • {it.quantity}x • R$ {it.unit_price.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="comanda-item-right">
                      <span className="comanda-item-total">
                        R$ {(it.quantity * it.unit_price).toFixed(2)}
                      </span>
                      {!isClosed && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(it.tempId)}
                          className="comanda-item-remove-btn"
                          title="Remover item"
                          aria-label="Remover item"
                        >
                          <HugeiconsIcon icon={Delete02Icon} size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Desconto e Gorjeta (Apenas editável se aberta) */}
            {!isClosed ? (
              <div className="comanda-discount-tip-grid">
                <div className="comanda-form-group">
                  <label className="comanda-label">Desconto</label>
                  <div className="comanda-input-segmented-wrapper">
                    <div className="comanda-segmented-type">
                      <button
                        type="button"
                        className={`seg-type-btn ${discountType === 'fixed' ? 'seg-type-btn--active' : ''}`}
                        onClick={() => setDiscountType('fixed')}
                      >
                        R$
                      </button>
                      <button
                        type="button"
                        className={`seg-type-btn ${discountType === 'percent' ? 'seg-type-btn--active' : ''}`}
                        onClick={() => setDiscountType('percent')}
                      >
                        %
                      </button>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={discountValue || ''}
                      onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                      placeholder="0,00"
                      className="comanda-input-num"
                    />
                  </div>
                </div>

                <div className="comanda-form-group">
                  <label className="comanda-label">Gorjeta (R$)</label>
                  <input
                    type="number"
                    min="0"
                    value={tipValue || ''}
                    onChange={(e) => setTipValue(parseFloat(e.target.value) || 0)}
                    placeholder="0,00"
                    className="comanda-input-num"
                  />
                </div>
              </div>
            ) : null}

            {/* Sumário de Totais */}
            <div className="comanda-summary-box">
              <div className="summary-row">
                <span>Subtotal:</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="summary-row summary-discount">
                  <span>Desconto:</span>
                  <span>- R$ {discountAmount.toFixed(2)}</span>
                </div>
              )}
              {tipValue > 0 && (
                <div className="summary-row summary-tip">
                  <span>Gorjeta:</span>
                  <span>+ R$ {tipValue.toFixed(2)}</span>
                </div>
              )}
              <div className="summary-row summary-total">
                <span>{isClosed ? 'Total pago:' : 'Total:'}</span>
                <span className="summary-total-value">R$ {totalFinal.toFixed(2)}</span>
              </div>
            </div>

            {/* Formas de Pagamento */}
            <div className="comanda-section">
              <div className="comanda-section-header">
                <h4 className="comanda-section-title">
                  {isClosed ? 'Pagamentos registrados' : 'Forma de pagamento'}
                </h4>
                {!isClosed && !isSplitting && (
                  <button
                    type="button"
                    onClick={handleEnableSplit}
                    className="btn-split-toggle"
                  >
                    Dividir valor
                  </button>
                )}
                {!isClosed && isSplitting && (
                  <button
                    type="button"
                    onClick={handleDisableSplit}
                    className="btn-split-cancel"
                  >
                    Forma única
                  </button>
                )}
              </div>

              {/* Modo de Visualização Fechada / Recibo */}
              {isClosed ? (
                <div className="comanda-payments-list">
                  {pagamentos.map((pag, idx) => (
                    <div key={idx} className="payment-receipt-row">
                      <span className="payment-receipt-method">
                        {methodLabels[pag.method] || pag.method}
                      </span>
                      <strong className="payment-receipt-amount">
                        R$ {pag.amount.toFixed(2)}
                      </strong>
                    </div>
                  ))}
                </div>
              ) : !isSplitting ? (
                /* Modo Pagamento Único: Botões de Acesso Rápido */
                <div className="single-payment-container">
                  <div className="quick-methods-grid">
                    {(['pix', 'credit_card', 'debit_card', 'cash'] as MetodoPagamento[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleSelectSingleMethod(m)}
                        className={`btn-quick-method ${pagamentos[0]?.method === m ? 'btn-quick-method--active' : ''}`}
                      >
                        {methodLabels[m]}
                      </button>
                    ))}
                  </div>

                  {pagamentos[0]?.method === 'cash' && (
                    <div className="cash-single-calculator">
                      <div className="cash-quick-notes">
                        <span className="cash-notes-label">Notas:</span>
                        <button
                          type="button"
                          className={`btn-quick-note ${pagamentos[0]?.receivedCash === totalFinal ? 'btn-quick-note--active' : ''}`}
                          onClick={() => setPagamentos([{ ...pagamentos[0], receivedCash: totalFinal }])}
                        >
                          Exato
                        </button>
                        {[50, 100, 200].map((note) => {
                          if (note < totalFinal) return null;
                          return (
                            <button
                              key={note}
                              type="button"
                              className={`btn-quick-note ${pagamentos[0]?.receivedCash === note ? 'btn-quick-note--active' : ''}`}
                              onClick={() => setPagamentos([{ ...pagamentos[0], receivedCash: note }])}
                            >
                              R$ {note}
                            </button>
                          );
                        })}
                      </div>

                      <label className="cash-input-field">
                        <span>Valor recebido: R$</span>
                        <input
                          type="number"
                          min={totalFinal}
                          step="0.01"
                          value={pagamentos[0]?.receivedCash || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setPagamentos([{ ...pagamentos[0], receivedCash: val }]);
                          }}
                          className="cash-received-input"
                        />
                      </label>

                      {pagamentos[0]?.receivedCash > totalFinal && (
                        <div className="cash-change-badge">
                          <span>Troco a devolver:</span>
                          <strong>R$ {(pagamentos[0].receivedCash - totalFinal).toFixed(2)}</strong>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Modo Pagamento Dividido */
                <div className="split-payments-container">
                  <div className="comanda-payments-list">
                    {pagamentos.map((pag, idx) => {
                      const change = pag.method === 'cash' && pag.receivedCash > pag.amount
                        ? pag.receivedCash - pag.amount
                        : 0;

                      return (
                        <div key={idx} className="payment-row-card">
                          <div className="payment-row-main">
                            <select
                              value={pag.method}
                              onChange={(e) => {
                                const newMethod = e.target.value as MetodoPagamento;
                                setPagamentos((prev) =>
                                  prev.map((p, i) => (i === idx ? { ...p, method: newMethod } : p))
                                );
                              }}
                              className="comanda-select payment-method-select"
                            >
                              <option value="pix">PIX</option>
                              <option value="credit_card">Cartão de crédito</option>
                              <option value="debit_card">Cartão de débito</option>
                              <option value="cash">Dinheiro</option>
                              <option value="other">Outro</option>
                            </select>

                            <div className="payment-amount-input-wrapper">
                              <span className="payment-amount-prefix">R$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={pag.amount || ''}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setPagamentos((prev) =>
                                    prev.map((p, i) => (i === idx ? { ...p, amount: val, receivedCash: Math.max(val, p.receivedCash) } : p))
                                  );
                                }}
                                className="payment-amount-input"
                              />
                            </div>

                            {pagamentos.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemovePagamentoLinha(idx)}
                                className="btn-remove-payment"
                                title="Remover forma"
                                aria-label="Remover forma"
                              >
                                <HugeiconsIcon icon={Delete02Icon} size={16} />
                              </button>
                            )}
                          </div>

                          {pag.method === 'cash' && (
                            <div className="cash-change-calculator">
                              <label className="cash-input-field">
                                <span>Recebido: R$</span>
                                <input
                                  type="number"
                                  min={pag.amount}
                                  step="0.01"
                                  value={pag.receivedCash || ''}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setPagamentos((prev) =>
                                      prev.map((p, i) => (i === idx ? { ...p, receivedCash: val } : p))
                                    );
                                  }}
                                  className="cash-received-input"
                                />
                              </label>
                              {change > 0 && (
                                <div className="cash-change-badge">
                                  <span>Troco:</span>
                                  <strong>R$ {change.toFixed(2)}</strong>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="split-payments-footer">
                    <button
                      type="button"
                      onClick={handleAddPagamentoLinha}
                      className="btn-add-split-line"
                    >
                      <span>Adicionar forma de pagamento</span>
                    </button>
                    <div className="split-summary-bar">
                      <span>Total: R$ {totalFinal.toFixed(2)} • Pago: R$ {totalPago.toFixed(2)}</span>
                      {saldoRestante > 0 ? (
                        <span className="split-missing-alert">Falta: R$ {saldoRestante.toFixed(2)}</span>
                      ) : (
                        <span className="split-complete-alert">Completo</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="comanda-modal-footer">
            {isClosed ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setReopenConfirmOpen(true)}
                  disabled={isReopening}
                  className="btn-reopen-comanda"
                  style={{
                    padding: '0.6rem 1.1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1.5px solid var(--color-brand-primary)',
                    backgroundColor: 'transparent',
                    color: 'var(--color-brand-primary)',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isReopening ? 'Reabrindo...' : 'Reabrir comanda'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="comanda-btn-primary"
                  style={{ minWidth: '100px' }}
                >
                  Fechar
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="comanda-btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isSubmitting || saldoRestante > 0 || itens.length === 0}
                  onClick={handleFinalizar}
                  className="comanda-btn-primary"
                >
                  {isSubmitting ? (
                    <span>Processando...</span>
                  ) : (
                    <span>Finalizar e receber (R$ {totalFinal.toFixed(2)})</span>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Overlay de Abertura Assistida de Caixa se necessário */}
      <AberturaAssistidaCaixaModal
        isOpen={isCaixaModalOpen}
        tenantId={tenantId}
        caixaRepo={cxaRepo}
        onCaixaAberto={(session) => {
          setActiveSession(session);
          setIsCaixaModalOpen(false);
          handleFinalizar();
        }}
        onClose={() => setIsCaixaModalOpen(false)}
      />

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUpModal {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .comanda-modal-overlay {
          position: fixed;
          inset: 0;
          background-color: rgba(20, 17, 15, 0.65);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1050;
          padding: 1rem;
          animation: fadeIn 0.2s cubic-bezier(0.32, 0.72, 0, 1);
        }

        .comanda-modal-shell {
          width: 100%;
          max-width: 600px;
          max-height: calc(100dvh - 2.5rem);
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl);
          box-shadow: 0 20px 48px -12px rgba(20, 17, 15, 0.28), var(--shadow-xl);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          font-family: var(--font-family-base);
          color: var(--color-text-primary);
          animation: slideUpModal 0.25s cubic-bezier(0.32, 0.72, 0, 1);
        }

        .comanda-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--color-border);
        }

        .comanda-modal-title {
          font-size: var(--font-size-lg);
          font-weight: 700;
          color: var(--color-text-primary);
          margin: 0;
        }

        .comanda-modal-subtitle {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          margin: 0.2rem 0 0 0;
        }

        .text-highlight {
          color: var(--color-text-primary);
          font-weight: 700;
        }

        .comanda-btn-close,
        .comanda-close-btn {
          min-width: 44px;
          min-height: 44px;
          border-radius: var(--radius-full);
          border: none;
          background: transparent;
          color: var(--color-text-secondary);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .comanda-btn-close:hover,
        .comanda-close-btn:hover {
          background-color: var(--color-error-bg);
          color: var(--color-error);
        }

        .comanda-modal-body {
          flex: 1;
          overflow-y: auto;
          overscroll-behavior: contain;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .comanda-error-alert {
          padding: 0.75rem 1rem;
          border-radius: var(--radius-md);
          background-color: var(--color-error-bg);
          border: 1px solid var(--color-error);
          color: var(--color-error);
          font-size: var(--font-size-xs);
          font-weight: 600;
        }

        .comanda-closed-badge-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.9rem 1.15rem;
          border-radius: var(--radius-lg);
          background-color: var(--color-success-bg);
          border: 1px solid var(--color-success);
          gap: 0.75rem;
        }

        .comanda-closed-banner-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .comanda-closed-icon-badge {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-full);
          background-color: var(--color-success-bg, rgba(14, 159, 110, 0.15));
          color: var(--color-success);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .comanda-closed-title {
          display: block;
          font-size: var(--font-size-sm);
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .closed-time-detail {
          display: block;
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          margin-top: 0.15rem;
        }

        .comanda-receipt-badge {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 0.25rem 0.6rem;
          border-radius: var(--radius-full);
          background-color: var(--color-success-bg, rgba(14, 159, 110, 0.15));
          color: var(--color-success);
          border: 1px solid var(--color-success);
          flex-shrink: 0;
        }

        .comanda-section {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .comanda-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .comanda-section-title {
          font-size: var(--font-size-xs);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--color-text-secondary);
          margin: 0;
        }

        .comanda-section-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .btn-add-item {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.35rem 0.65rem;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border);
          background-color: var(--color-bg-primary);
          color: var(--color-brand-primary);
          font-size: var(--font-size-xs);
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-add-item:hover {
          background-color: var(--color-brand-lightest);
        }

        .add-item-box {
          padding: 0.85rem 1rem;
          border-radius: var(--radius-lg);
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          animation: fadeIn 0.15s ease-out;
        }

        .add-item-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
        }

        .add-item-title {
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .btn-cancel-item {
          background: transparent;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: 0.25rem 0.65rem;
          color: var(--color-text-secondary);
          font-size: var(--font-size-xs);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-cancel-item:hover {
          color: var(--color-error);
          border-color: var(--color-error);
          background-color: var(--color-error-bg);
        }

        .add-item-row {
          display: flex;
          gap: 0.5rem;
        }

        .btn-confirm-item {
          padding: 0.4rem 0.85rem;
          border-radius: var(--radius-md);
          border: none;
          background-color: var(--color-brand-primary);
          color: white;
          font-size: var(--font-size-xs);
          font-weight: 700;
          cursor: pointer;
        }

        .btn-confirm-item:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .comanda-items-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .comanda-item-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.65rem 0.85rem;
          border-radius: var(--radius-md);
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          transition: border-color 0.2s ease;
        }

        .comanda-item-card:hover {
          border-color: var(--color-brand-soft);
        }

        .comanda-item-info {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }

        .comanda-item-icon-tag {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-md);
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-brand-primary);
          flex-shrink: 0;
        }

        .comanda-item-name {
          display: block;
          font-size: var(--font-size-sm);
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .comanda-item-detail {
          display: block;
          font-size: 0.7rem;
          color: var(--color-text-secondary);
        }

        .comanda-item-right {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .comanda-item-total {
          font-size: var(--font-size-sm);
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .comanda-item-remove-btn {
          background: transparent;
          border: none;
          color: var(--color-text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.3rem;
          border-radius: var(--radius-sm);
          transition: all 0.2s ease;
        }

        .comanda-item-remove-btn:hover {
          color: var(--color-error);
          background-color: var(--color-error-bg);
        }

        .comanda-discount-tip-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }

        .comanda-form-group {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .comanda-label {
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-secondary);
        }

        .comanda-input-segmented-wrapper {
          display: flex;
          gap: 0.35rem;
        }

        .comanda-segmented-type {
          display: flex;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
          background-color: var(--color-bg-primary);
          flex-shrink: 0;
        }

        .seg-type-btn {
          border: none;
          background: transparent;
          padding: 0.45rem 0.65rem;
          min-width: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--color-text-secondary);
          cursor: pointer;
          line-height: 1;
          white-space: nowrap;
          transition: all 0.15s ease;
        }

        .seg-type-btn:hover:not(.seg-type-btn--active) {
          background-color: var(--color-brand-lightest);
          color: var(--color-brand-deep);
        }

        .seg-type-btn--active {
          background-color: var(--color-brand-primary);
          color: white;
        }

        .comanda-input-num,
        .comanda-select {
          width: 100%;
          padding: 0.5rem 0.75rem;
          font-size: var(--font-size-sm);
          color: var(--color-text-primary);
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          outline: none;
          transition: all 0.2s ease;
        }

        .comanda-input-num:focus,
        .comanda-select:focus {
          border-color: var(--color-brand-primary);
        }

        .comanda-summary-box {
          padding: 1rem;
          border-radius: var(--radius-lg);
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          font-size: var(--font-size-xs);
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          color: var(--color-text-secondary);
          font-weight: 500;
        }

        .summary-discount {
          color: var(--color-error);
          font-weight: 700;
        }

        .summary-tip {
          color: var(--color-success);
          font-weight: 700;
        }

        .summary-total {
          padding-top: 0.5rem;
          border-top: 1px solid var(--color-border);
          font-size: var(--font-size-base);
          font-weight: 800;
          color: var(--color-text-primary);
        }

        .summary-total-value {
          color: var(--color-brand-primary);
          font-size: var(--font-size-lg);
        }

        .btn-split-toggle {
          background-color: var(--color-brand-lightest);
          border: 1px solid var(--color-brand-soft);
          color: var(--color-brand-deep);
          font-size: var(--font-size-xs);
          font-weight: 700;
          padding: 0.35rem 0.7rem;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-split-toggle:hover {
          background-color: var(--color-brand-soft);
          color: white;
        }

        .btn-split-cancel {
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          color: var(--color-text-secondary);
          font-size: var(--font-size-xs);
          font-weight: 600;
          padding: 0.35rem 0.7rem;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-split-cancel:hover {
          color: var(--color-error);
          border-color: var(--color-error);
          background-color: var(--color-error-bg);
        }

        .quick-methods-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.5rem;
        }

        .btn-quick-method {
          padding: 0.65rem 0.5rem;
          border: 1.5px solid var(--color-border);
          background-color: var(--color-bg-primary);
          border-radius: var(--radius-md);
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-primary);
          cursor: pointer;
          text-align: center;
          transition: all 0.2s ease;
        }

        .btn-quick-method:hover {
          border-color: var(--color-brand-soft);
        }

        .btn-quick-method--active {
          border-color: var(--color-brand-primary);
          background-color: var(--color-brand-lightest);
          color: var(--color-brand-deep);
          box-shadow: var(--shadow-sm);
        }

        .cash-single-calculator {
          margin-top: 0.75rem;
          padding: 0.85rem 1rem;
          border-radius: var(--radius-lg);
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .cash-quick-notes {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.35rem;
        }

        .cash-notes-label {
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-secondary);
          margin-right: 0.25rem;
        }

        .btn-quick-note {
          padding: 0.3rem 0.6rem;
          border-radius: var(--radius-full);
          border: 1px solid var(--color-border);
          background-color: var(--color-bg-secondary);
          color: var(--color-text-primary);
          font-size: var(--font-size-xs);
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-quick-note:hover {
          border-color: var(--color-brand-soft);
          background-color: var(--color-brand-lightest);
          color: var(--color-brand-deep);
        }

        .btn-quick-note--active {
          border-color: var(--color-brand-primary);
          background-color: var(--color-brand-lightest);
          color: var(--color-brand-deep);
          box-shadow: var(--shadow-sm);
        }

        .cash-change-badge {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.6rem 0.85rem;
          border-radius: var(--radius-md);
          background-color: rgba(34, 197, 94, 0.1);
          border: 1px solid var(--color-success);
          color: var(--color-success);
          font-size: var(--font-size-xs);
        }

        .cash-change-badge strong {
          font-size: var(--font-size-sm);
          font-weight: 800;
        }

        .payment-receipt-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.85rem 1rem;
          border-radius: var(--radius-md);
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          font-size: var(--font-size-sm);
          transition: all 0.2s ease;
        }

        .payment-receipt-row:hover {
          border-color: var(--color-brand-soft);
        }

        .payment-receipt-method {
          font-weight: 600;
          color: var(--color-text-primary);
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .payment-receipt-amount {
          color: var(--color-brand-primary);
          font-weight: 800;
          font-size: var(--font-size-sm);
        }

        .split-payments-container {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .comanda-payments-list {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }

        .payment-row-card {
          padding: 0.75rem;
          border-radius: var(--radius-md);
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .payment-row-main {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .payment-method-select {
          flex: 1.2;
        }

        .payment-amount-input-wrapper {
          flex: 1;
          position: relative;
          display: flex;
          align-items: center;
        }

        .payment-amount-prefix {
          position: absolute;
          left: 0.6rem;
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-secondary);
        }

        .payment-amount-input {
          width: 100%;
          padding: 0.5rem 0.5rem 0.5rem 2rem;
          font-size: var(--font-size-sm);
          font-weight: 700;
          color: var(--color-text-primary);
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          outline: none;
        }

        .payment-amount-input:focus {
          border-color: var(--color-brand-primary);
        }

        .btn-remove-payment {
          background: transparent;
          border: none;
          color: var(--color-text-secondary);
          cursor: pointer;
          padding: 0.3rem;
          border-radius: var(--radius-sm);
        }

        .btn-remove-payment:hover {
          color: var(--color-error);
        }

        .split-payments-footer {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-top: 0.5rem;
        }

        .btn-add-split-line {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.55rem 0.85rem;
          border-radius: var(--radius-md);
          border: 1px dashed var(--color-brand-primary);
          background-color: var(--color-brand-lightest);
          color: var(--color-brand-deep);
          font-size: var(--font-size-xs);
          font-weight: 700;
          cursor: pointer;
          width: 100%;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .btn-add-split-line:hover {
          background-color: var(--color-brand-soft);
          color: white;
        }

        .split-summary-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.65rem 0.85rem;
          border-radius: var(--radius-md);
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          font-size: var(--font-size-xs);
          font-weight: 700;
        }

        .split-missing-alert {
          color: var(--color-error);
        }

        .split-complete-alert {
          color: var(--color-success);
        }

        .cash-change-calculator {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 0.35rem;
          border-top: 1px solid var(--color-border);
          font-size: var(--font-size-xs);
        }

        .cash-input-field {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
        }

        .cash-received-input {
          width: 80px;
          padding: 0.25rem 0.4rem;
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-primary);
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
        }

        .cash-change-badge {
          font-weight: 700;
          color: var(--color-brand-primary);
        }

        .comanda-modal-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          padding: 1.15rem 1.5rem;
          border-top: 1px solid var(--color-border);
          background-color: var(--color-bg-primary);
        }

        .comanda-btn-secondary {
          padding: 0.7rem 1.25rem;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border);
          background-color: var(--color-bg-secondary);
          color: var(--color-text-primary);
          font-size: var(--font-size-sm);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .comanda-btn-secondary:hover {
          background-color: var(--color-border);
        }

        .comanda-btn-primary {
          padding: 0.7rem 1.5rem;
          border-radius: var(--radius-md);
          border: none;
          background-color: var(--color-brand-primary);
          color: white;
          font-size: var(--font-size-sm);
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.2s ease;
        }

        .comanda-btn-primary:hover:not(:disabled) {
          background-color: var(--color-brand-hover);
        }

        .comanda-btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .comanda-modal-body::-webkit-scrollbar {
          width: 6px;
        }

        .comanda-modal-body::-webkit-scrollbar-track {
          background: transparent;
        }

        .comanda-modal-body::-webkit-scrollbar-thumb {
          background-color: var(--color-border);
          border-radius: var(--radius-full);
        }

        .comanda-modal-body::-webkit-scrollbar-thumb:hover {
          background-color: var(--color-text-secondary);
        }

        .comanda-modal-shell button:focus-visible,
        .comanda-modal-shell input:focus-visible,
        .comanda-modal-shell select:focus-visible {
          outline: 2px solid var(--color-brand-primary);
          outline-offset: 2px;
        }
      `}</style>
    </>
  );
};
