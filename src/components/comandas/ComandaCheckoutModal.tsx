import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  BadgeXIcon,
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
import { localDateTimeToIso } from '../../lib/timezone';
import { AberturaAssistidaCaixaModal } from '../caixa/AberturaAssistidaCaixaModal';
import { GorjetaValorInput } from './GorjetaValorInput';
import { Button, Input, Select, IconButton, SegmentedControl } from '../ui';
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
  customerName?: string;
  customerPhone?: string | null;
  initialServices?: Array<{
    service_id: string;
    name: string;
    price: number;
    professional_id: string;
  }>;
  availableServices?: ServiceOption[];
  availableProfessionals?: ProfessionalOption[];
  timezone?: string;
  appointmentDurationMinutes?: number;
  onClose: () => void;
  onFinalizado: (comanda: Comanda) => void;
  onRescheduled?: (newStartTime: string, newProfessionalId?: string | null) => void;
  onMarkNoShow?: () => void;
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
  customerName = 'Cliente Balcão',
  customerPhone,
  initialServices = [],
  availableServices = [],
  availableProfessionals = [],
  timezone = 'America/Sao_Paulo',
  appointmentDurationMinutes = 30,
  onClose,
  onFinalizado,
  onRescheduled,
  onMarkNoShow,
  comandaRepo,
  caixaRepo,
  produtoRepo,
}) => {
  const comRepo = useMemo(() => comandaRepo || new ComandaRepository(new SupabaseComandaAdapter()), [comandaRepo]);
  const cxaRepo = useMemo(() => caixaRepo || new CaixaRepository(new SupabaseCaixaAdapter()), [caixaRepo]);
  const prodRepo = useMemo(() => produtoRepo || new ProdutoRepository(new SupabaseProdutoAdapter()), [produtoRepo]);

  const [comandaId, setComandaId] = useState<string | null>(initialComandaId);
  const checkoutOperationIdRef = useRef<string | null>(null);
  const [loadedComanda, setLoadedComanda] = useState<Comanda | null>(null);
  const [itens, setItens] = useState<ItemLocal[]>([]);
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('fixed');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [tipValue, setTipValue] = useState<number>(0);
  const [tipProfessionalId, setTipProfessionalId] = useState<string>('');
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
  const [noShowConfirmOpen, setNoShowConfirmOpen] = useState(false);
  const [isMarkingNoShow, setIsMarkingNoShow] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados de reagendamento direto do agendamento vinculado à comanda
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleProfessionalId, setRescheduleProfessionalId] = useState('');
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [currentStartTime, setCurrentStartTime] = useState<string | null | undefined>(appointmentStartTime);
  const [comandaRescheduleSlots, setComandaRescheduleSlots] = useState<string[]>([]);
  const [loadingRescheduleSlots, setLoadingRescheduleSlots] = useState(false);

  useEffect(() => {
    setCurrentStartTime(appointmentStartTime);
  }, [appointmentStartTime]);

  const firstServiceId = itens[0]?.service_id || initialServices?.[0]?.service_id || null;

  useEffect(() => {
    if (!isRescheduleModalOpen || !rescheduleDate || !rescheduleProfessionalId || !tenantId) return;

    let isMounted = true;
    const fetchSlots = async () => {
      setLoadingRescheduleSlots(true);
      try {
        if (firstServiceId && typeof (supabase as any)?.rpc === 'function') {
          const { data, error } = await supabase.rpc('get_available_slots', {
            p_tenant_id: tenantId,
            p_professional_id: rescheduleProfessionalId,
            p_service_id: firstServiceId,
            p_date: rescheduleDate,
            p_exclude_appointment_id: appointmentId || null,
          });
          if (!error && Array.isArray(data) && data.length > 0) {
            const slots = data.map((d) => (typeof d === 'object' && d !== null ? d.slot_time || d.slot : String(d)));
            if (isMounted) setComandaRescheduleSlots(slots);
            return;
          }
        }
        if (isMounted) {
          setComandaRescheduleSlots([
            '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
            '11:00', '11:30', '13:00', '13:30', '14:00', '14:30',
            '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
            '18:00', '18:30', '19:00', '19:30'
          ]);
        }
      } catch (err) {
        if (isMounted) {
          setComandaRescheduleSlots([
            '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
            '11:00', '11:30', '13:00', '13:30', '14:00', '14:30',
            '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
            '18:00', '18:30', '19:00', '19:30'
          ]);
        }
      } finally {
        if (isMounted) {
          setLoadingRescheduleSlots(false);
        }
      }
    };

    fetchSlots();

    return () => {
      isMounted = false;
    };
  }, [isRescheduleModalOpen, rescheduleDate, rescheduleProfessionalId, tenantId, appointmentId, firstServiceId]);

  const inFlightAdditionsRef = useRef<Map<string, Promise<string | undefined>>>(new Map());

  const handleConfirmReschedule = async () => {
    if (!appointmentId || !rescheduleDate || !rescheduleTime) {
      setErrorMsg('Selecione uma data e horário válidos para reagendar.');
      return;
    }

    setIsRescheduling(true);
    setErrorMsg(null);
    try {
      const startTimeIso = localDateTimeToIso(rescheduleDate, rescheduleTime, timezone);
      const durationMs = Math.max(15, appointmentDurationMinutes) * 60 * 1000;
      const endTimeIso = new Date(new Date(startTimeIso).getTime() + durationMs).toISOString();

      const updatePayload: Record<string, unknown> = {
        start_time: startTimeIso,
        end_time: endTimeIso,
        updated_at: new Date().toISOString(),
      };
      if (rescheduleProfessionalId) {
        updatePayload.professional_id = rescheduleProfessionalId;
      }

      const { error: updErr } = await supabase
        .from('appointments')
        .update(updatePayload)
        .eq('id', appointmentId)
        .eq('tenant_id', tenantId);

      if (updErr) throw updErr;

      setCurrentStartTime(startTimeIso);
      setIsRescheduleModalOpen(false);
      if (onRescheduled) {
        onRescheduled(startTimeIso, rescheduleProfessionalId || null);
      }
    } catch (err: any) {
      console.error('Erro ao reagendar atendimento na comanda:', err);
      setErrorMsg(err?.message || 'Erro ao reagendar atendimento.');
    } finally {
      setIsRescheduling(false);
    }
  };

  const handleConfirmNoShowAction = async () => {
    if (!onMarkNoShow || isMarkingNoShow) return;
    setIsMarkingNoShow(true);
    setErrorMsg(null);
    try {
      await onMarkNoShow();
      setNoShowConfirmOpen(false);
    } catch (err: any) {
      console.error('Erro ao marcar atendimento como não compareceu:', err);
      setErrorMsg(err?.message || 'Erro ao marcar como não compareceu.');
    } finally {
      setIsMarkingNoShow(false);
    }
  };

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

    const persistedComandaId = initialComandaId ?? null;
    checkoutOperationIdRef.current = globalThis.crypto.randomUUID();

    // Reset de estados
    setIsLoadingComanda(true);
    setLoadedComanda(null);
    setComandaId(persistedComandaId);
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
                name:
                  it.name ||
                  (it.item_type === 'servico'
                    ? availableServices.find((s) => s.id === it.service_id)?.name || 'Serviço'
                    : 'Produto'),
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
          setComandaId(null);
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
  // Um único cálculo, o mesmo do repositório e da RPC de liquidação, para o total
  // mostrado ser exatamente o total gravado.
  const totals = useMemo(
    () =>
      comRepo.calculateTotals(
        itens.map((it) => ({ quantity: it.quantity || 1, unit_price: it.unit_price || 0 })),
        { type: discountType === 'percent' ? 'percent' : 'amount', value: discountValue || 0 },
        tipValue || 0
      ),
    [comRepo, itens, discountType, discountValue, tipValue]
  );
  const subtotal = totals.subtotal;
  const discountAmount = totals.discount;

  const totalFinal = useMemo(() => {
    if (isClosed && loadedComanda) {
      return loadedComanda.total_amount;
    }
    return totals.total;
  }, [totals, isClosed, loadedComanda]);

  // Profissionais distintos presentes nos itens da comanda (ticket 04 da spec 034).
  // A gorjeta pergunta de quem é apenas quando há mais de um; com um só, resolve sozinha.
  const tipProfessionalOptions = useMemo(() => {
    const distinctIds = Array.from(
      new Set(itens.map((it) => it.professional_id).filter((id): id is string => !!id))
    );
    return distinctIds
      .map((id) => availableProfessionals.find((p) => p.id === id))
      .filter((p): p is (typeof availableProfessionals)[number] => !!p);
  }, [itens, availableProfessionals]);

  const resolvedTipProfessionalId = useMemo(() => {
    if (tipProfessionalOptions.length === 1) {
      return tipProfessionalOptions[0].id;
    }
    if (tipProfessionalOptions.length > 1) {
      return tipProfessionalId || null;
    }
    return null;
  }, [tipProfessionalOptions, tipProfessionalId]);

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

  const persistNewItem = async (params: {
    tempId: string;
    item_type: 'servico' | 'produto';
    service_id: string | null;
    product_id: string | null;
    professional_id: string | null;
    name: string;
    quantity: number;
    unit_price: number;
  }) => {
    const newItemLocal: ItemLocal = {
      tempId: params.tempId,
      item_type: params.item_type,
      service_id: params.service_id,
      product_id: params.product_id,
      professional_id: params.professional_id,
      name: params.name,
      quantity: params.quantity,
      unit_price: params.unit_price,
    };

    setItens((prev) => [...prev, newItemLocal]);

    const addPromise = (async () => {
      if (comandaId) {
        const added = await comRepo.addItem(comandaId, tenantId, {
          item_type: params.item_type,
          service_id: params.service_id,
          product_id: params.product_id,
          professional_id: params.professional_id,
          quantity: params.quantity,
          unit_price: params.unit_price,
          total_price: params.quantity * params.unit_price,
        });
        setItens((prev) =>
          prev.map((it) => (it.tempId === params.tempId ? { ...it, id: added.id, tempId: added.id } : it))
        );
        return added.id;
      } else {
        const created = await comRepo.createComanda({
          tenant_id: tenantId,
          appointment_id: appointmentId || null,
          customer_id: customerId || null,
          itens: [
            ...itens.map((it) => ({
              item_type: it.item_type,
              service_id: it.service_id,
              product_id: it.product_id,
              professional_id: it.professional_id,
              quantity: it.quantity,
              unit_price: it.unit_price,
            })),
            {
              item_type: params.item_type,
              service_id: params.service_id,
              product_id: params.product_id,
              professional_id: params.professional_id,
              quantity: params.quantity,
              unit_price: params.unit_price,
            },
          ],
        });
        setComandaId(created.id);
        setLoadedComanda(created);
        if (created.itens && created.itens.length > 0) {
          setItens(
            created.itens.map((it) => ({
              tempId: it.id,
              id: it.id,
              item_type: it.item_type,
              service_id: it.service_id,
              product_id: it.product_id,
              professional_id: it.professional_id,
              name: it.name || params.name,
              quantity: it.quantity,
              unit_price: it.unit_price,
            }))
          );
          const foundCreated = created.itens.find(
            (it) => it.service_id === params.service_id && it.product_id === params.product_id
          );
          return foundCreated?.id;
        }
        return undefined;
      }
    })();

    inFlightAdditionsRef.current.set(params.tempId, addPromise);

    try {
      await addPromise;
    } catch (err: any) {
      console.error(`Erro ao persistir adição de ${params.item_type} na comanda:`, err);
      setItens((prev) => prev.filter((it) => it.tempId !== params.tempId));
      setErrorMsg(err?.message || `Erro ao salvar ${params.item_type} na comanda.`);
    } finally {
      inFlightAdditionsRef.current.delete(params.tempId);
    }
  };

  const handleAddServiceConfirm = async () => {
    const srv = availableServices.find((s) => s.id === selectedServiceId);
    if (!srv) return;

    const defaultProfId =
      selectedProfId ||
      itens.find((i) => i.professional_id)?.professional_id ||
      availableProfessionals[0]?.id ||
      null;

    const tempId = `srv-${Date.now()}`;
    setSelectedServiceId('');
    setSelectedProfId('');
    setIsAddingService(false);

    await persistNewItem({
      tempId,
      item_type: 'servico',
      service_id: srv.id,
      product_id: null,
      professional_id: defaultProfId,
      name: srv.name,
      quantity: 1,
      unit_price: srv.price,
    });
  };

  const handleAddProductConfirm = async () => {
    const prod = catalogProducts.find((p) => p.id === selectedProductId);
    if (!prod) return;

    const defaultProfId =
      selectedProfId ||
      itens.find((i) => i.professional_id)?.professional_id ||
      availableProfessionals[0]?.id ||
      null;

    const tempId = `prod-${Date.now()}`;
    setSelectedProductId('');
    setSelectedProfId('');
    setIsAddingProduct(false);

    await persistNewItem({
      tempId,
      item_type: 'produto',
      service_id: null,
      product_id: prod.id,
      professional_id: defaultProfId,
      name: prod.name,
      quantity: 1,
      unit_price: prod.price,
    });
  };

  const handleRemoveItem = async (tempId: string) => {
    const itemToRemove = itens.find((it) => it.tempId === tempId);
    setItens((prev) => prev.filter((it) => it.tempId !== tempId));

    let itemId = itemToRemove?.id;
    if (!itemId && inFlightAdditionsRef.current.has(tempId)) {
      try {
        itemId = await inFlightAdditionsRef.current.get(tempId);
      } catch {
        // Se a adição falhou, o item não foi para o banco
      }
    }

    if (comandaId && itemId) {
      try {
        await comRepo.removeItem(itemId, comandaId);
      } catch (err: any) {
        console.error('Erro ao remover item da comanda:', err);
        if (itemToRemove) {
          setItens((prev) => [...prev, itemToRemove]);
        }
        setErrorMsg(err?.message || 'Erro ao excluir item da comanda.');
      }
    }
    inFlightAdditionsRef.current.delete(tempId);
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
      setErrorMsg('Adicione pelo menos um serviço ou produto na comanda.');
      return;
    }

    if (tipValue > 0 && tipProfessionalOptions.length > 1 && !resolvedTipProfessionalId) {
      setErrorMsg('Escolha o profissional que recebe a gorjeta.');
      return;
    }

    const effectivePagamentos =
      totalFinal === 0
        ? []
        : pagamentos.length <= 1 && !isSplitting
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
      const checkoutOperationId = checkoutOperationIdRef.current ?? globalThis.crypto.randomUUID();
      checkoutOperationIdRef.current = checkoutOperationId;
      const comandaLiquidada = await comRepo.settleComanda({
        comanda_id: comandaId,
        operation_id: checkoutOperationId,
        tenant_id: tenantId,
        appointment_id: appointmentId ?? null,
        customer_id: customerId ?? null,
        discount_amount: discountAmount,
        // Com percentual, o banco converte e grava o percentual original.
        discount_percent: discountType === 'percent' ? Math.min(100, discountValue || 0) : null,
        tip_amount: tipValue,
        // Ticket 04 da spec 034: a atribuição de gorjeta é gravada no MESMO
        // fechamento, não por escrita separada antes -- o fluxo mais comum
        // (checkout de agendamento novo) só cria a linha da Comanda dentro do
        // próprio settle_comanda_idempotent, quando comandaId ainda é nulo aqui.
        tip_professional_id: tipValue > 0 ? resolvedTipProfessionalId : null,
        cash_session_id: sessao.id,
        itens: itens.map((it) => ({
          item_type: it.item_type,
          service_id: it.service_id,
          product_id: it.product_id,
          professional_id: it.professional_id,
          quantity: it.quantity,
          unit_price: it.unit_price,
        })),
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

      const { error: cancelError } = await supabase.rpc('cancel_comanda_appointment', {
        p_comanda_id: targetComandaId || null,
        p_appointment_id: targetAppointmentId || null,
        p_tenant_id: tenantId,
      });
      if (cancelError) throw cancelError;

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
        className="fixed inset-0 bg-[rgba(20,17,15,0.65)] backdrop-blur-md flex items-center justify-center z-[1050] p-5 animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-checkout-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="w-full max-w-[640px] max-h-[calc(100dvh-2.5rem)] flex flex-col p-1 rounded-[calc(var(--radius-xl)+4px)] bg-[rgba(20,17,15,0.08)] shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_24px_56px_-12px_rgba(20,17,15,0.35),var(--shadow-xl)] animate-dialog-in box-border font-base max-md:max-w-full max-md:max-h-[92dvh] max-md:rounded-t-3xl max-md:rounded-b-none max-md:p-0 max-md:bg-transparent max-md:shadow-[0_-10px_40px_rgba(0,0,0,0.45)] max-md:![animation:slideUpMobile_0.3s_cubic-bezier(0.16,1,0.3,1)_both]">
          <div className="bg-bg-secondary border border-text-primary rounded-xl w-full max-h-full flex flex-col shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),var(--shadow-lg)] overflow-hidden text-text-primary max-md:rounded-t-3xl max-md:rounded-b-none max-md:border-b-0">
            {/* Header com Double-Bezel e Detalhes da Comanda */}
            <div className="relative flex items-start justify-between px-6 pt-5 pb-4 border-b border-text-primary bg-transparent shrink-0 max-md:px-5 max-md:pt-[1.15rem] max-md:pb-4">
              <div className="flex flex-col items-start gap-[0.65rem] flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap pr-10">
                  <div className="flex items-center gap-[0.6rem] flex-wrap min-h-[38px]">
                    <h3 id="modal-checkout-title" className="text-lg font-bold text-text-primary m-0 tracking-[-0.01em]">
                      {loadedComanda?.comanda_number
                        ? `Comanda #${loadedComanda.comanda_number}`
                        : 'Comanda de atendimento'}
                    </h3>
                    <span
                      className={`text-[0.7rem] font-bold uppercase tracking-[0.04em] px-[0.55rem] py-[0.2rem] rounded-full leading-[1.2] border-none ${
                        isClosed ? 'bg-success-bg text-text-primary shadow-[0_0_0_0.8px_var(--color-text-primary)]' : 'bg-success-solid text-white'
                      }`}
                    >
                      {isClosed ? 'Liquidada' : 'Em aberto'}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-text-secondary mt-[0.15rem] flex flex-col gap-2 w-full">
                  <div className="flex items-center gap-[0.6rem] flex-wrap">
                    <span className="inline-flex items-center gap-[0.35rem] text-text-primary font-bold [&_svg]:h-fit [&_svg]:text-text-primary [&_svg_path]:stroke-text-primary">
                      <HugeiconsIcon icon={UserIcon} size={13} className="text-text-primary shrink-0" />
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
                        className="inline-flex items-center gap-[0.35rem] text-text-primary font-bold text-xs bg-bg-secondary px-[0.6rem] py-1 rounded-sm border-none shadow-[0_0_0_0.8px_var(--color-text-primary)] tracking-[0.01em] cursor-pointer transition-all duration-200 select-none hover:bg-success-bg hover:text-text-primary active:scale-[0.97] [&_svg]:h-fit [&_svg]:text-text-primary [&_svg_path]:stroke-text-primary"
                        title="Abrir conversa no WhatsApp com o cliente"
                      >
                        <HugeiconsIcon icon={WhatsappIcon} size={13} className="text-text-primary shrink-0" />
                        <span>{customerPhone}</span>
                      </button>
                    )}
                  </div>
                  {appointmentId ? (
                    <div className="flex items-center gap-[0.6rem] flex-wrap">
                      <span
                        className="inline-flex items-center gap-[0.35rem] text-text-primary font-bold text-xs bg-bg-secondary px-[0.6rem] py-1 rounded-sm border-none shadow-[0_0_0_0.8px_var(--color-text-primary)] tracking-[0.01em] [&_span]:text-text-primary [&_svg]:h-fit [&_svg]:text-text-primary [&_svg_path]:stroke-text-primary"
                        title="Comanda gerada a partir de agendamento da agenda"
                      >
                        <HugeiconsIcon icon={Calendar02Icon} size={13} />
                        <span>
                          {appointmentIsFitting ? 'Encaixe' : 'Agendamento'}
                          {currentStartTime
                            ? `: ${new Date(currentStartTime).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${new Date(currentStartTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                            : ''}
                          {appointmentServiceName ? ` • ${appointmentServiceName}` : ''}
                        </span>
                      </span>
                      {!isClosed && (
                        <div className="inline-flex items-center gap-[0.4rem] shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setNoShowConfirmOpen(false);
                              setReopenConfirmOpen(false);
                              setCancelConfirmOpen(false);
                              if (currentStartTime) {
                                const d = new Date(currentStartTime);
                                setRescheduleDate(d.toISOString().slice(0, 10));
                                const hh = String(d.getHours()).padStart(2, '0');
                                const mm = String(d.getMinutes()).padStart(2, '0');
                                setRescheduleTime(`${hh}:${mm}`);
                              }
                              setRescheduleProfessionalId(itens[0]?.professional_id || availableProfessionals[0]?.id || '');
                              setIsRescheduleModalOpen((prev) => !prev);
                            }}
                            className="inline-flex items-center gap-1 text-text-primary font-bold text-xs bg-bg-secondary px-[0.6rem] py-1 rounded-sm border-none shadow-[0_0_0_0.8px_var(--color-text-primary)] cursor-pointer transition-all duration-150 hover:bg-info-bg hover:text-info hover:shadow-[0_0_0_0.8px_var(--color-info)] hover:[&_svg]:text-info hover:[&_svg_path]:stroke-info [&_svg]:h-fit [&_svg]:text-text-primary [&_svg_path]:stroke-text-primary"
                            title="Reagendar horário deste atendimento mantendo a comanda aberta"
                            aria-label="Reagendar atendimento"
                          >
                            <HugeiconsIcon icon={Calendar02Icon} size={13} />
                            <span>Reagendar</span>
                          </button>
                          {onMarkNoShow && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsRescheduleModalOpen(false);
                                setReopenConfirmOpen(false);
                                setCancelConfirmOpen(false);
                                setNoShowConfirmOpen((prev) => !prev);
                              }}
                              className="inline-flex items-center gap-1 text-error font-bold text-xs bg-bg-secondary px-[0.6rem] py-1 rounded-sm border-none shadow-[0_0_0_0.8px_var(--color-error)] cursor-pointer transition-all duration-150 hover:bg-error-bg [&_svg]:h-fit [&_svg]:text-error [&_svg_path]:stroke-error"
                              title="Marcar atendimento como não compareceu"
                              aria-label="Marcar atendimento como não compareceu"
                            >
                              <HugeiconsIcon icon={BadgeXIcon} size={13} />
                              <span>Não compareceu</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-[0.6rem] flex-wrap">
                      <span
                        className="inline-flex items-center gap-[0.35rem] font-semibold text-xs px-[0.6rem] py-1 rounded-sm tracking-[0.01em] text-text-primary"
                        title="Comanda aberta diretamente no balcão"
                      >
                        <span>Atendimento Balcão / Avulsa</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <IconButton
                type="button"
                onClick={onClose}
                variant="ghost"
                size="sm"
                className="absolute top-5 right-6 shrink-0"
                aria-label="Fechar modal de comanda"
                icon={<HugeiconsIcon icon={Cancel01Icon} size={18} />}
              />
            </div>

            {/* Painel Interativo de Reagendamento Direto na Comanda */}
            {isRescheduleModalOpen && (
              <div
                role="region"
                aria-label="Painel de Reagendamento de Atendimento"
                className="mx-6 mt-4 p-[0.9rem_1.15rem] rounded-lg bg-info-bg border border-info flex flex-col gap-[0.85rem] animate-fade-in"
              >
                <div className="flex items-center gap-2">
                  <span className="text-info shrink-0">
                    <HugeiconsIcon icon={Calendar02Icon} size={18} />
                  </span>
                  <h4 className="m-0 text-sm font-bold text-text-primary">
                    Reagendar atendimento (sem cancelar comanda)
                  </h4>
                </div>

                <div className="grid [grid-template-columns:repeat(auto-fit,minmax(130px,1fr))] gap-[0.65rem]">
                  <Input
                    id="reschedule_date"
                    type="date"
                    label="Nova data"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                  />
                  <Select
                    id="reschedule_time"
                    label="Novo horário"
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                    placeholder={loadingRescheduleSlots ? 'Carregando horários...' : 'Selecione um horário...'}
                  >
                    {rescheduleTime && !comandaRescheduleSlots.includes(rescheduleTime) && (
                      <option value={rescheduleTime}>{rescheduleTime}</option>
                    )}
                    {comandaRescheduleSlots.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                    {!loadingRescheduleSlots && comandaRescheduleSlots.length === 0 && !rescheduleTime && (
                      <option value="" disabled>Nenhum horário livre nesta data</option>
                    )}
                  </Select>
                  {availableProfessionals.length > 0 && (
                    <Select
                      id="reschedule_prof"
                      label="Profissional"
                      value={rescheduleProfessionalId}
                      onChange={(e) => setRescheduleProfessionalId(e.target.value)}
                    >
                      {availableProfessionals.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </Select>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsRescheduleModalOpen(false)}
                    disabled={isRescheduling}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleConfirmReschedule}
                    loading={isRescheduling}
                  >
                    Confirmar reagendamento
                  </Button>
                </div>
              </div>
            )}

            {/* Banner de Confirmação de Não Comparecimento */}
            {noShowConfirmOpen && (
              <div
                className="mx-6 mt-4 p-[0.9rem_1.15rem] rounded-lg bg-error-bg border border-error flex flex-col gap-[0.65rem] animate-fade-in"
                role="region"
                aria-label="Painel de Confirmação de Não Comparecimento"
              >
                <div className="flex items-start gap-[0.65rem]">
                  <div className="text-error mt-[0.1rem] shrink-0">
                    <HugeiconsIcon icon={BadgeXIcon} size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-text-primary m-0">Confirmar não comparecimento</h4>
                    <p className="text-xs text-text-secondary mt-[0.2rem] mb-0 leading-[1.4]">
                      Deseja marcar o atendimento de <strong>{customerName || 'Cliente'}</strong> como não compareceu? A comanda aberta vinculada será cancelada e nenhum novo pagamento será permitido.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setNoShowConfirmOpen(false)}
                    disabled={isMarkingNoShow}
                    className="px-3 py-[0.35rem] text-xs font-semibold bg-transparent border border-border rounded-md text-text-secondary cursor-pointer transition-all duration-150 hover:bg-bg-secondary hover:text-text-primary"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    disabled={isMarkingNoShow}
                    onClick={handleConfirmNoShowAction}
                    className="px-[0.9rem] py-[0.4rem] text-xs font-bold bg-error-solid text-white border-none rounded-md cursor-pointer transition-all duration-150 enabled:hover:brightness-[0.92] enabled:hover:-translate-y-px"
                  >
                    {isMarkingNoShow ? 'Marcando...' : 'Sim, não compareceu'}
                  </button>
                </div>
              </div>
            )}

            {/* Banner de Confirmação de Reabertura */}
            {reopenConfirmOpen && (
              <div className="mx-6 mt-4 p-[0.9rem_1.15rem] rounded-lg bg-warning-bg border border-warning flex flex-col gap-[0.65rem] animate-fade-in" role="alert">
                <div className="flex items-start gap-[0.65rem]">
                  <div className="text-warning mt-[0.1rem] shrink-0">
                    <HugeiconsIcon icon={AlertCircleIcon} size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-text-primary m-0">Deseja realmente reabrir esta comanda?</h4>
                    <p className="text-xs text-text-secondary mt-[0.2rem] mb-0 leading-[1.4]">
                      Ao reabrir, os pagamentos registrados serão estornados e a comanda voltará para o status de edição.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setReopenConfirmOpen(false)}
                    className="px-3 py-[0.35rem] text-xs font-semibold bg-transparent border border-border rounded-md text-text-secondary cursor-pointer transition-all duration-150 hover:bg-bg-secondary hover:text-text-primary"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isReopening}
                    onClick={handleReopenComanda}
                    className="px-[0.9rem] py-[0.4rem] text-xs font-bold bg-warning-solid text-white border-none rounded-md cursor-pointer transition-all duration-150 enabled:hover:brightness-[0.92] enabled:hover:-translate-y-px"
                  >
                    {isReopening ? 'Reabrindo...' : 'Confirmar reabertura'}
                  </button>
                </div>
              </div>
            )}

            {/* Banner de Confirmação de Cancelamento */}
            {cancelConfirmOpen && (
              <div className="mx-6 mt-4 p-[0.9rem_1.15rem] rounded-lg bg-error-bg border border-error flex flex-col gap-[0.65rem] animate-fade-in" role="alert">
                <div className="flex items-start gap-[0.65rem]">
                  <div className="text-error mt-[0.1rem] shrink-0">
                    <HugeiconsIcon icon={Cancel01Icon} size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-text-primary m-0">Cancelar este agendamento e comanda?</h4>
                    <p className="text-xs text-text-secondary mt-[0.2rem] mb-0 leading-[1.4]">
                      O agendamento será cancelado na grade e a comanda aberta correspondente será cancelada automaticamente.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setCancelConfirmOpen(false)}
                    className="px-3 py-[0.35rem] text-xs font-semibold bg-transparent border border-border rounded-md text-text-secondary cursor-pointer transition-all duration-150 hover:bg-bg-secondary hover:text-text-primary"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    disabled={isCanceling}
                    onClick={handleCancelComandaEAgendamento}
                    className="px-[0.9rem] py-[0.4rem] text-xs font-bold bg-error-solid text-white border-none rounded-md cursor-pointer transition-all duration-150 enabled:hover:brightness-[0.92] enabled:hover:-translate-y-px"
                  >
                    {isCanceling ? 'Cancelando...' : 'Confirmar cancelamento'}
                  </button>
                </div>
              </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-6 pt-[0.9rem] pb-4 flex flex-col gap-3 max-md:px-5 max-md:py-[1.15rem] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-brand-soft [&_button:focus-visible]:outline [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-brand-primary [&_button:focus-visible]:outline-offset-2 [&_input:focus-visible]:outline [&_input:focus-visible]:outline-2 [&_input:focus-visible]:outline-brand-primary [&_input:focus-visible]:outline-offset-2 [&_select:focus-visible]:outline [&_select:focus-visible]:outline-2 [&_select:focus-visible]:outline-brand-primary [&_select:focus-visible]:outline-offset-2">
              {isLoadingComanda ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 gap-4 min-h-[280px]">
                  <div className="w-[34px] h-[34px] border-[3px] border-brand-soft border-t-brand-primary rounded-full animate-spin" />
                  <p className="text-sm text-text-secondary font-semibold">Carregando dados da comanda...</p>
                </div>
              ) : (
                <>
                  {/* Mensagem de Erro / Validação */}
                  {errorMsg && (
                    <div className="p-[0.85rem_1.15rem] rounded-md bg-error-bg border border-error text-error text-xs font-semibold flex items-center gap-2" role="alert">
                      <HugeiconsIcon icon={AlertCircleIcon} size={16} />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {/* Banner de Comanda Fechada / Liquidada (Modo Recibo) */}
                  {isClosed && (
                    <div className="flex items-center justify-between p-[0.9rem_1.25rem] rounded-lg bg-success-bg border border-success gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-[38px] h-[38px] rounded-full bg-white text-success flex items-center justify-center shrink-0 shadow-sm">
                          <HugeiconsIcon icon={CheckmarkCircle01Icon} size={20} />
                        </div>
                        <div>
                          <strong className="block text-sm font-bold text-text-primary">Atendimento liquidado e pago</strong>
                          {loadedComanda?.closed_at && (
                            <span className="block text-xs text-text-secondary mt-[0.15rem]">
                              Fechado em {new Date(loadedComanda.closed_at).toLocaleDateString('pt-BR')} às{' '}
                              {new Date(loadedComanda.closed_at).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[0.7rem] font-bold uppercase tracking-[0.05em] px-3 py-[0.3rem] rounded-full bg-success-solid text-white shrink-0 shadow-sm">Recibo</span>
                    </div>
                  )}

                  {/* Seção 1: Itens Consumidos */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-4 w-full max-md:flex-wrap max-md:gap-3">
                      <div className="inline-flex items-center gap-2 shrink-0">
                        <h4 className="text-xs font-extrabold uppercase tracking-[0.05em] text-text-primary m-0 leading-none inline-flex items-center">ITENS CONSUMIDOS</h4>
                        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-[0.35rem] text-[0.72rem] font-extrabold rounded-full bg-text-primary text-brand-lightest leading-none box-border shadow-[0_1px_2px_rgba(20,17,15,0.15)]">{itens.length}</span>
                      </div>
                      {!isClosed && (
                        <div className="inline-flex items-center gap-[0.45rem]">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            icon={<HugeiconsIcon icon={ScissorIcon} size={14} />}
                            onClick={() => {
                              setIsAddingService((prev) => !prev);
                              setIsAddingProduct(false);
                            }}
                            aria-expanded={isAddingService}
                            className={isAddingService ? 'shadow-[0_0_0_1.5px_var(--color-brand-primary),var(--shadow-sm)]! text-brand-deep' : ''}
                          >
                            Serviço
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            icon={<HugeiconsIcon icon={ShoppingBag01Icon} size={14} />}
                            onClick={() => {
                              setIsAddingProduct((prev) => !prev);
                              setIsAddingService(false);
                            }}
                            aria-expanded={isAddingProduct}
                            className={isAddingProduct ? 'shadow-[0_0_0_1.5px_var(--color-brand-primary),var(--shadow-sm)]! text-brand-deep' : ''}
                          >
                            Produto
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Formulário Embutido: Adicionar Serviço */}
                    {!isClosed && isAddingService && (
                      <div className="p-4 rounded-lg bg-bg-primary border-[1.5px] border-brand-soft flex flex-col gap-3 animate-fade-in shadow-sm">
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-bold text-brand-deep">Adicionar novo serviço</span>
                          <button
                            type="button"
                            onClick={() => setIsAddingService(false)}
                            className="bg-transparent border border-border rounded-sm px-[0.65rem] py-1 text-text-secondary text-xs font-semibold cursor-pointer transition-all duration-150 hover:text-error hover:border-error hover:bg-error-bg"
                          >
                            Cancelar
                          </button>
                        </div>
                        <div className="flex gap-2 items-center max-md:flex-col max-md:items-stretch">
                          <Select
                            className="flex-1"
                            value={selectedServiceId}
                            onChange={(e) => setSelectedServiceId(e.target.value)}
                            aria-label="Selecionar serviço"
                          >
                            <option value="">Selecione o serviço...</option>
                            {availableServices.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} • R$ {s.price.toFixed(2)}
                              </option>
                            ))}
                          </Select>

                          <Select
                            className="flex-1"
                            value={selectedProfId}
                            onChange={(e) => setSelectedProfId(e.target.value)}
                            aria-label="Selecionar profissional"
                          >
                            <option value="">Profissional (opcional)...</option>
                            {availableProfessionals.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </Select>

                          <button
                            type="button"
                            disabled={!selectedServiceId}
                            onClick={handleAddServiceConfirm}
                            className="px-4 py-2 rounded-md border-none bg-brand-primary-solid text-white text-xs font-bold cursor-pointer whitespace-nowrap transition-all duration-200 enabled:hover:bg-brand-hover enabled:hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Adicionar
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Formulário Embutido: Adicionar Produto */}
                    {!isClosed && isAddingProduct && (
                      <div className="p-4 rounded-lg bg-bg-primary border-[1.5px] border-brand-soft flex flex-col gap-3 animate-fade-in shadow-sm">
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-bold text-brand-deep">Adicionar produto do estoque</span>
                          <button
                            type="button"
                            onClick={() => setIsAddingProduct(false)}
                            className="bg-transparent border border-border rounded-sm px-[0.65rem] py-1 text-text-secondary text-xs font-semibold cursor-pointer transition-all duration-150 hover:text-error hover:border-error hover:bg-error-bg"
                          >
                            Cancelar
                          </button>
                        </div>
                        <div className="flex gap-2 items-center max-md:flex-col max-md:items-stretch">
                          <Select
                            className="flex-1"
                            value={selectedProductId}
                            onChange={(e) => setSelectedProductId(e.target.value)}
                            aria-label="Selecionar produto"
                          >
                            <option value="">Selecione o produto...</option>
                            {catalogProducts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} • R$ {p.price.toFixed(2)} (Estoque: {p.stock_quantity ?? 0})
                              </option>
                            ))}
                          </Select>

                          <button
                            type="button"
                            disabled={!selectedProductId}
                            onClick={handleAddProductConfirm}
                            className="px-4 py-2 rounded-md border-none bg-brand-primary-solid text-white text-xs font-bold cursor-pointer whitespace-nowrap transition-all duration-200 enabled:hover:bg-brand-hover enabled:hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Adicionar
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Lista dos Itens da Comanda */}
                    <div className="flex flex-col gap-[0.55rem]">
                      {itens.length === 0 ? (
                        <div className="p-6 text-center bg-bg-secondary border border-dashed border-border rounded-md text-text-secondary text-xs">
                          <p>Nenhum item adicionado à comanda ainda.</p>
                        </div>
                      ) : (
                        itens.map((it) => (
                          <div key={it.tempId} className="flex items-center justify-between px-4 py-3 rounded-lg bg-bg-secondary shadow-[0_0_0_0.8px_var(--color-text-primary)] transition-all duration-200">
                            <div className="flex items-center min-w-0">
                              <div className="flex flex-col gap-[0.2rem] min-w-0">
                                <strong className="text-base font-bold text-text-primary whitespace-nowrap overflow-hidden text-ellipsis">{it.name}</strong>
                                <div className="flex items-center gap-[0.35rem] text-[0.8rem] font-semibold text-text-primary flex-wrap">
                                  <span className="font-bold text-text-primary">
                                    {it.item_type === 'servico' ? 'Serviço' : 'Produto'}
                                  </span>
                                  {it.quantity > 1 && <span>• {it.quantity}x</span>}
                                  <span>• R$ {it.unit_price.toFixed(2)}</span>
                                  {it.professional_id &&
                                    availableProfessionals.find((p) => p.id === it.professional_id) && (
                                      <span className="text-text-primary font-semibold">
                                        • {availableProfessionals.find((p) => p.id === it.professional_id)?.name}
                                      </span>
                                    )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-[0.85rem] shrink-0">
                              <span className="text-[1.15rem] font-extrabold text-text-primary">
                                R$ {(it.quantity * it.unit_price).toFixed(2)}
                              </span>
                              {!isClosed && (
                                <IconButton
                                  type="button"
                                  onClick={() => handleRemoveItem(it.tempId)}
                                  variant="outline"
                                  size="sm"
                                  title="Remover item"
                                  aria-label={`Remover ${it.name}`}
                                  icon={<HugeiconsIcon icon={Delete02Icon} size={16} />}
                                  className="hover:text-error hover:bg-error-bg hover:border-error"
                                />
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Seção 2: Desconto e Gorjeta (Apenas editável se aberta) */}
                  {!isClosed && (
                    <div className="grid grid-cols-2 gap-[0.85rem] max-md:grid-cols-1">
                      <div className="flex flex-col gap-[0.4rem]">
                        <label className="text-xs font-bold text-text-primary flex items-center gap-[0.35rem]">
                          <HugeiconsIcon icon={Discount01Icon} size={14} className="text-text-primary" />
                          <span>Desconto</span>
                        </label>
                        <div className="flex gap-[0.4rem]">
                          <SegmentedControl
                            aria-label="Tipo de desconto"
                            value={discountType}
                            onChange={setDiscountType}
                            size="sm"
                            fullWidth={false}
                            className="shrink-0"
                            style={{ backgroundColor: 'var(--color-bg-secondary)' }}
                            options={[
                              { id: 'fixed', label: 'R$' },
                              { id: 'percent', label: '%' },
                            ]}
                          />
                          <input
                            type="number"
                            min="0"
                            step={discountType === 'percent' ? '1' : '0.01'}
                            value={discountValue || ''}
                            onChange={(e) => setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
                            placeholder="0,00"
                            className="w-full px-[0.85rem] py-[0.55rem] text-sm font-semibold text-text-primary bg-bg-secondary shadow-[0_0_0_0.8px_var(--color-text-primary)] rounded-md outline-none transition-all duration-200 focus:shadow-[0_0_0_1.5px_var(--color-brand-primary)] [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            aria-label="Valor do desconto"
                          />
                        </div>
                      </div>

                      <GorjetaValorInput
                        value={tipValue}
                        onChange={setTipValue}
                        professionalOptions={tipProfessionalOptions}
                        selectedProfessionalId={resolvedTipProfessionalId}
                        onProfessionalChange={setTipProfessionalId}
                      />
                    </div>
                  )}

                  {/* Seção 3: Sumário de Totais (Estilo Recibo de Luxo) */}
                  <div className="p-[0.85rem_1.15rem] rounded-lg bg-bg-secondary shadow-[0_0_0_0.8px_var(--color-text-primary)] flex flex-col gap-[0.4rem]">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-text-primary font-semibold">Subtotal</span>
                      <span className="text-text-primary font-bold">R$ {subtotal.toFixed(2)}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between items-center text-xs [&_span]:text-error [&_span]:font-bold">
                        <span>
                          Desconto {discountType === 'percent' ? `(${discountValue}%)` : ''}
                        </span>
                        <span>- R$ {discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    {tipValue > 0 && (
                      <div className="flex justify-between items-center text-xs [&_span]:text-success [&_span]:font-bold">
                        <span>Gorjeta</span>
                        <span>+ R$ {tipValue.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="h-px bg-text-primary/15 my-[0.2rem]" />
                    <div className="flex justify-between items-center text-xs pt-[0.2rem]">
                      <span className="text-sm font-extrabold text-text-primary uppercase tracking-[0.04em]">
                        {isClosed ? 'TOTAL LIQUIDADO' : 'TOTAL A PAGAR'}
                      </span>
                      <span className="text-text-primary text-[1.45rem] font-extrabold tracking-[-0.02em]">R$ {totalFinal.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Seção 4: Formas de Pagamento */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-4 w-full max-md:flex-wrap max-md:gap-3">
                      <div className="inline-flex items-center gap-2 shrink-0">
                        <h4 className="text-xs font-extrabold uppercase tracking-[0.05em] text-text-primary m-0 leading-none inline-flex items-center">
                          {isClosed ? 'PAGAMENTOS REGISTRADOS' : 'FORMA DE PAGAMENTO'}
                        </h4>
                      </div>
                      {!isClosed && !isSplitting && (
                        <Button type="button" variant="secondary" size="sm" onClick={handleEnableSplit}>
                          Dividir pagamento
                        </Button>
                      )}
                      {!isClosed && isSplitting && (
                        <Button type="button" variant="secondary" size="sm" onClick={handleDisableSplit}>
                          Forma única
                        </Button>
                      )}
                    </div>

                    {/* Modo de Visualização Fechada / Recibo */}
                    {isClosed ? (
                      <div className="flex flex-col gap-3">
                        {pagamentos.map((pag, idx) => {
                          const conf = methodConfigs[pag.method] || { label: pag.method, icon: Invoice01Icon };
                          const IconComp = conf.icon;
                          return (
                            <div key={idx} className="flex items-center justify-between p-[0.85rem_1rem] rounded-lg bg-bg-primary border border-border text-sm transition-all duration-200">
                              <span className="font-bold text-text-primary flex items-center gap-[0.65rem]">
                                <span className="w-8 h-8 rounded-md bg-bg-secondary border border-border flex items-center justify-center text-brand-primary">
                                  <HugeiconsIcon icon={IconComp} size={16} />
                                </span>
                                <span>{conf.label}</span>
                              </span>
                              <strong className="text-brand-primary font-extrabold text-sm">
                                R$ {pag.amount.toFixed(2)}
                              </strong>
                            </div>
                          );
                        })}
                      </div>
                    ) : !isSplitting ? (
                      /* Modo Pagamento Único: Botões de Acesso Rápido com Ícones */
                      <div>
                        <div className="grid grid-cols-4 gap-[0.65rem] max-md:grid-cols-2">
                          {(['pix', 'credit_card', 'debit_card', 'cash'] as MetodoPagamento[]).map((m) => {
                            const conf = methodConfigs[m];
                            const IconComp = conf.icon;
                            const isSelected = pagamentos[0]?.method === m;
                            return (
                              <button
                                key={m}
                                type="button"
                                onClick={() => handleSelectSingleMethod(m)}
                                className={`flex flex-col items-center justify-center gap-[0.35rem] px-2 py-[0.65rem] border-none bg-bg-secondary rounded-lg text-xs font-bold text-text-primary cursor-pointer text-center transition-all duration-200 hover:-translate-y-px [&_svg]:transition-transform [&_svg]:duration-200 hover:[&_svg]:scale-[1.08] ${isSelected ? 'shadow-[0_0_0_1.5px_var(--color-brand-primary),var(--shadow-sm)] text-brand-deep [&_svg]:!text-brand-primary' : 'shadow-[0_0_0_0.8px_var(--color-text-primary)] hover:shadow-[0_0_0_0.8px_var(--color-text-primary),var(--shadow-sm)]'}`}
                              >
                                <HugeiconsIcon icon={IconComp} size={18} className="text-text-primary" />
                                <span>{conf.shortLabel || conf.label}</span>
                              </button>
                            );
                          })}
                        </div>

                        {pagamentos[0]?.method === 'cash' && (
                          <div className="mt-[0.85rem] p-[1rem_1.15rem] rounded-lg bg-bg-primary border-none shadow-[0_0_0_0.8px_var(--color-text-primary)] flex flex-col gap-[0.95rem] animate-fade-in">
                            <div className="flex items-center flex-wrap gap-2">
                              <span className="text-xs font-bold text-text-primary mr-1">Cédulas rápidas:</span>
                              <button
                                type="button"
                                className={`px-[0.85rem] py-[0.35rem] rounded-full border-none shadow-[0_0_0_0.8px_var(--color-text-primary)] text-xs font-bold cursor-pointer transition-all duration-150 hover:brightness-[0.96] hover:-translate-y-px ${
                                  pagamentos[0]?.receivedCash === totalFinal ? 'bg-brand-soft text-text-primary hover:bg-brand-soft' : 'bg-bg-secondary text-text-primary'
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
                                    className={`px-[0.85rem] py-[0.35rem] rounded-full border-none shadow-[0_0_0_0.8px_var(--color-text-primary)] text-xs font-bold cursor-pointer transition-all duration-150 hover:brightness-[0.96] hover:-translate-y-px ${
                                      pagamentos[0]?.receivedCash === note ? 'bg-brand-soft text-text-primary hover:bg-brand-soft' : 'bg-bg-secondary text-text-primary'
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

                            <label className="flex items-center justify-between gap-3">
                              <span className="text-xs font-bold text-text-primary">Valor entregue pelo cliente:</span>
                              <div className="relative flex items-center w-[140px]">
                                <span className="absolute left-[0.85rem] text-sm font-bold text-text-primary pointer-events-none">R$</span>
                                <input
                                  type="number"
                                  min={totalFinal}
                                  step="0.01"
                                  value={pagamentos[0]?.receivedCash || ''}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setPagamentos([{ ...pagamentos[0], receivedCash: val }]);
                                  }}
                                  className="w-full py-2 pr-3 pl-8 text-sm font-extrabold text-text-primary bg-bg-secondary border-none shadow-[0_0_0_0.8px_var(--color-text-primary)] rounded-md outline-none text-center transition-all duration-200 [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:shadow-[0_0_0_1.5px_var(--color-text-primary)]"
                                  placeholder="0,00"
                                />
                              </div>
                            </label>

                            {pagamentos[0]?.receivedCash > totalFinal && (
                              <div className="flex items-center justify-between p-[0.75rem_1rem] rounded-md bg-bg-secondary border-none shadow-[0_0_0_0.8px_var(--color-text-primary)] text-text-primary text-xs">
                                <div className="flex items-center gap-2 font-bold text-text-primary [&_svg]:h-fit [&_svg]:text-text-primary [&_svg_path]:stroke-text-primary [&_svg_path]:[stroke:var(--color-text-primary)] [&_svg_ellipse]:stroke-text-primary">
                                  <HugeiconsIcon icon={Coins01Icon} size={18} />
                                  <span>Troco a devolver:</span>
                                </div>
                                <strong className="text-base font-extrabold text-text-primary">
                                  R$ {comRepo.calculateChange(totalFinal, pagamentos[0].receivedCash).toFixed(2)}
                                </strong>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Modo Pagamento Dividido */
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-3">
                          {pagamentos.map((pag, idx) => {
                            const change =
                              pag.method === 'cash' ? comRepo.calculateChange(pag.amount, pag.receivedCash) : 0;

                            return (
                              <div key={idx} className="p-[0.85rem_1rem] rounded-lg bg-bg-secondary border-none shadow-[0_0_0_0.8px_var(--color-text-primary)] flex flex-col gap-3">
                                <div className="flex items-center gap-2">
                                  <Select
                                    className="flex-[1.2]"
                                    value={pag.method}
                                    onChange={(e) => {
                                      const newMethod = e.target.value as MetodoPagamento;
                                      setPagamentos((prev) =>
                                        prev.map((p, i) =>
                                          i === idx ? { ...p, method: newMethod } : p
                                        )
                                      );
                                    }}
                                    aria-label="Forma de pagamento"
                                  >
                                    <option value="pix">PIX</option>
                                    <option value="credit_card">Cartão de crédito</option>
                                    <option value="debit_card">Cartão de débito</option>
                                    <option value="cash">Dinheiro</option>
                                    <option value="other">Outro</option>
                                  </Select>

                                  <div className="flex-1 relative flex items-center">
                                    <span className="absolute left-[0.85rem] text-xs font-bold text-text-primary pointer-events-none">R$</span>
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
                                      className="w-full py-[0.6rem] pr-3 pl-8 text-sm font-extrabold text-text-primary bg-bg-secondary border-none shadow-[0_0_0_0.8px_var(--color-text-primary)] rounded-lg outline-none text-center transition-all duration-200 [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:shadow-[0_0_0_1.5px_var(--color-text-primary)]"
                                      aria-label="Valor desta forma"
                                    />
                                  </div>

                                  {pagamentos.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemovePagamentoLinha(idx)}
                                      className="bg-transparent border-none text-text-primary cursor-pointer p-[0.4rem] rounded-md transition-all duration-200 flex items-center justify-center [&_svg_path]:stroke-text-primary hover:text-error hover:bg-error-bg hover:[&_svg_path]:stroke-error"
                                      title="Remover forma de pagamento"
                                      aria-label="Remover forma de pagamento"
                                    >
                                      <HugeiconsIcon icon={Delete02Icon} size={16} />
                                    </button>
                                  )}
                                </div>

                                {pag.method === 'cash' && (
                                  <div className="flex items-center justify-between pt-1 border-none text-xs">
                                    <label className="flex items-center gap-2 text-xs text-text-primary font-bold [&_span]:text-text-primary [&_span]:font-bold">
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
                                        className="w-[90px] px-[0.55rem] py-[0.35rem] text-xs font-extrabold text-text-primary bg-bg-secondary border-none shadow-[0_0_0_0.8px_var(--color-text-primary)] rounded-md text-center [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      />
                                    </label>
                                    {change > 0 && (
                                      <div className="flex items-center gap-[0.35rem] text-text-primary font-bold [&_strong]:text-text-primary [&_strong]:font-extrabold">
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

                        <div className="flex flex-col gap-3 mt-1">
                          <button
                            type="button"
                            onClick={handleAddPagamentoLinha}
                            className="inline-flex items-center gap-2 p-[0.75rem_1rem] rounded-lg border-none shadow-[0_0_0_0.8px_var(--color-text-primary)] bg-bg-secondary text-text-primary text-xs font-bold cursor-pointer w-full justify-center transition-all duration-200 hover:bg-brand-lightest hover:-translate-y-px [&_svg]:h-fit [&_svg]:text-text-primary [&_svg_path]:stroke-text-primary [&_span]:text-text-primary"
                          >
                            <HugeiconsIcon icon={Invoice01Icon} size={15} />
                            <span>Adicionar outra forma de pagamento</span>
                          </button>
                          <div className="flex items-center justify-between p-[0.75rem_1rem] rounded-lg bg-bg-secondary border-none shadow-[0_0_0_0.8px_var(--color-text-primary)] text-xs font-bold">
                            <div className="flex items-center gap-[0.4rem] text-text-primary text-xs font-bold [&_span]:text-text-primary [&_span]:font-bold [&_strong]:text-text-primary [&_strong]:font-extrabold">
                              <span>Total: <strong>R$ {totalFinal.toFixed(2)}</strong></span>
                              <span className="text-text-primary mx-[0.15rem]">•</span>
                              <span>Pago: <strong>R$ {totalPago.toFixed(2)}</strong></span>
                            </div>
                            {saldoRestante > 0 ? (
                              <span className="text-error bg-error-bg px-3 py-1 rounded-full border-none shadow-[0_0_0_0.8px_var(--color-error)] font-bold text-xs">
                                Falta: R$ {saldoRestante.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-white bg-success-solid px-3 py-1 rounded-full border-none font-bold text-xs">
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
            <div className="p-[1.25rem_1.5rem] border-t border-text-primary shadow-[0_0_0_0.8px_var(--color-text-primary)] bg-bg-secondary shrink-0 max-md:p-[1rem_1.25rem_max(1.25rem,env(safe-area-inset-bottom,1.25rem))]">
              {isClosed ? (
                <div className="flex items-center justify-between gap-[0.85rem] w-full max-md:flex-col-reverse max-md:gap-[0.65rem]">
                  <button
                    type="button"
                    onClick={() => setReopenConfirmOpen(true)}
                    disabled={isReopening}
                    className="px-5 py-[0.65rem] rounded-full border-[1.5px] border-brand-primary bg-transparent text-brand-primary text-xs font-bold cursor-pointer inline-flex items-center gap-[0.45rem] transition-all duration-200 enabled:hover:bg-brand-lightest enabled:hover:-translate-y-px max-md:w-full max-md:min-h-[44px] max-md:justify-center max-md:text-center max-md:py-[0.65rem] max-md:px-2 max-md:whitespace-nowrap"
                  >
                    <HugeiconsIcon icon={AlertCircleIcon} size={16} />
                    <span>{isReopening ? 'Reabrindo...' : 'Reabrir comanda'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-[1.65rem] py-3 rounded-full shadow-[0_0_0_1px_var(--color-text-primary)] bg-success-bg text-text-primary text-sm font-bold cursor-pointer inline-flex items-center gap-[0.65rem] transition-all duration-200 enabled:hover:brightness-[0.96] enabled:hover:-translate-y-px active:enabled:scale-[0.98] disabled:bg-border disabled:text-text-secondary disabled:shadow-none disabled:cursor-not-allowed max-md:w-full max-md:min-h-[48px] max-md:justify-center max-md:px-4 max-md:whitespace-nowrap"
                  >
                    Fechar
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-[0.85rem] w-full max-md:flex-col-reverse max-md:gap-[0.65rem]">
                  <div className="flex items-center gap-2 max-md:grid max-md:grid-cols-2 max-md:gap-2 max-md:w-full">
                    <button
                      type="button"
                      onClick={() => setCancelConfirmOpen(true)}
                      className="px-[1.15rem] py-3 rounded-full border border-error bg-transparent text-error text-sm font-semibold cursor-pointer transition-[background-color,border-color,color,opacity] duration-150 hover:bg-error-bg hover:border-error hover:text-error active:opacity-80 max-md:w-full max-md:min-h-[44px] max-md:justify-center max-md:text-center max-md:py-[0.65rem] max-md:px-2 max-md:text-xs max-md:whitespace-nowrap max-md:inline-flex max-md:items-center"
                      title="Cancelar este agendamento e comanda"
                    >
                      Cancelar atendimento
                    </button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={onClose}
                      className="hover:not-disabled:bg-bg-secondary max-md:w-full"
                    >
                      Fechar
                    </Button>
                  </div>
                  <button
                    type="button"
                    disabled={isSubmitting || saldoRestante > 0 || itens.length === 0}
                    onClick={handleFinalizar}
                    className="px-[1.65rem] py-3 rounded-full shadow-[0_0_0_1px_var(--color-text-primary)] bg-success-solid text-white text-sm font-bold cursor-pointer inline-flex items-center gap-[0.65rem] transition-all duration-200 enabled:hover:brightness-[0.96] enabled:hover:-translate-y-px active:enabled:scale-[0.98] disabled:bg-border disabled:text-text-secondary disabled:shadow-none disabled:cursor-not-allowed max-md:w-full max-md:min-h-[48px] max-md:justify-center max-md:px-4 max-md:text-sm max-md:whitespace-nowrap"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Processando...</span>
                      </>
                    ) : (
                      <>
                        <span>Finalizar e receber</span>
                        <span className="bg-transparent px-1 py-[0.15rem] rounded-full text-sm font-extrabold text-white">R$ {totalFinal.toFixed(2)}</span>
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
        @keyframes slideUpMobile {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
};
