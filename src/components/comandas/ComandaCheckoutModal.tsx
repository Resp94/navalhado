import React, { useEffect, useMemo, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Delete02Icon,
  ScissorIcon,
  ShoppingBag01Icon,
  QrCodeIcon,
  CreditCardIcon,
  CreditCardPosIcon,
  Money01Icon,
  Invoice01Icon,
  Coins01Icon,
  Discount01Icon,
  AlertCircleIcon,
  UserIcon,
  WhatsappIcon,
  Calendar02Icon,
} from '@hugeicons/core-free-icons';
import { ComandaRepository } from '../../modules/comandas/ComandaRepository';
import { SupabaseComandaAdapter } from '../../modules/comandas/adapters/SupabaseComandaAdapter';
import { CaixaRepository } from '../../modules/caixa/CaixaRepository';
import { SupabaseCaixaAdapter } from '../../modules/caixa/adapters/SupabaseCaixaAdapter';
import { ProdutoRepository } from '../../modules/produtos/ProdutoRepository';
import { SupabaseProdutoAdapter } from '../../modules/produtos/adapters/SupabaseProdutoAdapter';
import { openWhatsApp } from '../../lib/whatsapp';
import { supabase } from '../../lib/supabase';
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
  comandaId?: string | null;
  appointmentId?: string | null;
  appointmentStartTime?: string | null;
  appointmentServiceName?: string | null;
  appointmentIsFitting?: boolean | null;
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

const mapInitialServices = (
  services?: Array<{ service_id: string; name: string; price: number; professional_id?: string | null }>
): ItemLocal[] => {
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

const methodConfigs: Record<
  MetodoPagamento,
  { label: string; icon: any; shortLabel?: string }
> = {
  pix: { label: 'PIX', icon: QrCodeIcon },
  credit_card: { label: 'Cartão de crédito', icon: CreditCardIcon, shortLabel: 'Crédito' },
  debit_card: { label: 'Cartão de débito', icon: CreditCardPosIcon, shortLabel: 'Débito' },
  cash: { label: 'Dinheiro', icon: Money01Icon },
  other: { label: 'Outro', icon: Invoice01Icon },
};

export const ComandaCheckoutModal: React.FC<ComandaCheckoutModalProps> = ({
  isOpen,
  tenantId,
  comandaId: initialComandaId = null,
  appointmentId,
  appointmentStartTime,
  appointmentServiceName,
  appointmentIsFitting,
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

  const [comandaId, setComandaId] = useState<string | null>(initialComandaId);
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
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const initialServicesKey = useMemo(() => {
    return (initialServices || []).map((s) => `${s.service_id}:${s.price}`).join('|');
  }, [initialServices]);

  // Bloqueio de scroll do body e listener da tecla Escape
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (cancelConfirmOpen) {
          setCancelConfirmOpen(false);
        } else if (reopenConfirmOpen) {
          setReopenConfirmOpen(false);
        } else if (isAddingService) {
          setIsAddingService(false);
        } else if (isAddingProduct) {
          setIsAddingProduct(false);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, cancelConfirmOpen, reopenConfirmOpen, isAddingService, isAddingProduct, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    // Reset de estados
    setIsLoadingComanda(true);
    setLoadedComanda(null);
    setDiscountValue(0);
    setTipValue(0);
    setIsSplitting(false);
    setReopenConfirmOpen(false);
    setCancelConfirmOpen(false);
    setErrorMsg(null);
    setIsAddingService(false);
    setIsAddingProduct(false);

    // Carregar catálogo de produtos
    prodRepo.listActive(tenantId).then(setCatalogProducts).catch(console.error);

    // Carregar sessão de caixa ativa
    cxaRepo.getActiveSession(tenantId).then(setActiveSession).catch(console.error);

    // Inicializar itens da comanda
    const fetchExistingComanda = initialComandaId
      ? comRepo.getById(initialComandaId)
      : appointmentId
      ? comRepo.getByAppointmentId(appointmentId)
      : Promise.resolve(null);

    fetchExistingComanda
      .then((existing) => {
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
          setItens(mapInitialServices(initialServices));
        }
      })
      .catch((err) => {
        console.error('Erro ao verificar comanda existente:', err);
        setItens(mapInitialServices(initialServices));
      })
      .finally(() => {
        setIsLoadingComanda(false);
      });
  }, [isOpen, initialComandaId, appointmentId, tenantId, initialServicesKey, comRepo, cxaRepo, prodRepo]);

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

  const handleCancelComandaEAgendamento = async () => {
    setIsCanceling(true);
    setErrorMsg(null);
    try {
      const targetAppointmentId = appointmentId || loadedComanda?.appointment_id;
      const targetComandaId = comandaId || loadedComanda?.id;

      if (targetAppointmentId) {
        const { error: apptErr } = await supabase
          .from('appointments')
          .update({
            status: 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetAppointmentId);
        if (apptErr) throw apptErr;
      }

      if (targetComandaId) {
        const { error: cmdErr } = await supabase
          .from('comandas')
          .update({
            status: 'cancelada',
            closed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetComandaId);
        if (cmdErr) throw cmdErr;
      }

      if (onFinalizado && loadedComanda) {
        onFinalizado({ ...loadedComanda, status: 'cancelada' });
      }
      onClose();
    } catch (err: any) {
      console.error('Erro ao cancelar comanda e agendamento:', err);
      setErrorMsg(err?.message || 'Erro ao cancelar atendimento.');
    } finally {
      setIsCanceling(false);
      setCancelConfirmOpen(false);
    }
  };

  return (
    <>
      <div
        className="comanda-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-checkout-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="comanda-modal-shell">
          <div className="comanda-modal-card">
            {/* Header com Double-Bezel e Detalhes da Comanda */}
            <div className="comanda-modal-header">
              <div className="comanda-modal-header-info">
                <div className="comanda-modal-badge-wrapper">
                  <div className="comanda-header-icon-badge">
                    <HugeiconsIcon icon={Invoice01Icon} size={18} />
                  </div>
                  <div>
                    <div className="comanda-header-title-row">
                      <h3 id="modal-checkout-title" className="comanda-modal-title">
                        {loadedComanda?.comanda_number
                          ? `Comanda #${loadedComanda.comanda_number}`
                          : 'Comanda de atendimento'}
                      </h3>
                      <span
                        className={`comanda-status-pill ${
                          isClosed ? 'comanda-status-pill--closed' : 'comanda-status-pill--open'
                        }`}
                      >
                        {isClosed ? 'Liquidada' : 'Em aberto'}
                      </span>
                    </div>
                    <div className="comanda-modal-subtitle">
                      <span className="comanda-subtitle-customer">
                        <HugeiconsIcon icon={UserIcon} size={13} className="inline-user-icon" />
                        <span>
                          Cliente: <strong>{customerName}</strong>
                        </span>
                      </span>
                      {customerPhone && (
                        <button
                          type="button"
                          onClick={() => {
                            openWhatsApp(customerPhone, `Olá ${customerName}, tudo bem? Falamos da barbearia.`);
                          }}
                          className="comanda-customer-phone-tag comanda-customer-phone-btn"
                          title="Abrir conversa no WhatsApp com o cliente"
                        >
                          <HugeiconsIcon icon={WhatsappIcon} size={13} className="inline-phone-icon" />
                          <span>{customerPhone}</span>
                        </button>
                      )}
                      {appointmentId ? (
                        <span
                          className="comanda-customer-phone-tag"
                          style={{
                            backgroundColor: appointmentIsFitting ? 'rgba(217, 108, 0, 0.12)' : 'rgba(217, 108, 0, 0.08)',
                            borderColor: 'rgba(217, 108, 0, 0.25)',
                            color: 'var(--color-brand-primary)',
                          }}
                          title="Comanda gerada a partir de agendamento da agenda"
                        >
                          <HugeiconsIcon icon={Calendar02Icon} size={13} style={{ color: 'var(--color-brand-primary)' }} />
                          <span>
                            {appointmentIsFitting ? 'Encaixe' : 'Agendamento'}
                            {appointmentStartTime
                              ? `: ${new Date(appointmentStartTime).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${new Date(appointmentStartTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                              : ''}
                            {appointmentServiceName ? ` • ${appointmentServiceName}` : ''}
                          </span>
                        </span>
                      ) : (
                        <span
                          className="comanda-customer-phone-tag"
                          style={{
                            backgroundColor: 'rgba(45, 35, 30, 0.04)',
                            color: 'var(--color-text-secondary)',
                          }}
                          title="Comanda aberta diretamente no balcão"
                        >
                          <span>Atendimento Balcão / Avulsa</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
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
              <div className="comanda-reopen-confirm-card" role="alert">
                <div className="comanda-reopen-content">
                  <div className="comanda-reopen-icon">
                    <HugeiconsIcon icon={AlertCircleIcon} size={18} />
                  </div>
                  <div>
                    <h4 className="comanda-reopen-title">Deseja realmente reabrir esta comanda?</h4>
                    <p className="comanda-reopen-desc">
                      Ao reabrir, os pagamentos registrados serão estornados e a comanda voltará para o status de edição.
                    </p>
                  </div>
                </div>
                <div className="comanda-reopen-actions">
                  <button
                    type="button"
                    onClick={() => setReopenConfirmOpen(false)}
                    className="comanda-btn-ghost-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isReopening}
                    onClick={handleReopenComanda}
                    className="comanda-btn-warning-sm"
                  >
                    {isReopening ? 'Reabrindo...' : 'Confirmar reabertura'}
                  </button>
                </div>
              </div>
            )}

            {/* Banner de Confirmação de Cancelamento */}
            {cancelConfirmOpen && (
              <div className="comanda-cancel-confirm-card" role="alert">
                <div className="comanda-reopen-content">
                  <div className="comanda-reopen-icon comanda-reopen-icon--danger">
                    <HugeiconsIcon icon={Cancel01Icon} size={18} />
                  </div>
                  <div>
                    <h4 className="comanda-reopen-title">Cancelar este agendamento e comanda?</h4>
                    <p className="comanda-reopen-desc">
                      O agendamento será cancelado na grade e a comanda aberta correspondente será cancelada automaticamente.
                    </p>
                  </div>
                </div>
                <div className="comanda-reopen-actions">
                  <button
                    type="button"
                    onClick={() => setCancelConfirmOpen(false)}
                    className="comanda-btn-ghost-sm"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    disabled={isCanceling}
                    onClick={handleCancelComandaEAgendamento}
                    className="comanda-btn-danger-sm"
                  >
                    {isCanceling ? 'Cancelando...' : 'Confirmar cancelamento'}
                  </button>
                </div>
              </div>
            )}

            {/* Body */}
            <div className="comanda-modal-body">
              {isLoadingComanda ? (
                <div className="comanda-loading-state">
                  <div className="comanda-spinner" />
                  <p className="comanda-loading-text">Carregando dados da comanda...</p>
                </div>
              ) : (
                <>
                  {/* Mensagem de Erro / Validação */}
                  {errorMsg && (
                    <div className="comanda-error-alert" role="alert">
                      <HugeiconsIcon icon={AlertCircleIcon} size={16} />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {/* Banner de Comanda Fechada / Liquidada (Modo Recibo) */}
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
                              Fechado em {new Date(loadedComanda.closed_at).toLocaleDateString('pt-BR')} às{' '}
                              {new Date(loadedComanda.closed_at).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="comanda-receipt-badge">Recibo</span>
                    </div>
                  )}

                  {/* Seção 1: Itens Consumidos */}
                  <div className="comanda-section">
                    <div className="comanda-section-header">
                      <div className="comanda-section-title-wrap">
                        <h4 className="comanda-section-title">Itens consumidos</h4>
                        <span className="comanda-section-count-badge">{itens.length}</span>
                      </div>
                      {!isClosed && (
                        <div className="comanda-section-actions">
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingService((prev) => !prev);
                              setIsAddingProduct(false);
                            }}
                            className={`btn-add-item ${isAddingService ? 'btn-add-item--active' : ''}`}
                            aria-expanded={isAddingService}
                          >
                            <HugeiconsIcon icon={ScissorIcon} size={14} />
                            <span>Serviço</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingProduct((prev) => !prev);
                              setIsAddingService(false);
                            }}
                            className={`btn-add-item ${isAddingProduct ? 'btn-add-item--active' : ''}`}
                            aria-expanded={isAddingProduct}
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
                          <span className="add-item-title">Adicionar novo serviço</span>
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
                            aria-label="Selecionar serviço"
                          >
                            <option value="">Selecione o serviço...</option>
                            {availableServices.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} • R$ {s.price.toFixed(2)}
                              </option>
                            ))}
                          </select>

                          <select
                            value={selectedProfId}
                            onChange={(e) => setSelectedProfId(e.target.value)}
                            className="comanda-select flex-1"
                            aria-label="Selecionar profissional"
                          >
                            <option value="">Profissional (opcional)...</option>
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
                          <span className="add-item-title">Adicionar produto do estoque</span>
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
                            aria-label="Selecionar produto"
                          >
                            <option value="">Selecione o produto...</option>
                            {catalogProducts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} • R$ {p.price.toFixed(2)} (Estoque: {p.stock_quantity ?? 0})
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
                      {itens.length === 0 ? (
                        <div className="comanda-empty-items">
                          <p>Nenhum item adicionado à comanda ainda.</p>
                        </div>
                      ) : (
                        itens.map((it) => (
                          <div key={it.tempId} className="comanda-item-card">
                            <div className="comanda-item-info">
                              <div
                                className={`comanda-item-icon-tag ${
                                  it.item_type === 'servico'
                                    ? 'comanda-item-icon-tag--service'
                                    : 'comanda-item-icon-tag--product'
                                }`}
                              >
                                <HugeiconsIcon
                                  icon={it.item_type === 'servico' ? ScissorIcon : ShoppingBag01Icon}
                                  size={16}
                                />
                              </div>
                              <div className="comanda-item-text-group">
                                <strong className="comanda-item-name">{it.name}</strong>
                                <div className="comanda-item-detail">
                                  <span className="comanda-type-tag">
                                    {it.item_type === 'servico' ? 'Serviço' : 'Produto'}
                                  </span>
                                  <span>• {it.quantity}x</span>
                                  <span>• R$ {it.unit_price.toFixed(2)}</span>
                                  {it.professional_id &&
                                    availableProfessionals.find((p) => p.id === it.professional_id) && (
                                      <span className="comanda-prof-tag">
                                        • {availableProfessionals.find((p) => p.id === it.professional_id)?.name}
                                      </span>
                                    )}
                                </div>
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
                                  aria-label={`Remover ${it.name}`}
                                >
                                  <HugeiconsIcon icon={Delete02Icon} size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Seção 2: Desconto e Gorjeta (Apenas editável se aberta) */}
                  {!isClosed && (
                    <div className="comanda-discount-tip-grid">
                      <div className="comanda-form-group">
                        <label className="comanda-label">
                          <HugeiconsIcon icon={Discount01Icon} size={14} className="label-icon" />
                          <span>Desconto</span>
                        </label>
                        <div className="comanda-input-segmented-wrapper">
                          <div className="comanda-segmented-type" role="radiogroup" aria-label="Tipo de desconto">
                            <button
                              type="button"
                              className={`seg-type-btn ${discountType === 'fixed' ? 'seg-type-btn--active' : ''}`}
                              onClick={() => setDiscountType('fixed')}
                              aria-label="Desconto em valor monetário"
                            >
                              R$
                            </button>
                            <button
                              type="button"
                              className={`seg-type-btn ${discountType === 'percent' ? 'seg-type-btn--active' : ''}`}
                              onClick={() => setDiscountType('percent')}
                              aria-label="Desconto em porcentagem"
                            >
                              %
                            </button>
                          </div>
                          <input
                            type="number"
                            min="0"
                            step={discountType === 'percent' ? '1' : '0.01'}
                            value={discountValue || ''}
                            onChange={(e) => setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
                            placeholder="0,00"
                            className="comanda-input-num"
                            aria-label="Valor do desconto"
                          />
                        </div>
                      </div>

                      <div className="comanda-form-group">
                        <label className="comanda-label">
                          <HugeiconsIcon icon={Coins01Icon} size={14} className="label-icon" />
                          <span>Gorjeta</span>
                        </label>
                        <div className="comanda-input-prefix-wrapper">
                          <span className="comanda-input-prefix">R$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={tipValue || ''}
                            onChange={(e) => setTipValue(Math.max(0, parseFloat(e.target.value) || 0))}
                            placeholder="0,00"
                            className="comanda-input-num comanda-input-num--prefixed"
                            aria-label="Valor da gorjeta"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Seção 3: Sumário de Totais (Estilo Recibo de Luxo) */}
                  <div className="comanda-summary-box">
                    <div className="summary-row">
                      <span className="summary-label">Subtotal</span>
                      <span className="summary-value">R$ {subtotal.toFixed(2)}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="summary-row summary-discount">
                        <span className="summary-label">
                          Desconto {discountType === 'percent' ? `(${discountValue}%)` : ''}
                        </span>
                        <span className="summary-value">- R$ {discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    {tipValue > 0 && (
                      <div className="summary-row summary-tip">
                        <span className="summary-label">Gorjeta</span>
                        <span className="summary-value">+ R$ {tipValue.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="summary-divider" />
                    <div className="summary-row summary-total">
                      <span className="summary-total-label">
                        {isClosed ? 'Total liquidado' : 'Total a pagar'}
                      </span>
                      <span className="summary-total-value">R$ {totalFinal.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Seção 4: Formas de Pagamento */}
                  <div className="comanda-section">
                    <div className="comanda-section-header">
                      <div className="comanda-section-title-wrap">
                        <h4 className="comanda-section-title">
                          {isClosed ? 'Pagamentos registrados' : 'Forma de pagamento'}
                        </h4>
                      </div>
                      {!isClosed && !isSplitting && (
                        <button
                          type="button"
                          onClick={handleEnableSplit}
                          className="btn-split-toggle"
                        >
                          Dividir pagamento
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
                        {pagamentos.map((pag, idx) => {
                          const conf = methodConfigs[pag.method] || { label: pag.method, icon: Invoice01Icon };
                          const IconComp = conf.icon;
                          return (
                            <div key={idx} className="payment-receipt-row">
                              <span className="payment-receipt-method">
                                <span className="payment-receipt-icon">
                                  <HugeiconsIcon icon={IconComp} size={16} />
                                </span>
                                <span>{conf.label}</span>
                              </span>
                              <strong className="payment-receipt-amount">
                                R$ {pag.amount.toFixed(2)}
                              </strong>
                            </div>
                          );
                        })}
                      </div>
                    ) : !isSplitting ? (
                      /* Modo Pagamento Único: Botões de Acesso Rápido com Ícones */
                      <div className="single-payment-container">
                        <div className="quick-methods-grid">
                          {(['pix', 'credit_card', 'debit_card', 'cash'] as MetodoPagamento[]).map((m) => {
                            const conf = methodConfigs[m];
                            const IconComp = conf.icon;
                            const isSelected = pagamentos[0]?.method === m;
                            return (
                              <button
                                key={m}
                                type="button"
                                onClick={() => handleSelectSingleMethod(m)}
                                className={`btn-quick-method ${isSelected ? 'btn-quick-method--active' : ''}`}
                              >
                                <HugeiconsIcon icon={IconComp} size={18} className="quick-method-icon" />
                                <span className="quick-method-text">{conf.shortLabel || conf.label}</span>
                              </button>
                            );
                          })}
                        </div>

                        {pagamentos[0]?.method === 'cash' && (
                          <div className="cash-single-calculator">
                            <div className="cash-quick-notes">
                              <span className="cash-notes-label">Cédulas rápidas:</span>
                              <button
                                type="button"
                                className={`btn-quick-note ${
                                  pagamentos[0]?.receivedCash === totalFinal ? 'btn-quick-note--active' : ''
                                }`}
                                onClick={() =>
                                  setPagamentos([{ ...pagamentos[0], receivedCash: totalFinal }])
                                }
                              >
                                Exato
                              </button>
                              {[50, 100, 200].map((note) => {
                                if (note < totalFinal) return null;
                                return (
                                  <button
                                    key={note}
                                    type="button"
                                    className={`btn-quick-note ${
                                      pagamentos[0]?.receivedCash === note ? 'btn-quick-note--active' : ''
                                    }`}
                                    onClick={() =>
                                      setPagamentos([{ ...pagamentos[0], receivedCash: note }])
                                    }
                                  >
                                    R$ {note}
                                  </button>
                                );
                              })}
                            </div>

                            <label className="cash-input-field">
                              <span className="cash-input-label">Valor entregue pelo cliente:</span>
                              <div className="cash-input-wrap">
                                <span className="cash-prefix">R$</span>
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
                                  placeholder="0,00"
                                />
                              </div>
                            </label>

                            {pagamentos[0]?.receivedCash > totalFinal && (
                              <div className="cash-change-badge">
                                <div className="cash-change-left">
                                  <HugeiconsIcon icon={Coins01Icon} size={18} />
                                  <span>Troco a devolver:</span>
                                </div>
                                <strong className="cash-change-val">
                                  R$ {(pagamentos[0].receivedCash - totalFinal).toFixed(2)}
                                </strong>
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
                            const change =
                              pag.method === 'cash' && pag.receivedCash > pag.amount
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
                                        prev.map((p, i) =>
                                          i === idx ? { ...p, method: newMethod } : p
                                        )
                                      );
                                    }}
                                    className="comanda-select payment-method-select"
                                    aria-label="Forma de pagamento"
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
                                          prev.map((p, i) =>
                                            i === idx
                                              ? { ...p, amount: val, receivedCash: Math.max(val, p.receivedCash) }
                                              : p
                                          )
                                        );
                                      }}
                                      className="payment-amount-input"
                                      aria-label="Valor desta forma"
                                    />
                                  </div>

                                  {pagamentos.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemovePagamentoLinha(idx)}
                                      className="btn-remove-payment"
                                      title="Remover forma de pagamento"
                                      aria-label="Remover forma de pagamento"
                                    >
                                      <HugeiconsIcon icon={Delete02Icon} size={16} />
                                    </button>
                                  )}
                                </div>

                                {pag.method === 'cash' && (
                                  <div className="cash-change-calculator">
                                    <label className="cash-input-field-compact">
                                      <span>Recebido: R$</span>
                                      <input
                                        type="number"
                                        min={pag.amount}
                                        step="0.01"
                                        value={pag.receivedCash || ''}
                                        onChange={(e) => {
                                          const val = parseFloat(e.target.value) || 0;
                                          setPagamentos((prev) =>
                                            prev.map((p, i) =>
                                              i === idx ? { ...p, receivedCash: val } : p
                                            )
                                          );
                                        }}
                                        className="cash-received-input-compact"
                                      />
                                    </label>
                                    {change > 0 && (
                                      <div className="cash-change-badge-compact">
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
                            <HugeiconsIcon icon={Invoice01Icon} size={15} />
                            <span>+ Adicionar outra forma de pagamento</span>
                          </button>
                          <div className="split-summary-bar">
                            <div className="split-summary-info">
                              <span>Total: <strong>R$ {totalFinal.toFixed(2)}</strong></span>
                              <span className="comanda-separator-bullet">•</span>
                              <span>Pago: <strong>R$ {totalPago.toFixed(2)}</strong></span>
                            </div>
                            {saldoRestante > 0 ? (
                              <span className="split-missing-alert">
                                Falta: R$ {saldoRestante.toFixed(2)}
                              </span>
                            ) : (
                              <span className="split-complete-alert">
                                ✓ Valor total coberto
                              </span>
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
                <div className="comanda-footer-closed-actions">
                  <button
                    type="button"
                    onClick={() => setReopenConfirmOpen(true)}
                    disabled={isReopening}
                    className="comanda-btn-reopen"
                  >
                    <HugeiconsIcon icon={AlertCircleIcon} size={16} />
                    <span>{isReopening ? 'Reabrindo...' : 'Reabrir comanda'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="comanda-btn-primary"
                  >
                    Fechar
                  </button>
                </div>
              ) : (
                <div className="comanda-footer-open-actions">
                  <div className="comanda-footer-left-actions">
                    <button
                      type="button"
                      onClick={() => setCancelConfirmOpen(true)}
                      className="comanda-btn-danger-outline"
                      title="Cancelar este agendamento e comanda"
                    >
                      Cancelar atendimento
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="comanda-btn-secondary"
                    >
                      Fechar
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={isSubmitting || saldoRestante > 0 || itens.length === 0}
                    onClick={handleFinalizar}
                    className="comanda-btn-primary"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="comanda-btn-spinner" />
                        <span>Processando...</span>
                      </>
                    ) : (
                      <>
                        <span>Finalizar e receber</span>
                        <span className="comanda-btn-amount-badge">R$ {totalFinal.toFixed(2)}</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
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
          0% {
            opacity: 0;
            transform: translateY(16px) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes slideUpMobile {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
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
          padding: 1.25rem;
          animation: fadeIn 0.25s cubic-bezier(0.32, 0.72, 0, 1);
        }

        /* Double-Bezel Container */
        .comanda-modal-shell {
          width: 100%;
          max-width: 620px;
          max-height: calc(100dvh - 2.5rem);
          display: flex;
          flex-direction: column;
          padding: 4px;
          border-radius: calc(var(--radius-xl) + 4px);
          background: rgba(20, 17, 15, 0.08);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.2),
            0 24px 56px -12px rgba(20, 17, 15, 0.35),
            var(--shadow-xl);
          animation: slideUpModal 0.28s cubic-bezier(0.16, 1, 0.3, 1) both;
          box-sizing: border-box;
          font-family: var(--font-family-base);
        }

        .comanda-modal-card {
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl);
          width: 100%;
          max-height: 100%;
          display: flex;
          flex-direction: column;
          box-shadow:
            inset 0 1px 1px rgba(255, 255, 255, 0.6),
            var(--shadow-lg);
          overflow: hidden;
          color: var(--color-text-primary);
        }

        /* Header */
        .comanda-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--color-border);
          background: linear-gradient(to bottom, var(--color-bg-secondary), var(--color-bg-primary));
          flex-shrink: 0;
        }

        .comanda-modal-header-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .comanda-modal-badge-wrapper {
          display: flex;
          align-items: center;
          gap: 0.85rem;
        }

        .comanda-header-icon-badge {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-md);
          background-color: var(--color-brand-lightest);
          color: var(--color-brand-primary);
          border: 1px solid var(--color-brand-soft);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: var(--shadow-sm);
        }

        .comanda-header-title-row {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          flex-wrap: wrap;
        }

        .comanda-modal-title {
          font-size: var(--font-size-lg);
          font-weight: 700;
          color: var(--color-text-primary);
          margin: 0;
          letter-spacing: -0.01em;
        }

        .comanda-status-pill {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 0.2rem 0.55rem;
          border-radius: var(--radius-full);
          line-height: 1.2;
        }

        .comanda-status-pill--open {
          background-color: var(--color-warning-bg);
          color: var(--color-warning);
          border: 1px solid var(--color-warning);
        }

        .comanda-status-pill--closed {
          background-color: var(--color-success-bg);
          color: var(--color-success);
          border: 1px solid var(--color-success);
        }

        .comanda-modal-subtitle {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          margin: 0.35rem 0 0 0;
          display: flex;
          align-items: center;
          gap: 0.6rem;
          flex-wrap: wrap;
        }

        .comanda-subtitle-customer {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          color: var(--color-text-secondary);
        }

        .comanda-subtitle-customer strong {
          color: var(--color-text-primary);
          font-weight: 700;
        }

        .comanda-customer-phone-tag {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          color: var(--color-text-primary);
          font-weight: 700;
          font-size: 0.75rem;
          background-color: var(--color-bg-primary);
          padding: 0.2rem 0.6rem;
          border-radius: var(--radius-sm);
          border: 1px solid var(--color-border);
          letter-spacing: 0.01em;
        }

        .comanda-customer-phone-btn {
          cursor: pointer;
          transition: all 0.2s ease;
          user-select: none;
        }

        .comanda-customer-phone-btn:hover {
          background-color: rgba(16, 185, 129, 0.12);
          border-color: var(--color-success);
          color: var(--color-success);
        }

        .comanda-customer-phone-btn:active {
          transform: scale(0.97);
        }

        .inline-phone-icon {
          color: var(--color-success);
          flex-shrink: 0;
        }

        .inline-user-icon {
          color: var(--color-brand-primary);
          flex-shrink: 0;
        }

        .comanda-separator-bullet {
          color: var(--color-text-secondary);
          opacity: 0.5;
        }

        .comanda-btn-close {
          width: 38px;
          height: 38px;
          border-radius: var(--radius-full);
          border: 1px solid transparent;
          background: transparent;
          color: var(--color-text-secondary);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.32, 0.72, 0, 1);
          flex-shrink: 0;
        }

        .comanda-btn-close:hover {
          background-color: var(--color-error-bg);
          color: var(--color-error);
          border-color: var(--color-error);
          transform: scale(1.05);
        }

        /* Banner de Reabertura */
        .comanda-reopen-confirm-card {
          margin: 1rem 1.5rem 0;
          padding: 0.9rem 1.15rem;
          border-radius: var(--radius-lg);
          background-color: var(--color-warning-bg);
          border: 1px solid var(--color-warning);
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          animation: fadeIn 0.2s ease-out;
        }

        .comanda-reopen-content {
          display: flex;
          align-items: flex-start;
          gap: 0.65rem;
        }

        .comanda-reopen-icon {
          color: var(--color-warning);
          margin-top: 0.1rem;
          flex-shrink: 0;
        }

        .comanda-reopen-title {
          font-size: var(--font-size-sm);
          font-weight: 700;
          color: var(--color-text-primary);
          margin: 0;
        }

        .comanda-reopen-desc {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          margin: 0.2rem 0 0 0;
          line-height: 1.4;
        }

        .comanda-reopen-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.5rem;
        }

        .comanda-btn-ghost-sm {
          padding: 0.35rem 0.75rem;
          font-size: var(--font-size-xs);
          font-weight: 600;
          background: transparent;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .comanda-btn-ghost-sm:hover {
          background-color: var(--color-bg-secondary);
          color: var(--color-text-primary);
        }

        .comanda-btn-warning-sm {
          padding: 0.4rem 0.9rem;
          font-size: var(--font-size-xs);
          font-weight: 700;
          background-color: var(--color-warning);
          color: white;
          border: none;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .comanda-btn-warning-sm:hover:not(:disabled) {
          filter: brightness(0.92);
          transform: translateY(-1px);
        }

        .comanda-cancel-confirm-card {
          margin: 1rem 1.5rem 0;
          padding: 0.9rem 1.15rem;
          border-radius: var(--radius-lg);
          background-color: var(--color-error-bg, rgba(239, 68, 68, 0.08));
          border: 1px solid var(--color-error, #ef4444);
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          animation: fadeIn 0.2s ease-out;
        }

        .comanda-reopen-icon--danger {
          color: var(--color-error, #ef4444);
        }

        .comanda-btn-danger-sm {
          padding: 0.4rem 0.9rem;
          font-size: var(--font-size-xs);
          font-weight: 700;
          background-color: var(--color-error, #ef4444);
          color: white;
          border: none;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .comanda-btn-danger-sm:hover:not(:disabled) {
          filter: brightness(0.92);
          transform: translateY(-1px);
        }

        /* Body */
        .comanda-modal-body {
          flex: 1;
          overflow-y: auto;
          overscroll-behavior: contain;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.35rem;
        }

        .comanda-loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4rem 1rem;
          gap: 1rem;
          min-height: 280px;
        }

        .comanda-spinner {
          width: 34px;
          height: 34px;
          border: 3px solid var(--color-brand-soft);
          border-top-color: var(--color-brand-primary);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .comanda-loading-text {
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
          font-weight: 600;
        }

        .comanda-error-alert {
          padding: 0.85rem 1.15rem;
          border-radius: var(--radius-md);
          background-color: var(--color-error-bg);
          border: 1px solid var(--color-error);
          color: var(--color-error);
          font-size: var(--font-size-xs);
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .comanda-closed-badge-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.9rem 1.25rem;
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
          width: 38px;
          height: 38px;
          border-radius: var(--radius-full);
          background-color: white;
          color: var(--color-success);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: var(--shadow-sm);
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
          padding: 0.3rem 0.75rem;
          border-radius: var(--radius-full);
          background-color: var(--color-success);
          color: white;
          flex-shrink: 0;
          box-shadow: var(--shadow-sm);
        }

        /* Seção Geral */
        .comanda-section {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .comanda-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          width: 100%;
        }

        .comanda-section-title-wrap {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          flex-shrink: 0;
        }

        .comanda-section-title {
          font-size: var(--font-size-xs);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-secondary);
          margin: 0;
          line-height: 1;
          display: inline-flex;
          align-items: center;
        }

        .comanda-section-count-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          height: 20px;
          padding: 0 0.35rem;
          font-size: 0.72rem;
          font-weight: 800;
          border-radius: var(--radius-full);
          background-color: var(--color-brand-deep);
          color: #FFF1E6;
          line-height: 1;
          box-sizing: border-box;
          box-shadow: 0 1px 2px rgba(20, 17, 15, 0.15);
        }

        .comanda-section-actions {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
        }

        .btn-add-item {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.45rem 0.85rem;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border);
          background-color: var(--color-bg-primary);
          color: var(--color-brand-primary);
          font-size: var(--font-size-xs);
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.32, 0.72, 0, 1);
        }

        .btn-add-item:hover,
        .btn-add-item--active {
          background-color: var(--color-brand-lightest);
          border-color: var(--color-brand-soft);
          color: var(--color-brand-deep);
          transform: translateY(-1px);
          box-shadow: var(--shadow-sm);
        }

        /* Caixas de Adição */
        .add-item-box {
          padding: 1rem;
          border-radius: var(--radius-lg);
          background-color: var(--color-bg-primary);
          border: 1.5px solid var(--color-brand-soft);
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          animation: fadeIn 0.2s ease-out;
          box-shadow: var(--shadow-sm);
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
          color: var(--color-brand-deep);
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
          align-items: center;
        }

        .btn-confirm-item {
          padding: 0.5rem 1rem;
          border-radius: var(--radius-md);
          border: none;
          background-color: var(--color-brand-primary);
          color: white;
          font-size: var(--font-size-xs);
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s ease;
        }

        .btn-confirm-item:hover:not(:disabled) {
          background-color: var(--color-brand-hover);
          transform: translateY(-1px);
        }

        .btn-confirm-item:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Lista de Itens */
        .comanda-items-list {
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
        }

        .comanda-empty-items {
          padding: 1.5rem;
          text-align: center;
          background-color: var(--color-bg-primary);
          border: 1px dashed var(--color-border);
          border-radius: var(--radius-md);
          color: var(--color-text-secondary);
          font-size: var(--font-size-xs);
        }

        .comanda-item-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          border-radius: var(--radius-lg);
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          transition: all 0.2s ease;
        }

        .comanda-item-card:hover {
          border-color: var(--color-brand-soft);
          background-color: var(--color-bg-secondary);
          box-shadow: var(--shadow-sm);
        }

        .comanda-item-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          min-width: 0;
        }

        .comanda-item-icon-tag {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-md);
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .comanda-item-icon-tag--service {
          color: var(--color-brand-primary);
        }

        .comanda-item-icon-tag--product {
          color: var(--color-warning);
        }

        .comanda-item-text-group {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          min-width: 0;
        }

        .comanda-item-name {
          font-size: var(--font-size-sm);
          font-weight: 700;
          color: var(--color-text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .comanda-item-detail {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.72rem;
          color: var(--color-text-secondary);
          flex-wrap: wrap;
        }

        .comanda-type-tag {
          font-weight: 700;
          color: var(--color-brand-deep);
        }

        .comanda-prof-tag {
          color: var(--color-text-secondary);
        }

        .comanda-item-right {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          flex-shrink: 0;
        }

        .comanda-item-total {
          font-size: var(--font-size-sm);
          font-weight: 800;
          color: var(--color-text-primary);
        }

        .comanda-item-remove-btn {
          background: transparent;
          border: 1px solid transparent;
          color: var(--color-text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: var(--radius-md);
          transition: all 0.2s ease;
        }

        .comanda-item-remove-btn:hover {
          color: var(--color-error);
          background-color: var(--color-error-bg);
          border-color: var(--color-error);
        }

        /* Desconto e Gorjeta */
        .comanda-discount-tip-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.85rem;
        }

        .comanda-form-group {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .comanda-label {
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-secondary);
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }

        .label-icon {
          color: var(--color-brand-primary);
        }

        .comanda-input-segmented-wrapper {
          display: flex;
          gap: 0.4rem;
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
          padding: 0.5rem 0.75rem;
          min-width: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--color-text-secondary);
          cursor: pointer;
          line-height: 1;
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

        .comanda-input-prefix-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          width: 100%;
        }

        .comanda-input-prefix {
          position: absolute;
          left: 0.85rem;
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-secondary);
          pointer-events: none;
        }

        .comanda-input-num,
        .comanda-select {
          width: 100%;
          padding: 0.6rem 0.85rem;
          font-size: var(--font-size-sm);
          color: var(--color-text-primary);
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          outline: none;
          transition: all 0.2s ease;
          font-family: inherit;
        }

        .comanda-input-num--prefixed {
          padding-left: 2.2rem;
        }

        .comanda-input-num:focus,
        .comanda-select:focus {
          border-color: var(--color-brand-primary);
          background-color: var(--color-bg-secondary);
          box-shadow: 0 0 0 3px rgba(217, 108, 0, 0.15);
        }

        /* Sumário de Totais (Recibo) */
        .comanda-summary-box {
          padding: 1.15rem;
          border-radius: var(--radius-lg);
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          box-shadow: inset 0 1px 2px rgba(20, 17, 15, 0.04);
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: var(--font-size-xs);
        }

        .summary-label {
          color: var(--color-text-secondary);
          font-weight: 600;
        }

        .summary-value {
          color: var(--color-text-primary);
          font-weight: 700;
        }

        .summary-discount .summary-label,
        .summary-discount .summary-value {
          color: var(--color-error);
          font-weight: 700;
        }

        .summary-tip .summary-label,
        .summary-tip .summary-value {
          color: var(--color-success);
          font-weight: 700;
        }

        .summary-divider {
          height: 1px;
          background-color: var(--color-border);
          margin: 0.25rem 0;
        }

        .summary-total {
          padding-top: 0.25rem;
        }

        .summary-total-label {
          font-size: var(--font-size-sm);
          font-weight: 800;
          color: var(--color-text-primary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .summary-total-value {
          color: var(--color-brand-primary);
          font-size: var(--font-size-xl);
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        /* Formas de Pagamento */
        .btn-split-toggle {
          background-color: var(--color-brand-lightest);
          border: 1px solid var(--color-brand-soft);
          color: var(--color-brand-deep);
          font-size: var(--font-size-xs);
          font-weight: 700;
          padding: 0.4rem 0.85rem;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-split-toggle:hover {
          background-color: var(--color-brand-soft);
          color: white;
          transform: translateY(-1px);
        }

        .btn-split-cancel {
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          color: var(--color-text-secondary);
          font-size: var(--font-size-xs);
          font-weight: 600;
          padding: 0.4rem 0.85rem;
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
          gap: 0.65rem;
        }

        .btn-quick-method {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          padding: 0.85rem 0.5rem;
          border: 1.5px solid var(--color-border);
          background-color: var(--color-bg-primary);
          border-radius: var(--radius-lg);
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-primary);
          cursor: pointer;
          text-align: center;
          transition: all 0.2s cubic-bezier(0.32, 0.72, 0, 1);
        }

        .btn-quick-method:hover {
          border-color: var(--color-brand-soft);
          background-color: var(--color-bg-secondary);
          transform: translateY(-2px);
          box-shadow: var(--shadow-sm);
        }

        .btn-quick-method--active {
          border-color: var(--color-brand-primary);
          background-color: var(--color-brand-lightest);
          color: var(--color-brand-deep);
          box-shadow: 0 4px 12px rgba(217, 108, 0, 0.15);
          transform: translateY(-2px);
        }

        .quick-method-icon {
          color: var(--color-brand-primary);
          transition: transform 0.2s ease;
        }

        .btn-quick-method:hover .quick-method-icon {
          transform: scale(1.1);
        }

        /* Dinheiro & Troco */
        .cash-single-calculator {
          margin-top: 0.85rem;
          padding: 1rem;
          border-radius: var(--radius-lg);
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          animation: fadeIn 0.15s ease-out;
        }

        .cash-quick-notes {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.45rem;
        }

        .cash-notes-label {
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-secondary);
          margin-right: 0.25rem;
        }

        .btn-quick-note {
          padding: 0.35rem 0.75rem;
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
          background-color: var(--color-brand-primary);
          color: white;
          box-shadow: var(--shadow-sm);
        }

        .cash-input-field {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }

        .cash-input-label {
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-secondary);
        }

        .cash-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
          width: 140px;
        }

        .cash-prefix {
          position: absolute;
          left: 0.75rem;
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-secondary);
        }

        .cash-received-input {
          width: 100%;
          padding: 0.5rem 0.75rem 0.5rem 2rem;
          font-size: var(--font-size-sm);
          font-weight: 800;
          color: var(--color-text-primary);
          background-color: var(--color-bg-secondary);
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-md);
          outline: none;
          transition: all 0.2s ease;
        }

        .cash-received-input:focus {
          border-color: var(--color-brand-primary);
          box-shadow: 0 0 0 3px rgba(217, 108, 0, 0.15);
        }

        .cash-change-badge {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          border-radius: var(--radius-md);
          background-color: var(--color-success-bg);
          border: 1px solid var(--color-success);
          color: var(--color-success);
          font-size: var(--font-size-xs);
        }

        .cash-change-left {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 700;
        }

        .cash-change-val {
          font-size: var(--font-size-base);
          font-weight: 800;
          color: var(--color-success);
        }

        /* Recibo de Pagamento */
        .payment-receipt-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.85rem 1rem;
          border-radius: var(--radius-lg);
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          font-size: var(--font-size-sm);
          transition: all 0.2s ease;
        }

        .payment-receipt-method {
          font-weight: 700;
          color: var(--color-text-primary);
          display: flex;
          align-items: center;
          gap: 0.65rem;
        }

        .payment-receipt-icon {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-md);
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-brand-primary);
        }

        .payment-receipt-amount {
          color: var(--color-brand-primary);
          font-weight: 800;
          font-size: var(--font-size-sm);
        }

        /* Split Payments */
        .split-payments-container {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .payment-row-card {
          padding: 0.85rem;
          border-radius: var(--radius-lg);
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
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
          left: 0.75rem;
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-secondary);
        }

        .payment-amount-input {
          width: 100%;
          padding: 0.6rem 0.75rem 0.6rem 2.2rem;
          font-size: var(--font-size-sm);
          font-weight: 700;
          color: var(--color-text-primary);
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          outline: none;
          transition: all 0.2s ease;
        }

        .payment-amount-input:focus {
          border-color: var(--color-brand-primary);
          box-shadow: 0 0 0 3px rgba(217, 108, 0, 0.15);
        }

        .btn-remove-payment {
          background: transparent;
          border: 1px solid transparent;
          color: var(--color-text-secondary);
          cursor: pointer;
          padding: 0.4rem;
          border-radius: var(--radius-md);
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .btn-remove-payment:hover {
          color: var(--color-error);
          background-color: var(--color-error-bg);
          border-color: var(--color-error);
        }

        .cash-change-calculator {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 0.5rem;
          border-top: 1px solid var(--color-border);
          font-size: var(--font-size-xs);
        }

        .cash-input-field-compact {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          font-weight: 600;
        }

        .cash-received-input-compact {
          width: 85px;
          padding: 0.35rem 0.55rem;
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-primary);
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
        }

        .cash-change-badge-compact {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          color: var(--color-success);
          font-weight: 700;
        }

        .split-payments-footer {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-top: 0.25rem;
        }

        .btn-add-split-line {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.7rem 1rem;
          border-radius: var(--radius-lg);
          border: 1.5px dashed var(--color-brand-primary);
          background-color: var(--color-brand-lightest);
          color: var(--color-brand-deep);
          font-size: var(--font-size-xs);
          font-weight: 700;
          cursor: pointer;
          width: 100%;
          justify-content: center;
          transition: all 0.2s cubic-bezier(0.32, 0.72, 0, 1);
        }

        .btn-add-split-line:hover {
          background-color: var(--color-brand-soft);
          color: white;
          transform: translateY(-1px);
        }

        .split-summary-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          border-radius: var(--radius-lg);
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          font-size: var(--font-size-xs);
          font-weight: 700;
        }

        .split-summary-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--color-text-secondary);
        }

        .split-summary-info strong {
          color: var(--color-text-primary);
        }

        .split-missing-alert {
          color: var(--color-error);
          background-color: var(--color-error-bg);
          padding: 0.2rem 0.55rem;
          border-radius: var(--radius-full);
          border: 1px solid var(--color-error);
        }

        .split-complete-alert {
          color: var(--color-success);
          background-color: var(--color-success-bg);
          padding: 0.2rem 0.55rem;
          border-radius: var(--radius-full);
          border: 1px solid var(--color-success);
        }

        /* Footer */
        .comanda-modal-footer {
          padding: 1.25rem 1.5rem;
          border-top: 1px solid var(--color-border);
          background-color: var(--color-bg-primary);
          flex-shrink: 0;
        }

        .comanda-footer-open-actions,
        .comanda-footer-closed-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.85rem;
          width: 100%;
        }

        .comanda-footer-left-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .comanda-btn-danger-outline {
          padding: 0.75rem 1.15rem;
          border-radius: var(--radius-full);
          border: 1px solid var(--color-error, #ef4444);
          background-color: transparent;
          color: var(--color-error, #ef4444);
          font-size: var(--font-size-sm);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .comanda-btn-danger-outline:hover {
          background-color: var(--color-error-bg, rgba(239, 68, 68, 0.08));
          transform: translateY(-1px);
        }

        .comanda-btn-secondary {
          padding: 0.75rem 1.35rem;
          border-radius: var(--radius-full);
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
          transform: translateY(-1px);
        }

        .comanda-btn-primary {
          padding: 0.75rem 1.65rem;
          border-radius: var(--radius-full);
          border: none;
          background-color: var(--color-brand-primary);
          color: white;
          font-size: var(--font-size-sm);
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 0.65rem;
          box-shadow: 0 4px 14px rgba(217, 108, 0, 0.25);
          transition: all 0.25s cubic-bezier(0.32, 0.72, 0, 1);
        }

        .comanda-btn-primary:hover:not(:disabled) {
          background-color: var(--color-brand-hover);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(217, 108, 0, 0.35);
        }

        .comanda-btn-primary:active:not(:disabled) {
          transform: scale(0.98);
        }

        .comanda-btn-primary:disabled {
          background-color: var(--color-border);
          color: var(--color-text-secondary);
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
        }

        .comanda-btn-amount-badge {
          background-color: rgba(255, 255, 255, 0.22);
          padding: 0.15rem 0.55rem;
          border-radius: var(--radius-full);
          font-size: var(--font-size-xs);
          font-weight: 800;
        }

        .comanda-btn-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .comanda-btn-reopen {
          padding: 0.65rem 1.25rem;
          border-radius: var(--radius-full);
          border: 1.5px solid var(--color-brand-primary);
          background-color: transparent;
          color: var(--color-brand-primary);
          font-size: var(--font-size-xs);
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          transition: all 0.2s ease;
        }

        .comanda-btn-reopen:hover:not(:disabled) {
          background-color: var(--color-brand-lightest);
          transform: translateY(-1px);
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
          background-color: var(--color-brand-soft);
        }

        .comanda-modal-shell button:focus-visible,
        .comanda-modal-shell input:focus-visible,
        .comanda-modal-shell select:focus-visible {
          outline: 2px solid var(--color-brand-primary);
          outline-offset: 2px;
        }

        /* Responsividade Mobile-First */
        @media (max-width: 768px) {
          .comanda-modal-overlay {
            align-items: flex-end;
            padding: 0;
          }

          .comanda-modal-shell {
            max-width: 100%;
            max-height: 92vh;
            max-height: 92dvh;
            border-radius: 24px 24px 0 0;
            padding: 0;
            background: transparent;
            box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.45);
            animation: slideUpMobile 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
          }

          .comanda-modal-card {
            border-radius: 24px 24px 0 0;
            border-bottom: none;
          }

          .comanda-modal-header {
            padding: 1.15rem 1.25rem 0.85rem;
          }

          .comanda-modal-body {
            padding: 1.15rem 1.25rem;
          }

          .comanda-section-header {
            flex-wrap: nowrap;
            gap: 0.75rem;
          }

          .comanda-discount-tip-grid {
            grid-template-columns: 1fr;
          }

          .quick-methods-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .add-item-row {
            flex-direction: column;
            align-items: stretch;
          }

          .comanda-modal-footer {
            padding: 1rem 1.25rem max(1.25rem, env(safe-area-inset-bottom, 1.25rem));
          }

          .comanda-footer-open-actions,
          .comanda-footer-closed-actions {
            flex-direction: column-reverse;
            gap: 0.65rem;
            width: 100%;
          }

          .comanda-footer-left-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0.5rem;
            width: 100%;
          }

          .comanda-btn-primary {
            width: 100%;
            min-height: 48px;
            display: inline-flex;
            justify-content: center;
            align-items: center;
            padding: 0.75rem 1rem;
            font-size: var(--font-size-sm);
            white-space: nowrap;
          }

          .comanda-btn-secondary,
          .comanda-btn-danger-outline,
          .comanda-btn-reopen {
            width: 100%;
            min-height: 44px;
            display: inline-flex;
            justify-content: center;
            align-items: center;
            text-align: center;
            padding: 0.65rem 0.5rem;
            font-size: var(--font-size-xs);
            white-space: nowrap;
          }
        }
      `}</style>
    </>
  );
};
