import React, { useEffect, useMemo, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Delete02Icon,
  Money01Icon,
  PlusSignIcon,
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
  const [itens, setItens] = useState<ItemLocal[]>([]);
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('fixed');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [tipValue, setTipValue] = useState<number>(0);
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Carregar catálogo de produtos
    prodRepo.listActive(tenantId).then(setCatalogProducts).catch(console.error);

    // Carregar sessão de caixa ativa
    cxaRepo.getActiveSession(tenantId).then(setActiveSession).catch(console.error);

    // Inicializar itens da comanda
    if (appointmentId) {
      comRepo.getByAppointmentId(appointmentId).then((existing) => {
        if (existing && existing.itens && existing.itens.length > 0) {
          setComandaId(existing.id);
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
        } else {
          // Itens iniciais a partir do agendamento
          const init: ItemLocal[] = initialServices.map((s, idx) => ({
            tempId: `init-${idx}`,
            item_type: 'servico',
            service_id: s.service_id,
            professional_id: s.professional_id,
            name: s.name,
            quantity: 1,
            unit_price: s.price,
          }));
          setItens(init);
        }
      }).catch((err) => {
        console.error('Erro ao verificar comanda existente:', err);
        const init: ItemLocal[] = initialServices.map((s, idx) => ({
          tempId: `init-${idx}`,
          item_type: 'servico',
          service_id: s.service_id,
          professional_id: s.professional_id,
          name: s.name,
          quantity: 1,
          unit_price: s.price,
        }));
        setItens(init);
      });
    } else {
      const init: ItemLocal[] = initialServices.map((s, idx) => ({
        tempId: `init-${idx}`,
        item_type: 'servico',
        service_id: s.service_id,
        professional_id: s.professional_id,
        name: s.name,
        quantity: 1,
        unit_price: s.price,
      }));
      setItens(init);
    }
  }, [isOpen, appointmentId, tenantId, initialServices, comRepo, cxaRepo, prodRepo]);

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
    return Math.max(0, subtotal - discountAmount + (tipValue || 0));
  }, [subtotal, discountAmount, tipValue]);

  // Sincronizar valor padrão da primeira linha de pagamento com o totalFinal
  useEffect(() => {
    setPagamentos((prev) => {
      if (prev.length === 1) {
        return [{ ...prev[0], amount: totalFinal, receivedCash: totalFinal }];
      }
      return prev;
    });
  }, [totalFinal]);

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

  const handleAddPagamentoLinha = () => {
    if (saldoRestante <= 0) return;
    setPagamentos((prev) => [
      ...prev,
      { method: 'cash', amount: saldoRestante, receivedCash: saldoRestante },
    ]);
  };

  const handleRemovePagamentoLinha = (index: number) => {
    setPagamentos((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleFinalizar = async () => {
    setErrorMsg(null);

    if (itens.length === 0) {
      setErrorMsg('Adicione pelo menos um item à comanda.');
      return;
    }

    if (Math.abs(totalPago - totalFinal) > 0.01) {
      setErrorMsg(`O total dos pagamentos (R$ ${totalPago.toFixed(2)}) deve ser igual ao valor total da conta (R$ ${totalFinal.toFixed(2)}).`);
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
        pagamentos: pagamentos.map((p) => ({
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
            <div className="comanda-header-left">
              <div className="comanda-icon-badge">
                <HugeiconsIcon icon={Money01Icon} size={22} />
              </div>
              <div>
                <h3 id="modal-checkout-title" className="comanda-modal-title">
                  Comanda & Checkout
                </h3>
                <p className="comanda-modal-subtitle">
                  Cliente: <strong className="text-highlight">{customerName}</strong> {customerPhone && `• ${customerPhone}`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              type="button"
              className="comanda-close-btn"
              aria-label="Fechar"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={20} />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="comanda-modal-body">
            {errorMsg && (
              <div className="comanda-error-alert">
                {errorMsg}
              </div>
            )}

            {/* Lista de Itens */}
            <div className="comanda-section">
              <div className="comanda-section-header">
                <h4 className="comanda-section-title">
                  Itens Consumidos ({itens.length})
                </h4>
                <div className="comanda-section-actions">
                  <button
                    type="button"
                    onClick={() => { setIsAddingService(true); setIsAddingProduct(false); }}
                    className="btn-add-item"
                  >
                    <HugeiconsIcon icon={ScissorIcon} size={14} />
                    <span>+ Serviço</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsAddingProduct(true); setIsAddingService(false); }}
                    className="btn-add-item"
                  >
                    <HugeiconsIcon icon={ShoppingBag01Icon} size={14} />
                    <span>+ Produto</span>
                  </button>
                </div>
              </div>

              {/* Formulário Embutido: Adicionar Serviço */}
              {isAddingService && (
                <div className="add-item-box">
                  <div className="flex-between">
                    <span className="add-item-title">Adicionar Serviço Extra</span>
                    <button
                      type="button"
                      onClick={() => setIsAddingService(false)}
                      className="btn-link-sm"
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
                          {s.name} (R$ {s.price.toFixed(2)})
                        </option>
                      ))}
                    </select>

                    <select
                      value={selectedProfId}
                      onChange={(e) => setSelectedProfId(e.target.value)}
                      className="comanda-select flex-1"
                    >
                      <option value="">Profissional executor...</option>
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
                      Inserir
                    </button>
                  </div>
                </div>
              )}

              {/* Formulário Embutido: Adicionar Produto */}
              {isAddingProduct && (
                <div className="add-item-box">
                  <div className="flex-between">
                    <span className="add-item-title">Venda de Produto (Balcão)</span>
                    <button
                      type="button"
                      onClick={() => setIsAddingProduct(false)}
                      className="btn-link-sm"
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
                          {p.name} (R$ {p.price.toFixed(2)}) • Estoque: {p.stock_quantity}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={!selectedProductId}
                      onClick={handleAddProductConfirm}
                      className="btn-confirm-item"
                    >
                      Inserir
                    </button>
                  </div>
                </div>
              )}

              {/* Lista dos Itens da Comanda */}
              <div className="comanda-items-list">
                {itens.map((it) => (
                  <div key={it.tempId} className="comanda-item-card">
                    <div className="comanda-item-info">
                      <div className="comanda-item-badge">
                        <HugeiconsIcon
                          icon={it.item_type === 'servico' ? ScissorIcon : ShoppingBag01Icon}
                          size={14}
                        />
                      </div>
                      <div>
                        <strong className="comanda-item-name">{it.name}</strong>
                        <span className="comanda-item-detail">
                          {it.quantity}x • R$ {it.unit_price.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="comanda-item-right">
                      <span className="comanda-item-total">
                        R$ {(it.quantity * it.unit_price).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(it.tempId)}
                        className="comanda-item-remove-btn"
                        title="Remover item"
                      >
                        <HugeiconsIcon icon={Delete02Icon} size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Desconto e Gorjeta */}
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
                <label className="comanda-label">Gorjeta do Barbeiro (R$)</label>
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

            {/* Sumário de Totais */}
            <div className="comanda-summary-box">
              <div className="summary-row">
                <span>Subtotal:</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="summary-row summary-discount">
                  <span>Desconto aplicado:</span>
                  <span>- R$ {discountAmount.toFixed(2)}</span>
                </div>
              )}
              {tipValue > 0 && (
                <div className="summary-row summary-tip">
                  <span>Gorjeta do profissional:</span>
                  <span>+ R$ {tipValue.toFixed(2)}</span>
                </div>
              )}
              <div className="summary-row summary-total">
                <span>Total a Pagar:</span>
                <span className="summary-total-value">R$ {totalFinal.toFixed(2)}</span>
              </div>
            </div>

            {/* Divisão de Formas de Pagamento */}
            <div className="comanda-section">
              <div className="comanda-section-header">
                <h4 className="comanda-section-title">
                  Pagamento ({pagamentos.length})
                </h4>
                {saldoRestante > 0 && (
                  <button
                    type="button"
                    onClick={handleAddPagamentoLinha}
                    className="btn-link-brand"
                  >
                    <HugeiconsIcon icon={PlusSignIcon} size={14} />
                    <span>Dividir Pagamento</span>
                  </button>
                )}
              </div>

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
                          <option value="credit_card">Cartão de Crédito</option>
                          <option value="debit_card">Cartão de Débito</option>
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
                            title="Remover linha de pagamento"
                          >
                            <HugeiconsIcon icon={Delete02Icon} size={16} />
                          </button>
                        )}
                      </div>

                      {pag.method === 'cash' && (
                        <div className="cash-change-calculator">
                          <div className="cash-input-field">
                            <span>Recebido em Dinheiro: R$</span>
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
                          </div>
                          {change > 0 && (
                            <div className="cash-change-badge">
                              Troco: R$ {change.toFixed(2)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {saldoRestante > 0 && (
                <p className="comanda-warning-text">
                  Faltam R$ {saldoRestante.toFixed(2)} para cobrir o total da comanda.
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="comanda-modal-footer">
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
                <>
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} size={18} />
                  <span>Finalizar & Receber (R$ {totalFinal.toFixed(2)})</span>
                </>
              )}
            </button>
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
          // Prosseguir com a liquidação da comanda
          handleFinalizar();
        }}
        onClose={() => setIsCaixaModalOpen(false)}
      />

      <style>{`
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
          max-width: 620px;
          max-height: 90vh;
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-xl);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          font-family: var(--font-family-base);
          color: var(--color-text-primary);
        }

        .comanda-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--color-border);
        }

        .comanda-header-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .comanda-icon-badge {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-lg);
          background-color: var(--color-brand-lightest);
          color: var(--color-brand-primary);
          display: flex;
          align-items: center;
          justify-content: center;
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

        .comanda-close-btn {
          width: 32px;
          height: 32px;
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

        .comanda-close-btn:hover {
          background-color: var(--color-error-bg);
          color: var(--color-error);
        }

        .comanda-modal-body {
          flex: 1;
          overflow-y: auto;
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
          padding: 0.85rem;
          border-radius: var(--radius-lg);
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .add-item-title {
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .add-item-row {
          display: flex;
          gap: 0.5rem;
        }

        .btn-link-sm {
          background: none;
          border: none;
          color: var(--color-text-secondary);
          font-size: var(--font-size-xs);
          cursor: pointer;
        }

        .btn-link-sm:hover {
          color: var(--color-text-primary);
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
        }

        .comanda-item-info {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }

        .comanda-item-badge {
          width: 28px;
          height: 28px;
          border-radius: var(--radius-sm);
          background-color: var(--color-bg-secondary);
          color: var(--color-brand-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--color-border);
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
          padding: 0.2rem;
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
        }

        .seg-type-btn {
          border: none;
          background: transparent;
          padding: 0.4rem 0.6rem;
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--color-text-secondary);
          cursor: pointer;
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

        .btn-link-brand {
          background: none;
          border: none;
          color: var(--color-brand-primary);
          font-size: var(--font-size-xs);
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          cursor: pointer;
        }

        .btn-link-brand:hover {
          text-decoration: underline;
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

        .comanda-warning-text {
          font-size: var(--font-size-xs);
          font-weight: 600;
          color: var(--color-warning);
          margin: 0.25rem 0 0 0;
        }

        .comanda-modal-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          padding: 1rem 1.5rem;
          border-top: 1px solid var(--color-border);
          background-color: var(--color-bg-primary);
        }

        .comanda-btn-secondary {
          padding: 0.65rem 1.25rem;
          border-radius: var(--radius-lg);
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
          padding: 0.65rem 1.5rem;
          border-radius: var(--radius-lg);
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
      `}</style>
    </>
  );
};
