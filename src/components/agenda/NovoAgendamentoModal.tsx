import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../Modal';
import { Select } from '../ui';
import { useToast } from '../Toast';
import { AgendaOperationError, AgendaValidationError } from '../../modules/agenda/AgendaRepository';
import { useAgenda } from '../../modules/agenda/useAgenda';
import type { ClienteDoAgendamento } from '../../modules/agenda/types';
import { dateInZone, formatTimeInZone, localDateTimeToIso } from '../../lib/timezone';
import {
  buildFittingAppointmentInterval,
  generateScheduleGridSlots,
  getDayBusinessHours,
  getEffectiveProfessionalDaySchedule,
  getEffectiveServiceDuration,
  isProfessionalWorkingAt,
  isValidFittingStartTime,
  toScheduleGridSegment,
} from '../../lib/schedule';
import type { FittingTimeMode, ScheduleGridSegment } from '../../lib/schedule';
import type { Appointment, Customer, Professional, Service } from '../../pages/gerente/Agenda';
import { ANY_PROFESSIONAL } from './constantes';

export type ModoCliente = 'existing' | 'new' | 'none';

/** Valores de partida do formulário. A tela cria um objeto novo a cada abertura. */
export interface NovoAgendamentoInicial {
  date: string;
  time: string;
  /** Vazio deixa o modal escolher o primeiro profissional disponível. */
  professionalId: string;
  serviceId?: string;
  isFitting: boolean;
  customerMode: ModoCliente;
  customerId?: string;
  newCustomerName?: string;
  newCustomerPhone?: string;
  notes?: string;
  /** Entrada da Lista de Espera consumida só quando o Agendamento for salvo. */
  waitingEntryId?: string | null;
}

interface NovoAgendamentoModalProps {
  isOpen: boolean;
  initial: NovoAgendamentoInicial | null;
  tenantId: string;
  timezone: string;
  businessHours?: Record<string, { active: boolean; open: string; close: string }>;
  slotIntervalMinutes: number;
  professionals: Professional[];
  services: Service[];
  customers: Customer[];
  /** Agendamentos carregados, para o aviso antecipado do limite de encaixe. */
  appointments: Appointment[];
  /** Barbeiro cria só na própria agenda: o profissional fica travado e "Tanto faz" some. */
  lockedProfessionalId?: string;
  onClose: () => void;
  /** Depois de salvar. `newCustomer` vem quando o cliente foi cadastrado junto. */
  onSaved: (result: { newCustomer?: Customer }) => void;
}

/** Novo agendamento ou encaixe. Todas as regras de negócio ficam no banco (criarAgendamento). */
export const NovoAgendamentoModal: React.FC<NovoAgendamentoModalProps> = ({
  isOpen,
  initial,
  tenantId,
  timezone,
  businessHours,
  slotIntervalMinutes,
  professionals: allProfessionals,
  services,
  customers,
  appointments,
  lockedProfessionalId,
  onClose,
  onSaved,
}) => {
  const agendaRepo = useAgenda();
  const { addToast } = useToast();

  const professionals = useMemo(
    () =>
      lockedProfessionalId
        ? allProfessionals.filter((p) => p.id === lockedProfessionalId)
        : allProfessionals,
    [allProfessionals, lockedProfessionalId]
  );

  const [formDate, setFormDate] = useState('');
  const [formProfessionalId, setFormProfessionalId] = useState('');
  const [formServiceId, setFormServiceId] = useState('');
  const [formTime, setFormTime] = useState('09:00');
  const [formIsFitting, setFormIsFitting] = useState(false);
  const [fittingTimeMode, setFittingTimeMode] = useState<FittingTimeMode>('grid');
  const [formNotes, setFormNotes] = useState('');
  const [customerMode, setCustomerMode] = useState<ModoCliente>('existing');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [pendingWaitingEntryId, setPendingWaitingEntryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Cada abertura recomeça do zero a partir do que a tela mandou. O reinício acontece durante a
  // renderização (não num efeito) para que os efeitos abaixo já enxerguem a data e o horário novos:
  // com o estado antigo, "horário decorrido" forçaria encaixe numa abertura de horário futuro.
  const [appliedInitial, setAppliedInitial] = useState<NovoAgendamentoInicial | null>(null);
  if (isOpen && initial && initial !== appliedInitial) {
    setAppliedInitial(initial);
    setFormDate(initial.date);
    setFormTime(initial.time);
    setFormProfessionalId(lockedProfessionalId || initial.professionalId);
    // Sem serviço na partida, mantém o último escolhido (como a Agenda fazia) ou cai no primeiro.
    setFormServiceId((previous) =>
      initial.serviceId ||
      (previous && services.some((s) => s.id === previous) ? previous : services[0]?.id || '')
    );
    setFormIsFitting(initial.isFitting);
    setFittingTimeMode('grid');
    setFormNotes(initial.notes || '');
    setCustomerMode(initial.customerMode);
    setSelectedCustomerId(initial.customerId || '');
    setNewCustomerName(initial.newCustomerName || '');
    setNewCustomerPhone(initial.newCustomerPhone || '');
    setPendingWaitingEntryId(initial.waitingEntryId ?? null);
  }

  // Serviços podem chegar depois da abertura: parte do primeiro da lista.
  useEffect(() => {
    if (isOpen && !formServiceId && services.length > 0) {
      setFormServiceId(services[0].id);
    }
  }, [isOpen, formServiceId, services]);

  // Slots de Horário válidos para seleção
  const modalAvailableTimeSlots = useMemo(() => {
    const dayBh = getDayBusinessHours(formDate, businessHours);
    if (!dayBh.active) return [];

    const filterNormalServiceSlots = (slots: string[]): string[] => {
      if (formIsFitting || !formServiceId) return slots;

      const service = services.find((item) => item.id === formServiceId);
      if (!service) return slots;

      const candidateProfessionals = formProfessionalId && formProfessionalId !== ANY_PROFESSIONAL
        ? professionals.filter((professional) => professional.id === formProfessionalId)
        : professionals.filter((professional) => professional.is_active);

      if (candidateProfessionals.length === 0) return [];

      return slots.filter((slot) => candidateProfessionals.some((professional) => {
        const duration = getEffectiveServiceDuration(
          service.duration_minutes,
          service.id,
          professional.professional_services
        );

        return isProfessionalWorkingAt(professional, formDate, slot, duration, businessHours);
      }));
    };

    if (formIsFitting && fittingTimeMode === 'grid') {
      if (formProfessionalId && formProfessionalId !== ANY_PROFESSIONAL) {
        const selectedProf = professionals.find((p) => p.id === formProfessionalId);
        const selectedProfSchedule = selectedProf
          ? getEffectiveProfessionalDaySchedule(selectedProf, formDate, businessHours)
          : null;

        if (selectedProfSchedule?.active === false) return [];

        const selectedSegment = selectedProfSchedule
          ? toScheduleGridSegment(selectedProfSchedule)
          : null;
        if (selectedSegment) {
          return generateScheduleGridSlots([selectedSegment], slotIntervalMinutes);
        }
      }

      const fittingSchedules: ScheduleGridSegment[] = [];
      professionals.forEach((professional) => {
        if (!professional.is_active) return;
        const schedule = getEffectiveProfessionalDaySchedule(professional, formDate, businessHours);
        const segment = toScheduleGridSegment(schedule);
        if (segment) fittingSchedules.push(segment);
      });

      if (fittingSchedules.length > 0) {
        return generateScheduleGridSlots(fittingSchedules, slotIntervalMinutes);
      }

      return generateScheduleGridSlots(
        [{ start: dayBh.open, end: dayBh.close }],
        slotIntervalMinutes
      );
    }

    if (formProfessionalId) {
      const prof = professionals.find((p) => p.id === formProfessionalId);
      const profSched = prof
        ? getEffectiveProfessionalDaySchedule(prof, formDate, businessHours)
        : null;
      if (profSched?.active === false) return [];
      const segment = profSched ? toScheduleGridSegment(profSched) : null;
      if (segment) {
        return filterNormalServiceSlots(generateScheduleGridSlots([segment], slotIntervalMinutes));
      }
    }

    const schedules: ScheduleGridSegment[] = [];
    professionals.forEach((p) => {
      if (!p.is_active) return;
      const sched = getEffectiveProfessionalDaySchedule(p, formDate, businessHours);
      const segment = toScheduleGridSegment(sched);
      if (segment) schedules.push(segment);
    });

    if (schedules.length === 0) {
      schedules.push({ start: dayBh.open, end: dayBh.close });
    }

    return filterNormalServiceSlots(generateScheduleGridSlots(schedules, slotIntervalMinutes));
  }, [formDate, businessHours, formProfessionalId, formServiceId, professionals, services, slotIntervalMinutes, formIsFitting, fittingTimeMode]);

  // No encaixe em modo grade, o horário sugerido ao abrir o modal é contado desde 00:00 (10:00, 12:00...),
  // mas a lista e a validação usam a grade real do profissional (09:00, 09:40, 10:20... quando o
  // intervalo é 40 min e o expediente começa às 09:00). Sem este ajuste a tela sugeria um horário e
  // depois o recusava com "deve seguir a grade". Leva o horário para o próximo da grade vigente
  // (também vale ao trocar de profissional ou de data), sem tocar no modo personalizado.
  useEffect(() => {
    if (!isOpen || !formIsFitting || fittingTimeMode !== 'grid') return;
    if (modalAvailableTimeSlots.length === 0 || modalAvailableTimeSlots.includes(formTime)) return;
    setFormTime(
      modalAvailableTimeSlots.find((slot) => slot >= formTime) ??
        modalAvailableTimeSlots[modalAvailableTimeSlots.length - 1]
    );
  }, [isOpen, formIsFitting, fittingTimeMode, modalAvailableTimeSlots, formTime]);

  const currentService = useMemo(
    () => services.find((s) => s.id === formServiceId),
    [services, formServiceId]
  );

  // Profissionais disponíveis no horário selecionado (não estão em intervalo nem de folga considerando duração)
  // Em modo de Encaixe (formIsFitting), há flexibilidade total para alocar qualquer profissional ativo
  const availableProfessionalsForFormTime = useMemo(() => {
    return professionals.filter((p) => {
      if (!p.is_active) return false;
      if (formIsFitting) return true;
      const serviceDuration = currentService
        ? getEffectiveServiceDuration(
            currentService.duration_minutes,
            currentService.id,
            p.professional_services
          )
        : slotIntervalMinutes;
      return isProfessionalWorkingAt(p, formDate, formTime, serviceDuration, businessHours);
    });
  }, [professionals, formIsFitting, formDate, formTime, currentService, slotIntervalMinutes, businessHours]);

  const isPastFormTime = useMemo(() => {
    const nowInstant = new Date();
    const currentLocalDate = dateInZone(nowInstant, timezone);
    const currentLocalTime = formatTimeInZone(nowInstant.toISOString(), timezone);
    return (
      formDate < currentLocalDate ||
      (formDate === currentLocalDate && formTime < currentLocalTime)
    );
  }, [formDate, formTime, timezone]);

  // Sincronizar barbeiro selecionado caso o atual não esteja disponível no horário
  useEffect(() => {
    if (!isOpen) return;
    if (availableProfessionalsForFormTime.length > 0) {
      if (
        formProfessionalId !== ANY_PROFESSIONAL &&
        !availableProfessionalsForFormTime.some((p) => p.id === formProfessionalId)
      ) {
        setFormProfessionalId(availableProfessionalsForFormTime[0].id);
      }
    } else if (formProfessionalId !== ANY_PROFESSIONAL) {
      setFormProfessionalId('');
    }
  }, [isOpen, availableProfessionalsForFormTime, formProfessionalId]);

  // Forçar encaixe de balcão para horários decorridos
  useEffect(() => {
    if (isOpen && isPastFormTime) {
      setFormIsFitting(true);
    }
  }, [isOpen, isPastFormTime]);

  const handleSaveAppointment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formProfessionalId && formProfessionalId !== ANY_PROFESSIONAL) {
      addToast('Selecione um profissional.', 'warning');
      return;
    }
    if (!formServiceId) {
      addToast('Selecione um serviço.', 'warning');
      return;
    }

    const selectedService = services.find((s) => s.id === formServiceId);
    if (!selectedService || !tenantId) {
      addToast('Serviço inválido.', 'error');
      return;
    }

    setSaving(true);

    try {
      let cliente: ClienteDoAgendamento;
      if (customerMode === 'new') {
        cliente = { tipo: 'novo', nome: newCustomerName, telefone: newCustomerPhone };
      } else if (customerMode === 'none') {
        cliente = { tipo: 'nenhum' };
      } else {
        if (!selectedCustomerId) {
          addToast('Selecione ou cadastre um cliente.', 'warning');
          setSaving(false);
          return;
        }
        cliente = { tipo: 'existente', id: selectedCustomerId };
      }

      // Expediente, escala, intervalo, conflito, Bloqueio de Horário, horário passado, "Tanto faz" e
      // Cliente novo são decididos no banco (AgendaRepository.criarAgendamento). Ficam aqui só as
      // regras de grade do encaixe, que dependem de como a tela monta o horário.
      const selectedProfessionalId = formProfessionalId === ANY_PROFESSIONAL ? null : formProfessionalId;
      const referenceProfessional = professionals.find(
        (p) => p.id === (selectedProfessionalId ?? availableProfessionalsForFormTime[0]?.id)
      );
      const effectiveServiceDuration = getEffectiveServiceDuration(
        selectedService.duration_minutes,
        selectedService.id,
        referenceProfessional?.professional_services
      );

      if (formIsFitting && !isValidFittingStartTime(
        formTime,
        fittingTimeMode,
        slotIntervalMinutes,
        fittingTimeMode === 'grid' ? modalAvailableTimeSlots : undefined
      )) {
        addToast(
          fittingTimeMode === 'grid'
            ? `Horário de encaixe deve seguir a grade de ${slotIntervalMinutes} minutos.`
            : 'Informe um horário de início válido.',
          'warning'
        );
        setSaving(false);
        return;
      }

      // Feedback antecipado do limite de 1 encaixe por horário/profissional. A regra é do banco
      // (uq_appointments_one_fitting_per_slot): vale com "Tanto faz" e contra outra recepção, que
      // esta checagem, feita só sobre os agendamentos carregados, não enxerga.
      if (formIsFitting) {
        const existingFittings = appointments.filter((a) => {
          return (
            a.professional_id === formProfessionalId &&
            a.is_fitting &&
            ['pending', 'confirmed', 'in_progress'].includes(a.status) &&
            formatTimeInZone(a.start_time, timezone) === formTime
          );
        });

        if (existingFittings.length >= 1) {
          addToast('Limite atingido: já existe 1 encaixe agendado para este profissional neste horário.', 'warning');
          setSaving(false);
          return;
        }
      }

      // Início em ISO: o encaixe usa o seam compartilhado da grade; o fim é calculado no banco.
      let startIso: string;
      if (formIsFitting) {
        try {
          startIso = buildFittingAppointmentInterval({
            date: formDate,
            time: formTime,
            timeZone: timezone,
            durationMinutes: effectiveServiceDuration,
            mode: fittingTimeMode,
            slotIntervalMinutes,
            gridSlots: fittingTimeMode === 'grid' ? modalAvailableTimeSlots : undefined,
          }).startIso;
        } catch (error) {
          const errorCode = error instanceof Error ? error.message : '';
          addToast(
            errorCode === 'FITTING_TIME_NOT_ALIGNED'
              ? `Horário de encaixe deve seguir a grade de ${slotIntervalMinutes} minutos.`
              : 'Informe uma data e horário válidos para o encaixe.',
            'warning'
          );
          setSaving(false);
          return;
        }
      } else {
        startIso = localDateTimeToIso(formDate, formTime, timezone);
      }

      const created = await agendaRepo.criarAgendamento(tenantId, {
        serviceId: formServiceId,
        startTimeIso: startIso,
        professionalId: selectedProfessionalId,
        cliente,
        isFitting: formIsFitting,
        notes: formNotes.trim() || null,
        waitingListId: pendingWaitingEntryId,
      });

      const newCustomer =
        cliente.tipo === 'novo' && created.customer_id
          ? { id: created.customer_id, name: newCustomerName.trim(), phone: newCustomerPhone.trim() }
          : undefined;
      setPendingWaitingEntryId(null);

      // A Comanda e o item do serviço nascem no banco, pelo gatilho de inserção do agendamento.

      addToast(
        formIsFitting ? 'Encaixe agendado com sucesso!' : 'Agendamento criado com sucesso!',
        'success'
      );
      onClose();
      onSaved({ newCustomer });
    } catch (err: unknown) {
      console.error('Erro ao salvar agendamento:', err);
      const message = err instanceof Error ? err.message : 'Erro ao agendar horário.';
      addToast(
        message,
        err instanceof AgendaValidationError || (err instanceof AgendaOperationError && err.kind === 'regra')
          ? 'warning'
          : 'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={formIsFitting ? 'Novo encaixe rápido' : 'Novo agendamento'}
    >
      <form onSubmit={handleSaveAppointment} className="flex flex-col gap-4 w-full max-w-full min-w-0">
        {/* Seletor de Modo do Cliente */}
        <div className="flex bg-black/5 p-1 rounded-md gap-1">
          <button
            type="button"
            className={`flex-1 border-none py-2 px-[0.6rem] text-xs font-bold rounded-sm bg-none text-text-primary shadow-none cursor-pointer transition-all duration-150 flex items-center justify-center text-center min-h-10 ${customerMode === 'existing' ? 'bg-bg-secondary shadow-[0_0_0_1px_#000000,0_1px_2px_rgba(45,35,30,0.06)]' : ''}`}
            onClick={() => setCustomerMode('existing')}
          >
            Cliente cadastrado
          </button>
          <button
            type="button"
            className={`flex-1 border-none py-2 px-[0.6rem] text-xs font-bold rounded-sm bg-none text-text-primary shadow-none cursor-pointer transition-all duration-150 flex items-center justify-center text-center min-h-10 ${customerMode === 'new' ? 'bg-bg-secondary shadow-[0_0_0_1px_#000000,0_1px_2px_rgba(45,35,30,0.06)]' : ''}`}
            onClick={() => setCustomerMode('new')}
          >
            Novo cadastro
          </button>
          <button
            type="button"
            className={`flex-1 border-none py-2 px-[0.6rem] text-xs font-bold rounded-sm bg-none text-text-primary shadow-none cursor-pointer transition-all duration-150 flex items-center justify-center text-center min-h-10 ${customerMode === 'none' ? 'bg-bg-secondary shadow-[0_0_0_1px_#000000,0_1px_2px_rgba(45,35,30,0.06)]' : ''}`}
            onClick={() => setCustomerMode('none')}
          >
            Sem cadastro (Balcão)
          </button>
        </div>

        {customerMode === 'existing' ? (
          <div className="flex flex-col gap-[0.35rem] min-w-0">
            <Select
              label="Cliente"
              id="select-customer"
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              required
            >
              <option value="">Selecione um cliente...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            {selectedCustomer?.phone && (
              <div className="inline-flex items-center gap-[0.4rem] mt-1 text-xs text-text-primary [&_span]:text-text-primary [&_strong]:text-text-primary [&_strong]:font-bold">
                <span>WhatsApp: <strong>{selectedCustomer.phone}</strong></span>
              </div>
            )}
          </div>
        ) : customerMode === 'new' ? (
          <div className="grid grid-cols-2 gap-3 w-full min-w-0 max-[480px]:grid-cols-1">
            <div className="flex flex-col gap-[0.35rem] min-w-0 [&_label]:text-xs [&_label]:font-bold [&_label]:text-text-primary [&_label]:uppercase [&_label]:tracking-[0.04em]">
              <label htmlFor="new-customer-name">Nome do cliente</label>
              <input
                id="new-customer-name"
                type="text"
                placeholder="Ex: João da Silva"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                className="w-full min-w-0 max-w-full py-[0.65rem] px-[0.85rem] border-0 shadow-[0_0_0_0.8px_var(--color-text-primary)] rounded-md bg-bg-secondary text-text-primary text-sm font-[inherit] box-border transition-shadow duration-150 focus:outline-none focus:shadow-[0_0_0_1.5px_var(--color-brand-primary)]"
                required
              />
            </div>
            <div className="flex flex-col gap-[0.35rem] min-w-0 [&_label]:text-xs [&_label]:font-bold [&_label]:text-text-primary [&_label]:uppercase [&_label]:tracking-[0.04em]">
              <label htmlFor="new-customer-phone">WhatsApp ou celular</label>
              <input
                id="new-customer-phone"
                type="tel"
                placeholder="(11) 99999-9999"
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                className="w-full min-w-0 max-w-full py-[0.65rem] px-[0.85rem] border-0 shadow-[0_0_0_0.8px_var(--color-text-primary)] rounded-md bg-bg-secondary text-text-primary text-sm font-[inherit] box-border transition-shadow duration-150 focus:outline-none focus:shadow-[0_0_0_1.5px_var(--color-brand-primary)]"
                required
              />
            </div>
          </div>
        ) : (
          <div className="py-3 px-[0.85rem] bg-black/[0.02] border-none rounded-md text-[0.82rem] leading-relaxed text-text-primary mb-2 [&_span]:text-text-primary">
            <span>ℹ️ Atendimento avulso de balcão sem identificação de cliente. A comanda será aberta normalmente sem criar clientes fictícios no banco.</span>
          </div>
        )}

        {/* Seleção de Profissional e Serviço */}
        <div className="grid grid-cols-2 gap-3 w-full min-w-0 max-[480px]:grid-cols-1">
          <div className="flex flex-col gap-[0.35rem] min-w-0">
            <Select
              label="Profissional"
              id="select-professional"
              value={formProfessionalId}
              onChange={(e) => setFormProfessionalId(e.target.value)}
              required
            >
              {availableProfessionalsForFormTime.length > 0 ? (
                <>
                  {!lockedProfessionalId && <option value={ANY_PROFESSIONAL}>Tanto faz</option>}
                  {availableProfessionalsForFormTime.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </>
              ) : (
                <option value="" disabled>
                  Nenhum barbeiro disponível (intervalo/folga)
                </option>
              )}
            </Select>
            {availableProfessionalsForFormTime.length === 0 && (
              <span className="text-xs mt-1 block">
                Nenhum barbeiro disponível às {formTime} (intervalo ou folga).
              </span>
            )}
          </div>

          <div className="flex flex-col gap-[0.35rem] min-w-0">
            <Select
              label="Serviço"
              id="select-service"
              value={formServiceId}
              onChange={(e) => setFormServiceId(e.target.value)}
              required
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            {currentService && (
              <div className="inline-flex items-center gap-[0.4rem] mt-1 text-xs text-text-primary [&_span]:text-text-primary [&_strong]:text-text-primary [&_strong]:font-bold">
                <span>Duração: <strong>{currentService.duration_minutes} min</strong></span>
                <span>•</span>
                <span>Valor: <strong>R$ {Number(currentService.price).toFixed(2)}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Data e Horário */}
        <div className="grid grid-cols-2 gap-3 w-full min-w-0 max-[480px]:grid-cols-1">
          <div className="flex flex-col gap-[0.35rem] min-w-0 [&_label]:text-xs [&_label]:font-bold [&_label]:text-text-primary [&_label]:uppercase [&_label]:tracking-[0.04em]">
            <label htmlFor="form-date">Data do atendimento</label>
            <input
              id="form-date"
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="w-full min-w-0 max-w-full py-[0.65rem] px-[0.85rem] border-0 shadow-[0_0_0_0.8px_var(--color-text-primary)] rounded-md bg-bg-secondary text-text-primary text-sm font-[inherit] box-border transition-shadow duration-150 focus:outline-none focus:shadow-[0_0_0_1.5px_var(--color-brand-primary)]"
              required
            />
          </div>

          <div className="flex flex-col gap-[0.35rem] min-w-0 [&_label]:text-xs [&_label]:font-bold [&_label]:text-text-primary [&_label]:uppercase [&_label]:tracking-[0.04em]">
            <label htmlFor="form-time">Horário de início</label>
            {formIsFitting && fittingTimeMode === 'custom' ? (
              <input
                id="form-time"
                type="time"
                step="60"
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
                className="w-full min-w-0 max-w-full py-[0.65rem] px-[0.85rem] border-0 shadow-[0_0_0_0.8px_var(--color-text-primary)] rounded-md bg-bg-secondary text-text-primary text-sm font-[inherit] box-border transition-shadow duration-150 focus:outline-none focus:shadow-[0_0_0_1.5px_var(--color-brand-primary)]"
                required
              />
            ) : modalAvailableTimeSlots.length > 0 ? (
              <Select
                id="form-time"
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
                required
              >
                {formIsFitting && !modalAvailableTimeSlots.includes(formTime) && (
                  <option value={formTime}>{formTime} (fora da grade)</option>
                )}
                {modalAvailableTimeSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </Select>
            ) : (
              <input
                id="form-time"
                type="time"
                step="60"
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
                className="w-full min-w-0 max-w-full py-[0.65rem] px-[0.85rem] border-0 shadow-[0_0_0_0.8px_var(--color-text-primary)] rounded-md bg-bg-secondary text-text-primary text-sm font-[inherit] box-border transition-shadow duration-150 focus:outline-none focus:shadow-[0_0_0_1.5px_var(--color-brand-primary)]"
                required
              />
            )}
          </div>
        </div>

        {/* Card de Encaixe de Balcão */}
        <div className="p-3 px-[0.9rem] rounded-md bg-bg-primary border-0 shadow-[0_0_0_0.8px_var(--color-text-primary)] grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 min-w-0 box-border transition-all duration-200 max-[480px]:grid-cols-[minmax(0,1fr)]">
          <div className="flex flex-col gap-[0.15rem] min-w-0">
            <div className="flex items-center gap-[0.4rem] flex-wrap">
              {isPastFormTime && (
                <span className="text-[0.62rem] font-bold py-[0.1rem] px-[0.35rem] rounded-sm uppercase bg-bg-secondary text-text-secondary">
                  Obrigatório (passado)
                </span>
              )}
            </div>
            <span className="text-[0.72rem] text-text-primary">
              {formIsFitting && fittingTimeMode === 'custom'
                ? 'Horário personalizado: permite registrar uma exceção fora da grade e do expediente configurado.'
                : isPastFormTime
                ? 'Horário já decorrido: o registro neste horário é restrito a Encaixe de balcão.'
                : 'Permite atender dois clientes no mesmo horário dividindo a coluna da grade.'}
            </span>
          </div>
          {formIsFitting && (
            <div
              className="flex items-center justify-end gap-[0.45rem] min-w-0 max-[480px]:justify-start max-[480px]:w-full"
              role="group"
              aria-label="Modalidade do horário do encaixe"
            >
              <span className="text-[0.68rem] font-bold text-text-primary transition-colors duration-200">
                Grade
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={fittingTimeMode === 'custom'}
                aria-label="Alternar entre horário da grade e personalizado"
                className={`relative w-[2.55rem] h-[1.35rem] p-[0.15rem] border-0 rounded-full cursor-pointer transition-[background-color,box-shadow] duration-200 box-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-2 ${fittingTimeMode === 'custom' ? 'bg-brand-primary shadow-[0_0_0_0.8px_var(--color-brand-primary)]' : 'bg-[#D1D5DB] shadow-[0_0_0_0.8px_var(--color-text-primary)]'}`}
                onClick={() => setFittingTimeMode((current) => current === 'grid' ? 'custom' : 'grid')}
              >
                <span className={`block w-[0.95rem] h-[0.95rem] rounded-full bg-bg-secondary shadow-sm transition-transform duration-200 ${fittingTimeMode === 'custom' ? 'translate-x-[1.05rem]' : 'translate-x-0'}`} />
              </button>
              <button
                type="button"
                className="border-0 p-0 bg-transparent font-[inherit] cursor-pointer text-[0.68rem] font-bold text-text-primary transition-colors duration-200"
                aria-label="Horário personalizado"
                onClick={() => setFittingTimeMode('custom')}
              >
                Personalizado
              </button>
            </div>
          )}
          <label className={`flex items-center gap-2 text-sm m-0 whitespace-nowrap ${isPastFormTime ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              aria-label="Marcar como Encaixe de Balcão"
              checked={formIsFitting}
              disabled={isPastFormTime}
              onChange={(e) => {
                setFormIsFitting(e.target.checked);
                if (!e.target.checked) setFittingTimeMode('grid');
              }}
            />
            <span className="text-xs font-bold text-text-primary">Encaixe</span>
          </label>
        </div>

        {/* Observações */}
        <div className="flex flex-col gap-[0.35rem] min-w-0 [&_label]:text-xs [&_label]:font-bold [&_label]:text-text-primary [&_label]:uppercase [&_label]:tracking-[0.04em]">
          <label htmlFor="form-notes">Observações do atendimento (opcional)</label>
          <textarea
            id="form-notes"
            rows={2}
            placeholder="Ex: Cliente prefere tesoura no topo, café sem açúcar..."
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
            className="w-full min-w-0 max-w-full py-[0.65rem] px-[0.85rem] border-0 shadow-[0_0_0_0.8px_var(--color-text-primary)] rounded-md bg-bg-secondary text-text-primary text-sm font-[inherit] box-border transition-shadow duration-150 focus:outline-none focus:shadow-[0_0_0_1.5px_var(--color-brand-primary)] resize-y min-h-[60px] max-h-40 leading-[1.4]"
          />
        </div>

        <div className="flex justify-end items-center gap-3 mt-2 flex-wrap max-[480px]:flex-col-reverse max-[480px]:flex-nowrap max-[480px]:w-full [&>button]:max-[480px]:w-full">
          <button
            type="button"
            className="bg-bg-secondary border-0 shadow-[0_0_0_0.8px_var(--color-text-primary)] py-[0.6rem] px-5 rounded-md text-sm font-bold text-text-primary cursor-pointer min-h-11 box-border transition-colors duration-150 hover:bg-black/[0.04]"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button type="submit" className="bg-brand-primary text-bg-secondary border-none py-[0.6rem] px-6 rounded-md text-sm font-bold cursor-pointer min-h-11 box-border transition-colors duration-150 hover:bg-brand-hover" disabled={saving}>
            {saving ? (
              <span>Salvando...</span>
            ) : formIsFitting ? (
              <span>Confirmar encaixe na agenda</span>
            ) : (
              <span>Salvar agendamento</span>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
