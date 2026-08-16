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
import type { Comanda, ComandaItem, MetodoPagamento } from '../../modules/comandas/types';
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

  // Cálculos
  const subtotal = useMemo(() => {
    return itens.reduce((acc, it) => acc + it.quantity * it.unit_price, 0);
  }, [itens]);

  const discountAmount = useMemo(() => {
    if (discountType === 'percent') {
      return Number(((subtotal * (discountValue || 0)) / 100).toFixed(2));
    }
    return Number(Math.min(subtotal, discountValue || 0).toFixed(2));
  }, [subtotal, discountType, discountValue]);

  const totalFinal = useMemo(() => {
    return Math.max(0, Number((subtotal - discountAmount + (tipValue || 0)).toFixed(2)));
  }, [subtotal, discountAmount, tipValue]);

  // Atualizar valor padrão do pagamento quando total mudar
  useEffect(() => {
    if (pagamentos.length === 1) {
      setPagamentos([{ ...pagamentos[0], amount: totalFinal }]);
    }
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
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-checkout-title"
      >
        <div className="bg-[var(--color-bg-primary,#121214)] border border-[var(--color-border-subtle,rgba(255,255,255,0.1))] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl relative text-[var(--color-text-primary,#fff)] font-sans">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-[var(--color-border-subtle,rgba(255,255,255,0.08))]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-primary,#D4AF37)]/15 flex items-center justify-center text-[var(--color-brand-primary,#D4AF37)]">
                <HugeiconsIcon icon={Money01Icon} size={22} />
              </div>
              <div>
                <h3 id="modal-checkout-title" className="text-lg font-bold">
                  Comanda & Checkout
                </h3>
                <p className="text-xs text-[var(--color-text-secondary,#A1A1AA)]">
                  Cliente: <span className="font-semibold text-white">{customerName}</span> {customerPhone && `• ${customerPhone}`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              type="button"
              className="p-1 rounded-lg text-[var(--color-text-secondary,#A1A1AA)] hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Fechar"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={20} />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-[var(--color-error,#EF4444)]/10 border border-[var(--color-error,#EF4444)]/30 text-xs text-[var(--color-error,#EF4444)]">
                {errorMsg}
              </div>
            )}

            {/* Lista de Itens */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary,#A1A1AA)]">
                  Itens Consumidos ({itens.length})
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setIsAddingService(true); setIsAddingProduct(false); }}
                    className="text-xs font-semibold text-[var(--color-brand-primary,#D4AF37)] bg-[var(--color-brand-primary,#D4AF37)]/10 px-2.5 py-1 rounded-lg hover:bg-[var(--color-brand-primary,#D4AF37)]/20 transition-colors flex items-center gap-1"
                  >
                    <HugeiconsIcon icon={PlusSignIcon} size={14} />
                    <span>Serviço</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsAddingProduct(true); setIsAddingService(false); }}
                    className="text-xs font-semibold text-[var(--color-brand-primary,#D4AF37)] bg-[var(--color-brand-primary,#D4AF37)]/10 px-2.5 py-1 rounded-lg hover:bg-[var(--color-brand-primary,#D4AF37)]/20 transition-colors flex items-center gap-1"
                  >
                    <HugeiconsIcon icon={ShoppingBag01Icon} size={14} />
                    <span>Produto</span>
                  </button>
                </div>
              </div>

              {/* Drawer rápido de adicionar serviço */}
              {isAddingService && (
                <div className="mb-3 p-3 bg-white/5 border border-white/10 rounded-xl flex items-center gap-2">
                  <select
                    value={selectedServiceId}
                    onChange={(e) => setSelectedServiceId(e.target.value)}
                    className="flex-1 bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="">Selecione o Serviço...</option>
                    {availableServices.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} - R$ {s.price.toFixed(2)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedProfId}
                    onChange={(e) => setSelectedProfId(e.target.value)}
                    className="flex-1 bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="">Barbeiro Comissionado...</option>
                    {availableProfessionals.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddServiceConfirm}
                    disabled={!selectedServiceId}
                    className="px-3 py-1.5 bg-[var(--color-brand-primary,#D4AF37)] text-black rounded-lg text-xs font-bold disabled:opacity-40"
                  >
                    Adicionar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingService(false)}
                    className="px-2 py-1.5 text-xs text-[var(--color-text-secondary,#A1A1AA)] hover:text-white"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Drawer rápido de adicionar produto */}
              {isAddingProduct && (
                <div className="mb-3 p-3 bg-white/5 border border-white/10 rounded-xl flex items-center gap-2">
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="flex-1 bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="">Selecione o Produto...</option>
                    {catalogProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Estoque: {p.stock_quantity}) - R$ {p.price.toFixed(2)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddProductConfirm}
                    disabled={!selectedProductId}
                    className="px-3 py-1.5 bg-[var(--color-brand-primary,#D4AF37)] text-black rounded-lg text-xs font-bold disabled:opacity-40"
                  >
                    Adicionar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingProduct(false)}
                    className="px-2 py-1.5 text-xs text-[var(--color-text-secondary,#A1A1AA)] hover:text-white"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Tabela / Lista de Itens */}
              <div className="space-y-2">
                {itens.map((it) => (
                  <div
                    key={it.tempId}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-white/5 text-[var(--color-text-secondary,#A1A1AA)]">
                        {it.item_type === 'servico' ? (
                          <HugeiconsIcon icon={ScissorIcon} size={16} />
                        ) : (
                          <HugeiconsIcon icon={ShoppingBag01Icon} size={16} />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{it.name}</p>
                        <p className="text-[11px] text-[var(--color-text-secondary,#A1A1AA)]">
                          {it.quantity}x • R$ {it.unit_price.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-white">
                        R$ {(it.quantity * it.unit_price).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(it.tempId)}
                        className="text-[var(--color-text-secondary,#A1A1AA)] hover:text-[var(--color-error,#EF4444)] transition-colors p-1"
                        aria-label="Remover item"
                      >
                        <HugeiconsIcon icon={Delete02Icon} size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Descontos e Gorjeta */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[var(--color-text-secondary,#A1A1AA)]">
                    Desconto
                  </label>
                  <div className="flex items-center rounded-lg bg-black/40 p-0.5 border border-white/10 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setDiscountType('fixed')}
                      className={`px-2 py-0.5 rounded ${discountType === 'fixed' ? 'bg-[var(--color-brand-primary,#D4AF37)] text-black font-bold' : 'text-gray-400'}`}
                    >
                      R$
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('percent')}
                      className={`px-2 py-0.5 rounded ${discountType === 'percent' ? 'bg-[var(--color-brand-primary,#D4AF37)] text-black font-bold' : 'text-gray-400'}`}
                    >
                      %
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  value={discountValue || ''}
                  onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  className="w-full px-3 py-1.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-secondary,#A1A1AA)] mb-1.5">
                  Gorjeta do Barbeiro (R$)
                </label>
                <input
                  type="number"
                  min="0"
                  value={tipValue || ''}
                  onChange={(e) => setTipValue(parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  className="w-full px-3 py-1.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white"
                />
              </div>
            </div>

            {/* Sumário de Totais */}
            <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-1.5 text-xs">
              <div className="flex justify-between text-[var(--color-text-secondary,#A1A1AA)]">
                <span>Subtotal:</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-[var(--color-error,#EF4444)] font-medium">
                  <span>Desconto aplicado:</span>
                  <span>- R$ {discountAmount.toFixed(2)}</span>
                </div>
              )}
              {tipValue > 0 && (
                <div className="flex justify-between text-[var(--color-success,#0E9F6E)] font-medium">
                  <span>Gorjeta:</span>
                  <span>+ R$ {tipValue.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-white/10">
                <span>Total a Pagar:</span>
                <span className="text-[var(--color-brand-primary,#D4AF37)]">R$ {totalFinal.toFixed(2)}</span>
              </div>
            </div>

            {/* Divisão de Formas de Pagamento */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary,#A1A1AA)]">
                  Pagamento ({pagamentos.length})
                </h4>
                {saldoRestante > 0 && (
                  <button
                    type="button"
                    onClick={handleAddPagamentoLinha}
                    className="text-xs font-semibold text-[var(--color-brand-primary,#D4AF37)] hover:underline flex items-center gap-1"
                  >
                    <HugeiconsIcon icon={PlusSignIcon} size={14} />
                    <span>Dividir Conta</span>
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {pagamentos.map((pag, idx) => {
                  const change = pag.method === 'cash' && pag.receivedCash > pag.amount
                    ? pag.receivedCash - pag.amount
                    : 0;

                  return (
                    <div
                      key={idx}
                      className="p-3 bg-white/[0.02] border border-white/10 rounded-xl space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <select
                          value={pag.method}
                          onChange={(e) => {
                            const newMethod = e.target.value as MetodoPagamento;
                            setPagamentos((prev) =>
                              prev.map((p, i) => (i === idx ? { ...p, method: newMethod } : p))
                            );
                          }}
                          className="bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        >
                          <option value="pix">PIX</option>
                          <option value="credit_card">Cartão de Crédito</option>
                          <option value="debit_card">Cartão de Débito</option>
                          <option value="cash">Dinheiro</option>
                          <option value="other">Outro</option>
                        </select>

                        <div className="flex-1 relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--color-text-secondary,#A1A1AA)]">
                            R$
                          </span>
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
                            className="w-full pl-7 pr-2 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs font-bold text-white"
                          />
                        </div>

                        {pagamentos.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemovePagamentoLinha(idx)}
                            className="p-1 text-[var(--color-text-secondary,#A1A1AA)] hover:text-red-400"
                          >
                            <HugeiconsIcon icon={Delete02Icon} size={16} />
                          </button>
                        )}
                      </div>

                      {pag.method === 'cash' && (
                        <div className="flex items-center gap-4 pt-1 border-t border-white/5 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[var(--color-text-secondary,#A1A1AA)]">Recebido: R$</span>
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
                              className="w-20 px-2 py-0.5 bg-black/60 border border-white/10 rounded text-xs text-white"
                            />
                          </div>
                          {change > 0 && (
                            <div className="text-[var(--color-brand-primary,#D4AF37)] font-bold">
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
                <p className="mt-2 text-xs text-[var(--color-warning,#F59E0B)] font-medium">
                  Faltam R$ {saldoRestante.toFixed(2)} para cobrir o total da comanda.
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[var(--color-border-subtle,rgba(255,255,255,0.08))] flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-5 rounded-xl border border-[var(--color-border-subtle,rgba(255,255,255,0.15))] text-sm font-semibold text-[var(--color-text-secondary,#A1A1AA)] hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isSubmitting || saldoRestante > 0 || itens.length === 0}
              onClick={handleFinalizar}
              className="py-2.5 px-6 rounded-xl bg-[var(--color-brand-primary,#D4AF37)] text-black text-sm font-bold flex items-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
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
    </>
  );
};
