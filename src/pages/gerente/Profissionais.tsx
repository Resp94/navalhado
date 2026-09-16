import React, { useEffect, useState, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import type { TenantContextType } from '../../components/GerenteLayout';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { SupabaseProfessionalServicesAdapter } from '../../modules/profissionais/servicesAdapter';
import type { ProfessionalServiceItem } from '../../modules/profissionais/types';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Cancel01Icon,
  ScissorIcon as HugeScissorIcon,
  UserGroupIcon,
  CheckmarkCircle02Icon,
  AlertCircleIcon,
  Clock01Icon,
  Delete02Icon,
  PlusSignIcon,
  PlusSignCircleIcon,
  Edit01Icon,
} from '@hugeicons/core-free-icons';
import {
  Button,
  IconButton,
  Avatar,
  Badge,
  EmptyState,
  Skeleton,
} from '../../components/ui';
import { ConfirmSoftDeleteModal } from '../../components/cadastros/ConfirmSoftDeleteModal';
import {
  clampProfessionalScheduleToBusinessHours,
  clampTimeToRange,
  getBusinessHoursForDayKey,
  generateProfessionalTimeOptions,
  timeToMinutes,
} from '../../lib/schedule';

interface ProfessionalScheduleDay {
  start: string;
  end: string;
  break_start?: string;
  break_end?: string;
}

interface Professional {
  id: string;
  name: string;
  phone: string;
  commission_percentage: number;
  weekly_schedule: Record<string, ProfessionalScheduleDay | null> | null;
  is_active: boolean;
  user_id: string | null;
}

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Segunda-feira' },
  { key: 'tuesday', label: 'Terça-feira' },
  { key: 'wednesday', label: 'Quarta-feira' },
  { key: 'thursday', label: 'Quinta-feira' },
  { key: 'friday', label: 'Sexta-feira' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

type ScheduleFormDay = ProfessionalScheduleDay & { active: boolean };
type ScheduleForm = Record<string, ScheduleFormDay>;

const createTenantScheduleDefaults = (
  businessHours?: TenantContextType['businessHours']
): ScheduleForm => Object.fromEntries(
  DAYS_OF_WEEK.map((day) => {
    const dayHours = getBusinessHoursForDayKey(day.key, businessHours);
    return [day.key, {
      active: dayHours.active,
      start: dayHours.open,
      end: dayHours.close,
    }];
  })
);

const CloseIcon = () => <HugeiconsIcon icon={Cancel01Icon} size={20} />;
const ScissorIcon = () => <HugeiconsIcon icon={HugeScissorIcon} size={15} />;
const CheckIcon = () => <HugeiconsIcon icon={CheckmarkCircle02Icon} size={13} />;
const AlertIcon = () => <HugeiconsIcon icon={AlertCircleIcon} size={13} />;
const ClockIcon = () => <HugeiconsIcon icon={Clock01Icon} size={13} />;

// Classes Tailwind reutilizadas entre o skeleton e o card real do profissional
// (mantidas como constantes para não duplicar strings longas entre os dois usos).
const PROF_CARD_CLASSES =
  'bg-bg-secondary shadow-[0_0_0_0.5px_var(--color-text-primary)] rounded-md p-5 flex flex-col gap-[0.85rem] transition-[box-shadow,transform] duration-[250ms] ease hover:shadow-[0_0_0_0.5px_var(--color-text-primary),var(--shadow-md)] hover:-translate-y-px max-sm:p-4 max-sm:gap-3';
const PROF_CARD_HEADER_CLASSES = 'flex justify-between items-start gap-3 flex-wrap';
const PROF_CARD_TITLE_GROUP_CLASSES = 'flex items-center gap-3 min-w-0 flex-[1_1_180px]';
const PROF_CARD_SCHEDULE_CLASSES = 'flex flex-col gap-[0.4rem] w-full';
const SCHEDULE_BADGES_CLASSES = 'grid grid-cols-7 gap-[0.35rem] w-full box-border max-sm:gap-1';
const PROF_CARD_ACTIONS_CLASSES =
  'flex justify-between items-center border-t border-border pt-3 flex-wrap gap-[0.65rem] max-sm:flex-col max-sm:items-stretch';
const ACTION_BUTTONS_CLASSES =
  'flex items-center gap-2 flex-wrap max-sm:grid max-sm:grid-cols-2 max-sm:gap-2 max-sm:w-full max-[380px]:grid-cols-1';
const ACTION_BUTTON_MOBILE_CLASSES = 'max-sm:min-h-[44px] max-sm:text-xs max-sm:py-2 max-sm:px-[0.4rem] max-sm:w-full';
const LOGIN_STATUS_CLASSES = 'max-sm:flex max-sm:w-full';
const STATUS_BADGE_MOBILE_CLASSES = 'max-sm:w-full max-sm:justify-center max-sm:min-h-[28px]';

const ProfessionalCardSkeleton: React.FC = () => (
  <div className={PROF_CARD_CLASSES} aria-hidden="true">
    <div className={PROF_CARD_HEADER_CLASSES}>
      <div className={PROF_CARD_TITLE_GROUP_CLASSES}>
        <Skeleton shape="circle" width={40} height={40} />
        <div className="flex flex-col gap-[0.45rem] min-w-0">
          <Skeleton shape="text" width={140} height={18} />
          <Skeleton shape="text" width={100} height={14} />
        </div>
      </div>
      <Skeleton shape="rect" width={96} height={26} style={{ borderRadius: 'var(--radius-full)' }} />
    </div>
    <div className={PROF_CARD_SCHEDULE_CLASSES}>
      <Skeleton shape="text" width={120} height={14} style={{ marginBottom: '0.5rem' }} />
      <div className={SCHEDULE_BADGES_CLASSES}>
        {[...Array(7)].map((_, i) => (
          <Skeleton
            key={i}
            shape="rect"
            height={52}
            style={{ borderRadius: 'var(--radius-sm)', width: '100%' }}
          />
        ))}
      </div>
    </div>
    <div className={PROF_CARD_ACTIONS_CLASSES}>
      <div className={LOGIN_STATUS_CLASSES}>
        <Skeleton shape="rect" width={100} height={24} style={{ borderRadius: 'var(--radius-sm)' }} />
      </div>
      <div className={ACTION_BUTTONS_CLASSES}>
        <Skeleton shape="rect" width={140} height={36} style={{ borderRadius: 'var(--radius-md)' }} />
        <Skeleton shape="rect" width={130} height={36} style={{ borderRadius: 'var(--radius-md)' }} />
        <Skeleton shape="rect" width={75} height={36} style={{ borderRadius: 'var(--radius-md)' }} />
      </div>
    </div>
  </div>
);

export const Profissionais: React.FC = () => {
  const tenant = useOutletContext<TenantContextType>();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const servicesAdapter = useMemo(
    () => new SupabaseProfessionalServicesAdapter(supabase),
    []
  );

  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profToDelete, setProfToDelete] = useState<Professional | null>(null);

  // Estados do Formulário de Profissional
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [commission, setCommission] = useState('40');
  const [isActive, setIsActive] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Estados do Modal de Associação de Serviços (N:N)
  const [isServicesModalOpen, setIsServicesModalOpen] = useState(false);
  const [selectedProfForServices, setSelectedProfForServices] = useState<Professional | null>(null);
  const [profServicesList, setProfServicesList] = useState<ProfessionalServiceItem[]>([]);
  const [loadingProfServices, setLoadingProfServices] = useState(false);
  const [savingProfServices, setSavingProfServices] = useState(false);

  // Escala de horários semanal padrão
  const [schedule, setSchedule] = useState<ScheduleForm>(() =>
    createTenantScheduleDefaults(tenant.businessHours)
  );

  const fetchProfessionals = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('professionals')
        .select('*')
        .eq('tenant_id', tenant.tenantId)
        .is('deleted_at', null)
        .order('name', { ascending: true });

      if (error) throw error;
      setProfessionals(data || []);
    } catch (error: any) {
      addToast('Não foi possível carregar a equipe de profissionais.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateDrawer = () => {
    resetForm();
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    resetForm();
  };

  const handleDeleteProf = async () => {
    if (!profToDelete) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from('professionals')
        .update({
          deleted_at: new Date().toISOString(),
          is_active: false,
        })
        .eq('id', profToDelete.id)
        .eq('tenant_id', tenant.tenantId);

      if (error) throw error;
      addToast(`Profissional "${profToDelete.name}" excluído com sucesso. Histórico preservado.`, 'success');
      if (editingId === profToDelete.id) {
        handleCloseDrawer();
      }
      setProfToDelete(null);
      fetchProfessionals();
    } catch (err: any) {
      addToast(err?.message || 'Erro ao excluir profissional.', 'error');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchProfessionals();
  }, [tenant.tenantId]);

  // Listener para fechar modais e drawer com tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isServicesModalOpen) setIsServicesModalOpen(false);
        if (isDrawerOpen) handleCloseDrawer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isServicesModalOpen, isDrawerOpen]);

  // Animação GSAP com respeito a prefers-reduced-motion e compatibilidade de testes
  useGSAP(() => {
    if (!loading && professionals.length > 0) {
      const prefersReduced =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReduced) {
        gsap.set('.prof-card', { opacity: 1, y: 0 });
      } else {
        gsap.fromTo(
          '.prof-card',
          { opacity: 0, y: 15 },
          { opacity: 1, y: 0, duration: 0.4, stagger: 0.06, ease: 'power2.out' }
        );
      }
    }
  }, [loading, professionals]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setPhone('');
    setCommission('40');
    setIsActive(true);
    setSelectedUserId(null);
    setSchedule(createTenantScheduleDefaults(tenant.businessHours));
  };

  const handleEdit = (prof: Professional) => {
    setEditingId(prof.id);
    setName(prof.name);
    setPhone(prof.phone);
    setCommission(prof.commission_percentage.toString());
    setIsActive(prof.is_active);
    setSelectedUserId(prof.user_id);

    const newSchedule = createTenantScheduleDefaults(tenant.businessHours);
    DAYS_OF_WEEK.forEach((day) => {
      newSchedule[day.key].active = false;
    });

    if (prof.weekly_schedule) {
      Object.keys(prof.weekly_schedule).forEach((day) => {
        const dayData = prof.weekly_schedule?.[day];
        if (dayData) {
          const dayKey = day as keyof typeof newSchedule;
          const effectiveSchedule = clampProfessionalScheduleToBusinessHours(
            dayData,
            getBusinessHoursForDayKey(day, tenant.businessHours)
          );
          newSchedule[dayKey] = {
            ...newSchedule[dayKey],
            ...effectiveSchedule,
            active: getBusinessHoursForDayKey(day, tenant.businessHours).active
              ? effectiveSchedule?.active !== false
              : false,
          };
        }
      });
    }

    setSchedule(newSchedule);
    setIsDrawerOpen(true);
  };

  const handleScheduleDayToggle = (day: string) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        active: !prev[day].active,
      },
    }));
  };

  const handleScheduleTimeChange = (
    day: string,
    type: 'start' | 'end' | 'break_start' | 'break_end',
    value: string
  ) => {
    setSchedule((prev) => {
      const currentDay = prev[day];
      let boundedValue: string | undefined = value || undefined;

      if (tenant.businessHours) {
        const dayBusinessHours = getBusinessHoursForDayKey(day, tenant.businessHours);
        if (type === 'start' || type === 'end') {
          boundedValue = clampTimeToRange(value, dayBusinessHours.open, dayBusinessHours.close);
        } else if (boundedValue) {
          boundedValue = clampTimeToRange(
            value,
            currentDay.start,
            currentDay.end
          );
        }
      }

      const nextDay = {
        ...currentDay,
        [type]: boundedValue,
      };

      if (type === 'start' || type === 'end') {
        const nextStart = nextDay.start;
        const nextEnd = nextDay.end;
        const breakStart = nextDay.break_start;
        const breakEnd = nextDay.break_end;
        if (
          breakStart &&
          breakEnd &&
          (timeToMinutes(breakStart) < timeToMinutes(nextStart) ||
            timeToMinutes(breakEnd) > timeToMinutes(nextEnd) ||
            timeToMinutes(breakStart) >= timeToMinutes(breakEnd))
        ) {
          nextDay.break_start = undefined;
          nextDay.break_end = undefined;
        }
      }

      return {
        ...prev,
        [day]: nextDay,
      };
    });
  };

  const validateScheduleAgainstTenantHours = () => {
    // O contexto pode estar sem o expediente durante fixtures legados ou antes
    // do carregamento completo. Nesse caso, a validação definitiva permanece
    // protegida pelo trigger do banco.
    if (!tenant.businessHours) return null;

    for (const day of DAYS_OF_WEEK) {
      const daySchedule = schedule[day.key];
      if (!daySchedule?.active) continue;

      const businessHours = getBusinessHoursForDayKey(day.key, tenant.businessHours);
      if (!businessHours.active) {
        return `${day.label}: a barbearia está fechada neste dia.`;
      }

      const start = timeToMinutes(daySchedule.start);
      const end = timeToMinutes(daySchedule.end);
      const opening = timeToMinutes(businessHours.open);
      const closing = timeToMinutes(businessHours.close);

      if (start >= end) {
        return `${day.label}: o horário de entrada deve ser anterior ao horário de saída.`;
      }
      if (start < opening || end > closing) {
        return `${day.label}: a escala deve ficar entre ${businessHours.open} e ${businessHours.close}.`;
      }

      const breakStart = daySchedule.break_start ? timeToMinutes(daySchedule.break_start) : null;
      const breakEnd = daySchedule.break_end ? timeToMinutes(daySchedule.break_end) : null;
      if (
        (breakStart !== null && breakEnd === null) ||
        (breakStart === null && breakEnd !== null) ||
        (breakStart !== null && breakEnd !== null &&
          (breakStart < start || breakEnd > end || breakStart >= breakEnd))
      ) {
        return `${day.label}: o intervalo deve ficar dentro do expediente e ter início anterior ao fim.`;
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast('O nome do profissional é obrigatório.', 'warning');
      return;
    }
    if (!phone.trim()) {
      addToast('O telefone do profissional é obrigatório.', 'warning');
      return;
    }
    if (!commission || parseFloat(commission) < 0 || parseFloat(commission) > 100) {
      addToast('Informe uma comissão válida de 0% a 100%.', 'warning');
      return;
    }

    const scheduleError = validateScheduleAgainstTenantHours();
    if (scheduleError) {
      addToast(scheduleError, 'warning');
      return;
    }

    try {
      setSaving(true);

      const weeklyScheduleJSON: Record<string, { start: string; end: string; break_start?: string; break_end?: string }> = {};
      Object.keys(schedule).forEach((day) => {
        if (schedule[day].active) {
          weeklyScheduleJSON[day] = {
            start: schedule[day].start,
            end: schedule[day].end,
            ...(schedule[day].break_start && schedule[day].break_end
              ? {
                  break_start: schedule[day].break_start,
                  break_end: schedule[day].break_end,
                }
              : {}),
          };
        }
      });

      const profData = {
        tenant_id: tenant.tenantId,
        name: name.trim(),
        phone: phone.trim(),
        commission_percentage: parseFloat(commission),
        weekly_schedule: weeklyScheduleJSON,
        is_active: isActive,
        user_id: selectedUserId,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase
          .from('professionals')
          .update(profData)
          .eq('id', editingId)
          .eq('tenant_id', tenant.tenantId);

        if (error) throw error;
        addToast('Profissional atualizado com sucesso!', 'success');
      } else {
        const { data: newProf, error } = await supabase
          .from('professionals')
          .insert([profData])
          .select()
          .single();

        if (error) throw error;

        // Auto-habilita todos os serviços ativos da barbearia com 40 min padrão para o novo barbeiro
        if (newProf?.id) {
          try {
            await servicesAdapter.enableAllServicesDefault(tenant.tenantId, newProf.id, 40);
          } catch (autoErr) {
            console.error('Erro ao auto-vincular serviços ao profissional:', autoErr);
          }
        }

        addToast('Profissional cadastrado com sucesso!', 'success');
      }

      handleCloseDrawer();
      fetchProfessionals();
    } catch (error: any) {
      console.error('Error saving professional:', error);
      addToast('Erro ao salvar dados do profissional.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Funções do Modal de Associação de Serviços
  const handleOpenServicesModal = async (prof: Professional) => {
    setSelectedProfForServices(prof);
    setIsServicesModalOpen(true);
    try {
      setLoadingProfServices(true);
      const list = await servicesAdapter.getProfessionalServices(tenant.tenantId, prof.id);
      setProfServicesList(list);
    } catch (error: any) {
      console.error('Erro ao carregar serviços do profissional:', error);
      addToast('Não foi possível carregar a lista de serviços.', 'error');
    } finally {
      setLoadingProfServices(false);
    }
  };

  const handleToggleService = (serviceId: string) => {
    setProfServicesList((prev) =>
      prev.map((s) => (s.service_id === serviceId ? { ...s, is_enabled: !s.is_enabled } : s))
    );
  };

  const handleDurationChange = (serviceId: string, duration: number) => {
    setProfServicesList((prev) =>
      prev.map((s) => (s.service_id === serviceId ? { ...s, custom_duration_minutes: duration } : s))
    );
  };

  const handleCommissionChange = (serviceId: string, customComm: number | null) => {
    setProfServicesList((prev) =>
      prev.map((s) =>
        s.service_id === serviceId ? { ...s, custom_commission_percentage: customComm } : s
      )
    );
  };

  const handleEnableAllServices = () => {
    setProfServicesList((prev) =>
      prev.map((s) => ({
        ...s,
        is_enabled: true,
        custom_duration_minutes: s.custom_duration_minutes || s.base_duration_minutes || 40,
      }))
    );
    addToast('Todos os serviços foram habilitados com 40 min padrão.', 'info');
  };

  const handleDisableAllServices = () => {
    setProfServicesList((prev) => prev.map((s) => ({ ...s, is_enabled: false })));
  };

  const handleSaveServices = async () => {
    if (!selectedProfForServices) return;
    try {
      setSavingProfServices(true);
      await servicesAdapter.saveProfessionalServices(
        tenant.tenantId,
        selectedProfForServices.id,
        profServicesList.map((s) => ({
          service_id: s.service_id,
          custom_duration_minutes: s.custom_duration_minutes || 40,
          custom_commission_percentage: s.custom_commission_percentage,
          is_enabled: s.is_enabled,
        }))
      );
      addToast('Configurações de serviços salvas com sucesso!', 'success');
      setIsServicesModalOpen(false);
    } catch (error: any) {
      console.error('Erro ao salvar serviços do profissional:', error);
      addToast('Erro ao salvar serviços do profissional.', 'error');
    } finally {
      setSavingProfServices(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2 w-full">
        <div className="flex justify-between items-center gap-6 w-full flex-wrap max-md:flex-col max-md:items-start max-md:gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-text-primary tracking-[-0.025em] m-0 leading-[1.2]">Equipe e escala da barbearia</h2>
            <p className="text-sm text-text-secondary m-0 max-w-[72ch] leading-[1.5]">
              Cadastre seus barbeiros, configure a comissão de cada profissional, personalize o tempo de atendimento por corte e organize os horários de atendimento na semana.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap max-md:w-full">
            <Button
              type="button"
              variant="soft"
              onClick={handleOpenCreateDrawer}
              icon={<HugeiconsIcon icon={PlusSignCircleIcon} size={18} />}
              style={{ boxShadow: '0 0 0 1px var(--color-text-primary)' }}
              aria-label="Novo Barbeiro"
              className="max-md:flex-1"
            >
              Novo Barbeiro
            </Button>
            <Button
              type="button"
              variant="soft"
              onClick={() => navigate('/profissionais/cadastro-acesso')}
              className="max-md:flex-1"
            >
              Criar acesso
            </Button>
          </div>
        </div>
      </header>

      {/* Painel da Listagem */}
      <section
        className="bg-bg-secondary border border-border rounded-lg p-6 shadow-sm max-sm:p-4 max-sm:rounded-md"
        aria-labelledby="prof-list-heading"
      >
        <div className="flex justify-between items-center gap-4 flex-wrap mb-5 max-sm:flex-col max-sm:items-stretch max-sm:gap-3">
          <div className="flex items-center gap-3">
            <h3 id="prof-list-heading" className="text-lg font-extrabold text-text-primary m-0 tracking-[-0.015em]">Membros da equipe</h3>
            {loading ? (
              <Skeleton width={80} height={20} style={{ borderRadius: 'var(--radius-full)' }} />
            ) : (
              <span className="inline-flex items-center py-[2px] px-2 bg-bg-primary text-text-primary text-[11px] font-bold rounded-full border-0 shadow-[0_0_0_0.8px_var(--color-text-primary)]">
                {professionals.length} {professionals.length === 1 ? 'barbeiro' : 'barbeiros'}
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col gap-4" role="status" aria-busy="true">
            <span className="sr-only">Carregando equipe...</span>
            <ProfessionalCardSkeleton />
            <ProfessionalCardSkeleton />
            <ProfessionalCardSkeleton />
          </div>
        ) : professionals.length === 0 ? (
          <EmptyState
            icon={<HugeiconsIcon icon={UserGroupIcon} size={32} />}
            title="Nenhum barbeiro cadastrado na barbearia."
            description="Cadastre o primeiro profissional para liberar a agenda e permitir novos agendamentos."
            action={
              <Button
                type="button"
                variant="primary"
                onClick={handleOpenCreateDrawer}
                icon={<HugeiconsIcon icon={PlusSignIcon} size={16} />}
              >
                Cadastrar Primeiro Barbeiro
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            {professionals.map((prof) => (
              <div
                key={prof.id}
                className={`${PROF_CARD_CLASSES} ${!prof.is_active ? 'opacity-[0.65] bg-bg-primary' : ''}`}
              >
                <div className={PROF_CARD_HEADER_CLASSES}>
                  <div className={PROF_CARD_TITLE_GROUP_CLASSES}>
                    <Avatar name={prof.name} size="md" />
                    <div className="flex flex-col gap-[0.15rem] min-w-0">
                      <div className="flex items-center gap-[0.45rem] flex-wrap">
                        <h4 className="text-base font-extrabold text-text-primary m-0 tracking-[-0.01em] break-words">{prof.name}</h4>
                        {!prof.is_active && (
                          <Badge variant="neutral">Inativo</Badge>
                        )}
                      </div>
                      <span className="text-xs text-text-primary font-bold [font-variant-numeric:tabular-nums]">{prof.phone}</span>
                    </div>
                  </div>

                  <div className="text-xs bg-brand-lightest text-text-primary shadow-[0_0_0_0.8px_var(--color-text-primary)] py-[0.35rem] px-[0.65rem] rounded-full font-semibold whitespace-nowrap shrink-0">
                    <span className="text-text-primary">
                      Comissão: <strong>{prof.commission_percentage}%</strong>
                    </span>
                  </div>
                </div>

                <div className={PROF_CARD_SCHEDULE_CLASSES}>
                  <h5 className="text-[11px] uppercase tracking-[0.05em] text-text-primary m-0 font-bold">Escala de atendimento</h5>
                  <div className={SCHEDULE_BADGES_CLASSES}>
                    {DAYS_OF_WEEK.map((day) => {
                      const dayData = prof.weekly_schedule?.[day.key] as any;
                      const labelCurto = day.label.substring(0, 3);
                      const isDayActive = !!dayData;

                      if (isDayActive) {
                        const breakInfo = dayData.break_start
                          ? ` (Almoço: ${dayData.break_start} às ${dayData.break_end})`
                          : '';
                        return (
                          <div
                            key={day.key}
                            className="bg-brand-lightest shadow-[0_0_0_0.8px_var(--color-text-primary)] rounded-sm py-[0.4rem] px-[0.2rem] max-sm:py-[0.35rem] max-sm:px-[0.1rem] flex flex-col items-center justify-center gap-[0.15rem] min-w-0 w-full box-border text-center transition-[transform,box-shadow] duration-200 ease hover:shadow-[0_0_0_1.2px_var(--color-text-primary)] hover:-translate-y-px"
                            title={`${day.label}: ${dayData.start} às ${dayData.end}${breakInfo}`}
                          >
                            <span className="text-[clamp(9px,2.4vw,11px)] font-bold uppercase text-text-primary leading-none">{labelCurto}</span>
                            <span className="text-[clamp(9px,2.4vw,11px)] font-extrabold [font-variant-numeric:tabular-nums] text-text-primary leading-[1.1] whitespace-nowrap overflow-hidden text-clip">{dayData.start.substring(0, 5)}</span>
                          </div>
                        );
                      } else {
                        return (
                          <div
                            key={day.key}
                            className="bg-transparent border border-dashed border-border rounded-sm py-[0.4rem] px-[0.2rem] max-sm:py-[0.35rem] max-sm:px-[0.1rem] flex flex-col items-center justify-center gap-[0.15rem] min-w-0 w-full box-border text-center opacity-[0.55]"
                            title={`${day.label}: Folga`}
                          >
                            <span className="text-[clamp(9px,2.4vw,11px)] font-bold uppercase text-text-primary leading-none">{labelCurto}</span>
                            <span className="text-[clamp(9px,2.4vw,11px)] font-extrabold [font-variant-numeric:tabular-nums] text-text-primary leading-[1.1] whitespace-nowrap overflow-hidden text-clip">Folga</span>
                          </div>
                        );
                      }
                    })}
                  </div>
                </div>

                <div className={PROF_CARD_ACTIONS_CLASSES}>
                  <div className={LOGIN_STATUS_CLASSES}>
                    {prof.user_id ? (
                      <span
                        className={`inline-flex items-center gap-[0.3rem] text-[11px] font-bold py-1 px-2 rounded-full bg-success-bg text-success border border-[rgba(14,159,110,0.25)] ${STATUS_BADGE_MOBILE_CLASSES}`}
                        title="Este barbeiro já possui login de acesso"
                      >
                        <CheckIcon /> Login vinculado
                      </span>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-[0.3rem] text-[11px] font-bold py-1 px-2 rounded-full bg-warning-bg text-text-primary shadow-[0_0_0_1px_var(--color-text-primary)] ${STATUS_BADGE_MOBILE_CLASSES}`}
                        title="Este barbeiro ainda não possui acesso ao painel"
                      >
                        <AlertIcon /> Sem login
                      </span>
                    )}
                  </div>

                  <div className={ACTION_BUTTONS_CLASSES}>
                    <Button
                      size="sm"
                      variant="soft"
                      onClick={() => handleOpenServicesModal(prof)}
                      icon={<ScissorIcon />}
                      title="Configurar serviços atendidos e tempo de corte deste barbeiro"
                      className={ACTION_BUTTON_MOBILE_CLASSES}
                    >
                      Serviços e tempos
                    </Button>
                    <Button
                      size="sm"
                      variant="soft"
                      onClick={() => handleEdit(prof)}
                      icon={<HugeiconsIcon icon={Edit01Icon} size={15} />}
                      title="Editar dados e escala deste barbeiro"
                      className={ACTION_BUTTON_MOBILE_CLASSES}
                    >
                      Editar Escala/Dados
                    </Button>
                    <Button
                      size="sm"
                      variant="soft"
                      onClick={() => setProfToDelete(prof)}
                      icon={<HugeiconsIcon icon={Delete02Icon} size={15} />}
                      title="Excluir profissional (mantém histórico)"
                      aria-label={`Excluir profissional ${prof.name}`}
                      // Override do hover padrão (soft) do Button compartilhado: precisa de vermelho de perigo
                      // só neste botão. Como não podemos editar components/ui/forms/Button.tsx, usamos o
                      // modificador `!` do Tailwind para garantir precedência sobre a classe de variante.
                      className={`hover:!bg-[#F05252] hover:!text-white hover:!shadow-[0_0_0_1px_#F05252] ${ACTION_BUTTON_MOBILE_CLASSES}`}
                    >
                      Excluir
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* DRAWER DE CADASTRO / EDIÇÃO DE PROFISSIONAL */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-[4px] z-[9999] flex justify-end items-stretch animate-fade-in max-md:items-end"
          onClick={(e) => e.target === e.currentTarget && handleCloseDrawer()}
        >
          <div
            className="bg-bg-primary w-full max-w-[520px] h-full flex flex-col shadow-xl animate-slide-in-right border-l border-border overflow-hidden max-md:max-w-full max-md:h-[90dvh] max-md:max-h-[90dvh] max-md:rounded-t-[20px] max-md:border-l-0 max-md:border-t max-md:animate-[slideUp_0.25s_cubic-bezier(0.16,1,0.3,1)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="prof-drawer-heading"
          >
            <div className="flex justify-between items-center py-5 px-6 border-b border-border bg-bg-secondary shrink-0">
              <div className="flex items-center gap-3">
                <h3 id="prof-drawer-heading" className="text-base font-extrabold text-text-primary m-0">
                  {editingId ? 'Editar Profissional' : 'Novo Profissional'}
                </h3>
              </div>
              <IconButton
                icon={<HugeiconsIcon icon={Cancel01Icon} size={20} />}
                variant="ghost"
                size="sm"
                onClick={handleCloseDrawer}
                aria-label="Fechar painel"
              />
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 h-[calc(100%-73px)] overflow-hidden">
              <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5">
                <div className="flex flex-col gap-[0.35rem]">
                  <label htmlFor="prof-name" className="text-xs font-bold uppercase tracking-[0.04em] text-text-primary whitespace-nowrap overflow-hidden text-ellipsis leading-[1.2]">Nome do Barbeiro *</label>
                  <input
                    id="prof-name"
                    type="text"
                    placeholder="Ex: Carlos Silva"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="py-[0.65rem] px-[0.85rem] min-h-[42px] border-0 shadow-[0_0_0_0.8px_var(--color-text-primary)] rounded-md bg-bg-secondary text-text-primary text-sm outline-none transition-[box-shadow,background-color] duration-200 ease w-full focus:shadow-[0_0_0_1.5px_var(--color-brand-primary)] placeholder:text-text-secondary placeholder:opacity-65"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 items-start max-[480px]:grid-cols-1">
                  <div className="flex flex-col gap-[0.35rem]">
                    <label htmlFor="prof-phone" className="text-xs font-bold uppercase tracking-[0.04em] text-text-primary whitespace-nowrap overflow-hidden text-ellipsis leading-[1.2]">WhatsApp / Celular *</label>
                    <input
                      id="prof-phone"
                      type="text"
                      placeholder="Ex: (11) 99999-9999"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      className="py-[0.65rem] px-[0.85rem] min-h-[42px] border-0 shadow-[0_0_0_0.8px_var(--color-text-primary)] rounded-md bg-bg-secondary text-text-primary text-sm outline-none transition-[box-shadow,background-color] duration-200 ease w-full focus:shadow-[0_0_0_1.5px_var(--color-brand-primary)] placeholder:text-text-secondary placeholder:opacity-65"
                    />
                  </div>

                  <div className="flex flex-col gap-[0.35rem]">
                    <label htmlFor="prof-commission" className="text-xs font-bold uppercase tracking-[0.04em] text-text-primary whitespace-nowrap overflow-hidden text-ellipsis leading-[1.2]">Comissão Padrão (%) *</label>
                    <input
                      id="prof-commission"
                      type="number"
                      min="0"
                      max="100"
                      placeholder="Ex: 40"
                      value={commission}
                      onChange={(e) => setCommission(e.target.value)}
                      required
                      className="py-[0.65rem] px-[0.85rem] min-h-[42px] border-0 shadow-[0_0_0_0.8px_var(--color-text-primary)] rounded-md bg-bg-secondary text-text-primary text-sm outline-none transition-[box-shadow,background-color] duration-200 ease w-full focus:shadow-[0_0_0_1.5px_var(--color-brand-primary)] placeholder:text-text-secondary placeholder:opacity-65 text-center"
                    />
                  </div>
                </div>

                {/* SEÇÃO DA ESCALA DE TRABALHO */}
                <div className="bg-bg-primary shadow-[0_0_0_0.3px_var(--color-text-primary)] rounded-md p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-[0.4rem] text-text-primary">
                    <ClockIcon />
                    <span className="text-xs font-extrabold uppercase tracking-[0.08em] text-text-primary">Escala semanal de atendimento</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {DAYS_OF_WEEK.map((day) => {
                      const daySched = schedule[day.key];
                      const dayBusinessHours = getBusinessHoursForDayKey(day.key, tenant.businessHours);
                      const scheduleTimeOptions = generateProfessionalTimeOptions(
                        dayBusinessHours.open,
                        dayBusinessHours.close,
                      );
                      const breakTimeOptions = generateProfessionalTimeOptions(
                        daySched.start,
                        daySched.end,
                      );
                      return (
                        <div
                          key={day.key}
                          className="bg-bg-secondary shadow-[0_0_0_0.3px_var(--color-text-primary)] rounded-md py-[0.65rem] px-[0.85rem] flex flex-col gap-2 transition-shadow duration-200 ease"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`check-${day.key}`}
                              checked={daySched.active}
                              onChange={() => handleScheduleDayToggle(day.key)}
                              className="w-[18px] h-[18px] accent-brand-primary cursor-pointer"
                            />
                            <label htmlFor={`check-${day.key}`} className="text-sm font-bold cursor-pointer text-text-primary">{day.label}</label>
                          </div>

                          {daySched.active && (
                            <div className="flex flex-col gap-[0.65rem] pt-[0.65rem] border-t border-dashed border-border">
                              {/* Horário de Trabalho */}
                              <div className="flex items-center justify-between gap-2 w-full max-[480px]:flex-col max-[480px]:items-start max-[480px]:gap-[0.35rem]">
                                <span className="text-xs font-bold text-text-primary uppercase tracking-[0.04em] shrink-0 min-w-[78px]">Expediente:</span>
                                <div className="flex items-center gap-[0.4rem] flex-1 min-w-0 justify-end max-[480px]:w-full max-[480px]:justify-between">
                                  <select
                                    className="flex-1 min-w-0 max-w-[105px] h-[38px] py-[0.35rem] px-[0.4rem] border-0 shadow-[0_0_0_0.8px_var(--color-text-primary)] rounded-sm text-xs font-bold [font-variant-numeric:tabular-nums] bg-bg-secondary text-text-primary text-center box-border transition-shadow duration-200 ease focus:outline-none focus:shadow-[0_0_0_1.5px_var(--color-brand-primary)] max-[480px]:max-w-none max-[480px]:w-full max-[480px]:h-[42px] max-[480px]:text-sm"
                                    value={daySched.start}
                                    aria-label={`Início do expediente de ${day.label}`}
                                    onChange={(e) => handleScheduleTimeChange(day.key, 'start', e.target.value)}
                                  >
                                    {scheduleTimeOptions.map((option) => (
                                      <option key={option} value={option}>{option}</option>
                                    ))}
                                  </select>
                                  <span className="text-text-primary text-[11px] font-bold shrink-0">às</span>
                                  <select
                                    className="flex-1 min-w-0 max-w-[105px] h-[38px] py-[0.35rem] px-[0.4rem] border-0 shadow-[0_0_0_0.8px_var(--color-text-primary)] rounded-sm text-xs font-bold [font-variant-numeric:tabular-nums] bg-bg-secondary text-text-primary text-center box-border transition-shadow duration-200 ease focus:outline-none focus:shadow-[0_0_0_1.5px_var(--color-brand-primary)] max-[480px]:max-w-none max-[480px]:w-full max-[480px]:h-[42px] max-[480px]:text-sm"
                                    value={daySched.end}
                                    aria-label={`Fim do expediente de ${day.label}`}
                                    onChange={(e) => handleScheduleTimeChange(day.key, 'end', e.target.value)}
                                  >
                                    {scheduleTimeOptions.map((option) => (
                                      <option key={option} value={option}>{option}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              {/* Intervalo de Almoço */}
                              <div className="flex items-center justify-between gap-2 w-full max-[480px]:flex-col max-[480px]:items-start max-[480px]:gap-[0.35rem]">
                                <span className="text-xs font-bold text-text-primary uppercase tracking-[0.04em] shrink-0 min-w-[78px]">Almoço:</span>
                                <div className="flex items-center gap-[0.4rem] flex-1 min-w-0 justify-end max-[480px]:w-full max-[480px]:justify-between">
                                  <select
                                    className="flex-1 min-w-0 max-w-[105px] h-[38px] py-[0.35rem] px-[0.4rem] border-0 shadow-[0_0_0_0.8px_var(--color-text-primary)] rounded-sm text-xs font-bold [font-variant-numeric:tabular-nums] bg-bg-secondary text-text-primary text-center box-border transition-shadow duration-200 ease focus:outline-none focus:shadow-[0_0_0_1.5px_var(--color-brand-primary)] max-[480px]:max-w-none max-[480px]:w-full max-[480px]:h-[42px] max-[480px]:text-sm"
                                    value={daySched.break_start || ''}
                                    aria-label="Início do Almoço"
                                    onChange={(e) =>
                                      handleScheduleTimeChange(day.key, 'break_start', e.target.value)
                                    }
                                  >
                                    <option value="">Sem intervalo</option>
                                    {breakTimeOptions.map((option) => (
                                      <option key={option} value={option}>{option}</option>
                                    ))}
                                  </select>
                                  <span className="text-text-primary text-[11px] font-bold shrink-0">às</span>
                                  <select
                                    className="flex-1 min-w-0 max-w-[105px] h-[38px] py-[0.35rem] px-[0.4rem] border-0 shadow-[0_0_0_0.8px_var(--color-text-primary)] rounded-sm text-xs font-bold [font-variant-numeric:tabular-nums] bg-bg-secondary text-text-primary text-center box-border transition-shadow duration-200 ease focus:outline-none focus:shadow-[0_0_0_1.5px_var(--color-brand-primary)] max-[480px]:max-w-none max-[480px]:w-full max-[480px]:h-[42px] max-[480px]:text-sm"
                                    value={daySched.break_end || ''}
                                    aria-label="Fim do Almoço"
                                    onChange={(e) =>
                                      handleScheduleTimeChange(day.key, 'break_end', e.target.value)
                                    }
                                  >
                                    <option value="">Sem intervalo</option>
                                    {breakTimeOptions.map((option) => (
                                      <option key={option} value={option}>{option}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {editingId && (
                  <div className="flex flex-row items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      id="prof-active"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="w-[18px] h-[18px] accent-brand-primary cursor-pointer"
                    />
                    <label htmlFor="prof-active">Barbeiro ativo na agenda de clientes</label>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 py-4 px-6 border-t border-border bg-bg-secondary shrink-0">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCloseDrawer}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={saving}
                  // O rodapé do drawer usa um contorno fino (ring) em vez da sombra laranja
                  // padrão do variant="primary". Como não editamos o Button compartilhado,
                  // usamos `!` para garantir que este box-shadow vença o da variante.
                  className="!shadow-[0_0_0_0.8px_var(--color-text-primary)]"
                >
                  {editingId ? 'Salvar Alterações' : 'Cadastrar Profissional'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO (SOFT DELETE) */}
      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO (SOFT DELETE) */}
      <ConfirmSoftDeleteModal
        isOpen={Boolean(profToDelete)}
        title="Excluir profissional"
        itemName={profToDelete?.name || ''}
        itemTypeLabel="o profissional"
        warningText="O histórico de atendimentos passados, comandas e relatórios de comissão será 100% preservado, mas este profissional não estará mais disponível para novos agendamentos na agenda ou no canal do cliente."
        loading={saving}
        onConfirm={handleDeleteProf}
        onClose={() => setProfToDelete(null)}
      />

      {/* MODAL DE ASSOCIAÇÃO DE SERVIÇOS E DURAÇÃO INDIVIDUAL */}
      {isServicesModalOpen && selectedProfForServices && (
        <div
          className="fixed inset-0 bg-[rgba(20,17,15,0.5)] backdrop-blur-[8px] grid place-items-center z-[1000] p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsServicesModalOpen(false);
          }}
        >
          <div
            className="bg-bg-secondary border border-border rounded-lg w-full overflow-hidden shadow-xl"
            style={{ maxWidth: '680px' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-services-title"
          >
            <header className="flex justify-between items-start py-5 px-6 border-b border-border bg-bg-secondary">
              <div>
                <span className="text-[11px] uppercase tracking-[0.1em] font-extrabold text-text-primary block mb-[0.2rem]">Tempo e comissão por serviço</span>
                <h3 id="modal-services-title" className="text-base font-extrabold text-text-primary m-0 tracking-[-0.01em]">
                  Serviços atendidos por {selectedProfForServices.name}
                </h3>
              </div>
              <IconButton
                icon={<CloseIcon />}
                variant="ghost"
                size="sm"
                onClick={() => setIsServicesModalOpen(false)}
                aria-label="Fechar modal de serviços"
                title="Fechar"
              />
            </header>

            <div className="py-5 px-6">
              <p className="text-sm text-text-secondary mb-4 leading-[1.5]">
                Defina quais serviços este profissional realiza na barbearia e a duração individual de cada atendimento. O padrão da barbearia é de <strong>40 minutos</strong>.
              </p>

              <div className="flex gap-2 mb-4 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={handleEnableAllServices}
                  // O toolbar precisa de um fundo/anel diferentes do outline padrão do Button
                  // compartilhado (que usamos sem poder editar); `!` garante a precedência.
                  className="!bg-bg-secondary !border-0 !text-text-primary !shadow-[0_0_0_0.8px_var(--color-text-primary)] hover:!bg-brand-soft hover:!text-text-primary hover:!shadow-[0_0_0_1px_var(--color-text-primary)]"
                >
                  Habilitar todos (40 min padrão)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={handleDisableAllServices}
                  className="!bg-bg-secondary !border-0 !text-text-primary !shadow-[0_0_0_0.8px_var(--color-text-primary)] hover:!bg-brand-soft hover:!text-text-primary hover:!shadow-[0_0_0_1px_var(--color-text-primary)]"
                >
                  Desabilitar todos
                </Button>
              </div>

              {loadingProfServices ? (
                <div className="border border-border rounded-md overflow-hidden max-h-[380px] overflow-y-auto overflow-x-auto bg-bg-secondary" role="status" aria-busy="true">
                  <span className="sr-only">Carregando catálogo de serviços...</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem' }}>
                    {[...Array(4)].map((_, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <Skeleton shape="rect" width={20} height={20} style={{ borderRadius: 'var(--radius-xs, 4px)' }} />
                        <Skeleton shape="text" width="40%" height={16} />
                        <Skeleton shape="rect" width={100} height={32} style={{ borderRadius: 'var(--radius-sm)', marginLeft: 'auto' }} />
                        <Skeleton shape="rect" width={100} height={32} style={{ borderRadius: 'var(--radius-sm)' }} />
                      </div>
                    ))}
                  </div>
                </div>
              ) : profServicesList.length === 0 ? (
                <div>
                  <p>Nenhum serviço cadastrado na barbearia.</p>
                </div>
              ) : (
                <div className="border border-border rounded-md overflow-hidden max-h-[380px] overflow-y-auto overflow-x-auto bg-bg-secondary">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        <th style={{ width: '48px', textAlign: 'center' }} className="bg-[#FDF3EA] py-3 px-4 text-[11px] uppercase tracking-[0.05em] font-extrabold text-text-primary border-b border-border sticky top-0 z-[1]">Atende?</th>
                        <th className="bg-[#FDF3EA] py-3 px-4 text-[11px] uppercase tracking-[0.05em] font-extrabold text-text-primary border-b border-border text-left sticky top-0 z-[1]">Serviço</th>
                        <th style={{ width: '135px' }} className="bg-[#FDF3EA] py-3 px-4 text-[11px] uppercase tracking-[0.05em] font-extrabold text-text-primary border-b border-border text-left sticky top-0 z-[1]">Duração (min)</th>
                        <th style={{ width: '135px' }} className="bg-[#FDF3EA] py-3 px-4 text-[11px] uppercase tracking-[0.05em] font-extrabold text-text-primary border-b border-border text-left sticky top-0 z-[1]">Comissão (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profServicesList.map((svc) => (
                        <tr
                          key={svc.service_id}
                          className={!svc.is_enabled ? 'opacity-50 bg-bg-primary' : ''}
                        >
                          <td style={{ textAlign: 'center' }} className="py-3 px-4 border-b border-border">
                            <input
                              type="checkbox"
                              checked={svc.is_enabled}
                              onChange={() => handleToggleService(svc.service_id)}
                              aria-label={`Habilitar ${svc.service_name}`}
                              className="w-[18px] h-[18px] accent-brand-primary cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-4 border-b border-border">
                            <div className="flex flex-col gap-[0.15rem]">
                              <strong>{svc.service_name}</strong>
                              <span className="text-text-secondary text-xs">
                                R$ {svc.base_price.toFixed(2).replace('.', ',')}{' '}
                                {svc.service_category && `• ${svc.service_category}`}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 border-b border-border">
                            <div className="relative flex items-center">
                              <input
                                type="number"
                                min="10"
                                max="300"
                                step="5"
                                disabled={!svc.is_enabled}
                                value={svc.custom_duration_minutes}
                                aria-label={`Duração em minutos para ${svc.service_name}`}
                                onChange={(e) =>
                                  handleDurationChange(
                                    svc.service_id,
                                    parseInt(e.target.value, 10) || 40
                                  )
                                }
                                className="font-mono text-center pr-8 min-h-[36px] border-0 shadow-[0_0_0_0.8px_var(--color-text-primary)] rounded-sm text-xs font-bold [font-variant-numeric:tabular-nums] bg-bg-secondary text-text-primary w-full transition-shadow duration-200 ease focus:outline-none focus:shadow-[0_0_0_1.5px_var(--color-brand-primary)] disabled:opacity-60 disabled:shadow-[0_0_0_0.4px_var(--color-border)] disabled:cursor-not-allowed"
                                placeholder="40"
                              />
                              <span className="absolute right-[0.6rem] text-[11px] text-text-primary pointer-events-none font-bold">min</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 border-b border-border">
                            <div className="relative flex items-center">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                disabled={!svc.is_enabled}
                                value={
                                  svc.custom_commission_percentage !== null &&
                                  svc.custom_commission_percentage !== undefined
                                    ? svc.custom_commission_percentage
                                    : ''
                                }
                                aria-label={`Comissão personalizada em porcentagem para ${svc.service_name}`}
                                onChange={(e) =>
                                  handleCommissionChange(
                                    svc.service_id,
                                    e.target.value === '' ? null : parseFloat(e.target.value)
                                  )
                                }
                                className="font-mono text-center pr-8 min-h-[36px] border-0 shadow-[0_0_0_0.8px_var(--color-text-primary)] rounded-sm text-xs font-bold [font-variant-numeric:tabular-nums] bg-bg-secondary text-text-primary w-full transition-shadow duration-200 ease focus:outline-none focus:shadow-[0_0_0_1.5px_var(--color-brand-primary)] disabled:opacity-60 disabled:shadow-[0_0_0_0.4px_var(--color-border)] disabled:cursor-not-allowed"
                                placeholder={`${selectedProfForServices.commission_percentage}%`}
                              />
                              <span className="absolute right-[0.6rem] text-[11px] text-text-primary pointer-events-none font-bold">%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <footer className="flex justify-end gap-3 pt-5 mt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsServicesModalOpen(false)}
                  className="!bg-bg-secondary !border-0 !text-text-primary !shadow-[0_0_0_0.8px_var(--color-text-primary)] hover:!bg-black/4 hover:!text-text-primary hover:!shadow-[0_0_0_1px_var(--color-text-primary)]"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleSaveServices}
                  loading={savingProfServices}
                  // O footer do modal usa um destaque "soft" (marrom claro) em vez do laranja
                  // padrão do variant="primary"; `!` garante precedência sem editar o Button.
                  className="!bg-brand-soft !text-text-primary !border-0 !shadow-[0_0_0_0.3px_var(--color-text-primary)] hover:!bg-[#f2b277] hover:!text-text-primary hover:!shadow-[0_0_0_0.8px_var(--color-text-primary)] font-extrabold"
                >
                  Salvar configurações
                </Button>
              </footer>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
