import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { AddCircleIcon, UnavailableIcon, WhatsappIcon } from '@hugeicons/core-free-icons';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import type { BarbeiroContextType } from '../../components/BarbeiroLayout';
import { MobileBottomSheet } from '../../components/mobile/MobileBottomSheet';
import { BloqueioModal } from '../../components/bloqueios/BloqueioModal';
import { ConfirmSoftDeleteModal } from '../../components/cadastros/ConfirmSoftDeleteModal';
import { NovoAgendamentoModal } from '../../components/agenda/NovoAgendamentoModal';
import type { NovoAgendamentoInicial } from '../../components/agenda/NovoAgendamentoModal';
import { CancelarAgendamentoModal } from '../../components/agenda/CancelarAgendamentoModal';
import { NaoCompareceuModal } from '../../components/agenda/NaoCompareceuModal';
import { PainelCanceladosDoDia } from '../../components/agenda/PainelCanceladosDoDia';
import { Badge } from '../../components/ui/data-display/Badge';
import { ReagendarAgendamentoModal } from '../../components/agenda/ReagendarAgendamentoModal';
import { motivoRecusaNaoCompareceu } from '../../components/agenda/useMarcarNaoCompareceu';
import { useAgenda } from '../../modules/agenda/useAgenda';
import type { AgendamentoDoDia } from '../../modules/agenda/types';
import { MobileAgendaView } from '../gerente/mobile/MobileAgendaView';
import type { Appointment, Customer, Professional, Service } from '../gerente/Agenda';
import { BloqueioRepository } from '../../modules/bloqueios/BloqueioRepository';
import { SupabaseBloqueioAdapter } from '../../modules/bloqueios/adapters/SupabaseBloqueioAdapter';
import type { BlockedSlot } from '../../modules/bloqueios/types';
import {
  dateInZone,
  formatTimeInZone,
  localDayUtcRange,
} from '../../lib/timezone';
import {
  generateScheduleGridSlots,
  getDayBusinessHours,
  getEffectiveProfessionalDaySchedule,
  normalizeSlotIntervalMinutes,
  toScheduleGridSegment,
} from '../../lib/schedule';
import { openWhatsApp } from '../../lib/whatsapp';

const bloqueioRepository = new BloqueioRepository(new SupabaseBloqueioAdapter());

const ACTIVE_STATUSES_TO_CANCEL: Appointment['status'][] = ['pending', 'confirmed', 'in_progress'];
const ACTIVE_STATUSES_TO_RESCHEDULE: Appointment['status'][] = ['pending', 'confirmed'];

const ACTION_BUTTON_CLASS =
  'w-full flex items-center justify-center gap-2 min-h-11 py-[0.6rem] px-4 rounded-md text-sm font-bold cursor-pointer border-0 box-border transition-colors duration-150';

/**
 * Agenda do barbeiro: os Agendamentos dele, no mesmo componente que o gestor usa no celular. Toda
 * escrita passa pelas RPCs do banco (AgendaRepository); a Comanda e a cobrança ficam com o gestor.
 */
export const MinhaAgenda: React.FC = () => {
  const tenant = useOutletContext<BarbeiroContextType>();
  const { addToast } = useToast();
  const agendaRepo = useAgenda();
  const { tenantId, timezone, businessHours, professionalId } = tenant;

  const slotIntervalMinutes = normalizeSlotIntervalMinutes(tenant.slotIntervalMinutes, 30);

  const [selectedDate, setSelectedDate] = useState<string>(() => dateInZone(new Date(), timezone));
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [cancelados, setCancelados] = useState<AgendamentoDoDia[]>([]);
  const [canceladosComErro, setCanceladosComErro] = useState(false);
  const [isCanceladosOpen, setIsCanceladosOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  // Só a resposta da consulta mais recente vale: ao trocar de dia rápido, a antiga chega depois e
  // mostraria os atendimentos de outro dia sob a data nova.
  const latestDayRequest = useRef(0);

  const [novoInicial, setNovoInicial] = useState<NovoAgendamentoInicial | null>(null);
  const [isNovoOpen, setIsNovoOpen] = useState(false);
  const [isBloqueioOpen, setIsBloqueioOpen] = useState(false);
  const [blockPendingRemoval, setBlockPendingRemoval] = useState<BlockedSlot | null>(null);
  const [isRemovingBlock, setIsRemovingBlock] = useState(false);

  const [actionAppointment, setActionAppointment] = useState<Appointment | null>(null);
  const [cancelAppointment, setCancelAppointment] = useState<Appointment | null>(null);
  const [noShowAppointment, setNoShowAppointment] = useState<Appointment | null>(null);
  const [rescheduleAppointment, setRescheduleAppointment] = useState<Appointment | null>(null);

  // Cadastros de apoio: o profissional dele, os serviços que ele executa e os clientes da barbearia.
  const loadSupportData = useCallback(async () => {
    if (!tenantId || !professionalId) return;
    try {
      const cadastros = await agendaRepo.carregarCadastrosDoProfissional(tenantId, professionalId);
      setProfessional(cadastros.professional);
      setServices(cadastros.services);
      setCustomers(cadastros.customers);
    } catch (err) {
      console.error('Erro ao carregar dados da agenda do barbeiro:', err);
      addToast('Não foi possível carregar seus dados de agenda.', 'error');
    }
  }, [agendaRepo, tenantId, professionalId, addToast]);

  const fetchDay = useCallback(async () => {
    if (!tenantId || !professionalId) return;
    const requestId = ++latestDayRequest.current;
    try {
      const { start, endExclusive } = localDayUtcRange(selectedDate, timezone);
      const intervalo = { startIso: start, endExclusiveIso: endExclusive };
      // Duas leituras independentes: a falha de uma não esconde a outra.
      const [agendamentos, bloqueios] = await Promise.allSettled([
        agendaRepo.carregarAgendamentosDoDia(tenantId, { professionalId, ...intervalo, incluirCancelados: true }),
        agendaRepo.carregarBloqueiosDoDia(tenantId, intervalo),
      ]);
      if (requestId !== latestDayRequest.current) return;

      if (bloqueios.status === 'fulfilled') {
        setBlockedSlots(bloqueios.value);
      } else {
        console.error('Erro ao carregar os bloqueios do barbeiro:', bloqueios.reason);
      }

      if (agendamentos.status === 'fulfilled') {
        setAppointments(agendamentos.value.appointments);
        setCancelados(agendamentos.value.canceledAppointments);
        setCanceladosComErro(false);
      } else {
        console.error('Erro ao carregar a agenda do barbeiro:', agendamentos.reason);
        setCancelados([]);
        setCanceladosComErro(true);
        addToast('Não foi possível carregar seus atendimentos.', 'error');
      }
    } finally {
      if (requestId === latestDayRequest.current) setLoading(false);
    }
  }, [agendaRepo, tenantId, professionalId, selectedDate, timezone, addToast]);

  useEffect(() => {
    void loadSupportData();
  }, [loadSupportData]);

  useEffect(() => {
    if (!professionalId) {
      setLoading(false);
      return;
    }
    void fetchDay();

    if (typeof supabase.channel !== 'function') return;
    const channel = supabase
      .channel(`minha-agenda-${tenantId}-${professionalId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments', filter: `tenant_id=eq.${tenantId}` },
        () => void fetchDay()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'blocked_slots', filter: `tenant_id=eq.${tenantId}` },
        () => void fetchDay()
      )
      .subscribe();

    return () => {
      if (typeof supabase.removeChannel === 'function') supabase.removeChannel(channel);
    };
  }, [fetchDay, tenantId, professionalId]);

  const professionals = useMemo(() => (professional ? [professional] : []), [professional]);

  // Régua do dia: a escala do próprio barbeiro (ou o expediente da barbearia, se ele não tem escala).
  const timeSlots = useMemo(() => {
    if (!professional) return [];
    const dayBh = getDayBusinessHours(selectedDate, businessHours);
    if (!dayBh.active) return [];
    const segment = toScheduleGridSegment(
      getEffectiveProfessionalDaySchedule(professional, selectedDate, businessHours)
    );
    return generateScheduleGridSlots(
      [segment || { start: dayBh.open || '08:00', end: dayBh.close || '20:00' }],
      slotIntervalMinutes
    );
  }, [professional, selectedDate, businessHours, slotIntervalMinutes]);

  const abrirNovo = (opts: { isFitting: boolean; time?: string }) => {
    if (!opts.isFitting && !getDayBusinessHours(selectedDate, businessHours).active) {
      addToast('A barbearia não abre neste dia conforme as configurações de funcionamento.', 'warning');
      return;
    }
    const currentLocalTime = formatTimeInZone(new Date().toISOString(), timezone);
    setNovoInicial({
      date: selectedDate,
      time: opts.time || timeSlots.find((slot) => slot >= currentLocalTime) || timeSlots[0] || '09:00',
      professionalId,
      isFitting: opts.isFitting,
      customerMode: 'existing',
    });
    setIsNovoOpen(true);
  };

  const handleConfirmRemoveBlock = async () => {
    if (!blockPendingRemoval || isRemovingBlock) return;
    setIsRemovingBlock(true);
    try {
      await bloqueioRepository.deleteBlock(blockPendingRemoval.id, tenantId);
      addToast('Bloqueio removido com sucesso!', 'success');
      setBlockPendingRemoval(null);
      await fetchDay();
    } catch {
      addToast('Erro ao remover bloqueio.', 'error');
    } finally {
      setIsRemovingBlock(false);
    }
  };

  const handleMarkNoShow = (app: Appointment) => {
    const recusa = motivoRecusaNaoCompareceu(app);
    if (recusa) {
      addToast(recusa, 'warning');
      return;
    }
    setActionAppointment(null);
    setNoShowAppointment(app);
  };

  if (!professionalId) {
    return (
      <div className="max-w-[420px] w-full mx-auto flex flex-col items-center text-center gap-3 py-10 px-6 bg-bg-secondary rounded-lg shadow-lg border border-border">
        <h3 className="text-base font-bold text-text-primary m-0">Acesso não vinculado</h3>
        <p className="text-text-secondary text-sm leading-normal m-0">
          Nenhum cadastro de profissional vinculado a esta conta de usuário. Entre em contato com o gerente.
        </p>
      </div>
    );
  }

  const canReschedule = (app: Appointment) => ACTIVE_STATUSES_TO_RESCHEDULE.includes(app.status);
  const canCancel = (app: Appointment) => ACTIVE_STATUSES_TO_CANCEL.includes(app.status);

  return (
    <div className="max-w-[640px] w-full mx-auto flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="flex-1 inline-flex items-center justify-center gap-2 min-h-11 py-2 px-4 rounded-md border-none bg-brand-primary text-brand-lightest text-sm font-bold cursor-pointer transition-colors duration-150 hover:bg-brand-hover"
          onClick={() => abrirNovo({ isFitting: false })}
        >
          <HugeiconsIcon icon={AddCircleIcon} size={18} />
          Novo agendamento
        </button>
        <button
          type="button"
          className="flex-1 inline-flex items-center justify-center gap-2 min-h-11 py-2 px-4 rounded-md bg-bg-secondary border border-border text-text-primary text-sm font-bold cursor-pointer transition-colors duration-150 hover:border-brand-primary"
          onClick={() => abrirNovo({ isFitting: true })}
        >
          Encaixe
        </button>
        <button
          type="button"
          className="flex-1 inline-flex items-center justify-center gap-2 min-h-11 py-2 px-4 rounded-md bg-bg-secondary border border-border text-text-primary text-sm font-bold cursor-pointer transition-colors duration-150 hover:border-brand-primary"
          onClick={() => setIsBloqueioOpen(true)}
        >
          <HugeiconsIcon icon={UnavailableIcon} size={18} />
          Bloquear horário
        </button>
        <button
          type="button"
          className="flex-1 inline-flex items-center justify-center gap-2 min-h-11 py-2 px-4 rounded-md bg-bg-secondary border border-border text-text-primary text-sm font-bold cursor-pointer transition-colors duration-150 hover:border-brand-primary"
          onClick={() => setIsCanceladosOpen(true)}
        >
          Cancelados
          {!canceladosComErro && (
            <Badge variant="neutral" badgeType="subtle" size="sm">
              {cancelados.length}
            </Badge>
          )}
        </button>
      </div>

      {loading ? (
        <div className="h-[220px] w-full rounded-lg bg-[linear-gradient(90deg,var(--color-bg-secondary)_25%,var(--color-border)_37%,var(--color-bg-secondary)_63%)] bg-[length:400%_100%] animate-shimmer" />
      ) : (
        <MobileAgendaView
          timezone={timezone}
          businessHours={businessHours}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          professionals={professionals}
          appointments={appointments}
          blockedSlots={blockedSlots}
          timeSlots={timeSlots}
          cardActionHint="ver as ações do agendamento"
          onOpenNewAppointment={(_professionalId, timeSlot, isFitting) =>
            abrirNovo({ isFitting: Boolean(isFitting), time: timeSlot })
          }
          onOpenCheckout={setActionAppointment}
          onMarkNoShow={handleMarkNoShow}
          onRemoveBlock={setBlockPendingRemoval}
        />
      )}

      {/* Ações do Agendamento */}
      <MobileBottomSheet
        isOpen={Boolean(actionAppointment)}
        onClose={() => setActionAppointment(null)}
        title={actionAppointment?.customer?.name || 'Cliente Balcão'}
      >
        {actionAppointment && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-text-secondary m-0 mb-1">
              {actionAppointment.service?.name} às{' '}
              {formatTimeInZone(actionAppointment.start_time, timezone)}
            </p>

            {actionAppointment.customer?.phone && (
              <button
                type="button"
                className={`${ACTION_BUTTON_CLASS} bg-bg-secondary text-success shadow-[0_0_0_0.8px_var(--color-text-primary)]`}
                onClick={() => {
                  const customer = actionAppointment.customer;
                  if (!customer) return;
                  openWhatsApp(
                    customer.phone,
                    `Olá ${customer.name}! Confirmando seu horário de atendimento às ${formatTimeInZone(
                      actionAppointment.start_time,
                      timezone
                    )} na ${tenant.tenantName}.`
                  );
                }}
              >
                <HugeiconsIcon icon={WhatsappIcon} size={18} />
                Chamar no WhatsApp
              </button>
            )}

            {canReschedule(actionAppointment) && (
              <button
                type="button"
                className={`${ACTION_BUTTON_CLASS} bg-brand-primary text-brand-lightest hover:bg-brand-hover`}
                onClick={() => {
                  setRescheduleAppointment(actionAppointment);
                  setActionAppointment(null);
                }}
              >
                Reagendar
              </button>
            )}

            {motivoRecusaNaoCompareceu(actionAppointment) === null && (
              <button
                type="button"
                className={`${ACTION_BUTTON_CLASS} bg-bg-secondary text-text-primary shadow-[0_0_0_0.8px_var(--color-text-primary)]`}
                onClick={() => handleMarkNoShow(actionAppointment)}
              >
                Marcar não compareceu
              </button>
            )}

            {canCancel(actionAppointment) && (
              <button
                type="button"
                className={`${ACTION_BUTTON_CLASS} bg-error text-white`}
                onClick={() => {
                  setCancelAppointment(actionAppointment);
                  setActionAppointment(null);
                }}
              >
                Cancelar agendamento
              </button>
            )}
          </div>
        )}
      </MobileBottomSheet>

      <NovoAgendamentoModal
        isOpen={isNovoOpen}
        initial={novoInicial}
        tenantId={tenantId}
        timezone={timezone}
        businessHours={businessHours}
        slotIntervalMinutes={slotIntervalMinutes}
        professionals={professionals}
        services={services}
        customers={customers}
        appointments={appointments}
        lockedProfessionalId={professionalId}
        onClose={() => setIsNovoOpen(false)}
        onSaved={({ newCustomer }) => {
          if (newCustomer) setCustomers((previous) => [...previous, newCustomer]);
          void fetchDay();
        }}
      />

      <ReagendarAgendamentoModal
        isOpen={Boolean(rescheduleAppointment)}
        appointment={rescheduleAppointment}
        tenantId={tenantId}
        timezone={timezone}
        businessHours={businessHours}
        slotIntervalMinutes={slotIntervalMinutes}
        professionals={professionals}
        appointments={appointments}
        blockedSlots={blockedSlots}
        fallbackDate={selectedDate}
        lockedProfessionalId={professionalId}
        onClose={() => setRescheduleAppointment(null)}
        onAtualizar={() => void fetchDay()}
      />

      <CancelarAgendamentoModal
        isOpen={Boolean(cancelAppointment)}
        appointment={cancelAppointment}
        tenantId={tenantId}
        onClose={() => setCancelAppointment(null)}
        onCancelado={(appointmentId) => {
          setAppointments((previous) => previous.filter((a) => a.id !== appointmentId));
          void fetchDay();
        }}
      />

      <NaoCompareceuModal
        isOpen={Boolean(noShowAppointment)}
        appointment={noShowAppointment}
        tenantId={tenantId}
        onClose={() => setNoShowAppointment(null)}
        onResultado={(appointmentId, resultado) => {
          if (resultado === 'marcado') {
            setAppointments((previous) =>
              previous.map((a) => (a.id === appointmentId ? { ...a, status: 'no_show' } : a))
            );
          }
          void fetchDay();
        }}
      />

      <PainelCanceladosDoDia
        isOpen={isCanceladosOpen}
        onClose={() => setIsCanceladosOpen(false)}
        cancelados={cancelados}
        profissionais={professionals}
        timezone={timezone}
        falhouAoCarregar={canceladosComErro}
      />
      <BloqueioModal
        isOpen={isBloqueioOpen}
        tenantId={tenantId}
        professionals={professionals}
        appointments={appointments}
        blockedSlots={blockedSlots}
        defaultDateIso={selectedDate}
        defaultProfessionalId={professionalId}
        timezone={timezone}
        businessHours={businessHours}
        slotIntervalMinutes={slotIntervalMinutes}
        onClose={() => setIsBloqueioOpen(false)}
        onBloqueioCriado={() => {
          setIsBloqueioOpen(false);
          addToast('Bloqueio criado com sucesso!', 'success');
          void fetchDay();
        }}
      />

      <ConfirmSoftDeleteModal
        isOpen={Boolean(blockPendingRemoval)}
        title="Remover bloqueio"
        itemName={blockPendingRemoval?.reason || 'de horário'}
        itemTypeLabel="o bloqueio"
        warningText="O horário voltará a ficar disponível para novos agendamentos após a remoção."
        loading={isRemovingBlock}
        onConfirm={handleConfirmRemoveBlock}
        onClose={() => {
          if (!isRemovingBlock) setBlockPendingRemoval(null);
        }}
      />
    </div>
  );
};
