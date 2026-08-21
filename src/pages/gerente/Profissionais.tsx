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
} from '@hugeicons/core-free-icons';

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

const CloseIcon = () => <HugeiconsIcon icon={Cancel01Icon} size={20} />;
const ScissorIcon = () => <HugeiconsIcon icon={HugeScissorIcon} size={15} />;
const CheckIcon = () => <HugeiconsIcon icon={CheckmarkCircle02Icon} size={13} />;
const AlertIcon = () => <HugeiconsIcon icon={AlertCircleIcon} size={13} />;
const ClockIcon = () => <HugeiconsIcon icon={Clock01Icon} size={13} />;

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

  // Estados do Formulário de Profissional
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [commission, setCommission] = useState('40');
  const [isActive, setIsActive] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Estados do Modal de Associação de Serviços (N:N)
  const [isServicesModalOpen, setIsServicesModalOpen] = useState(false);
  const [selectedProfForServices, setSelectedProfForServices] = useState<Professional | null>(null);
  const [profServicesList, setProfServicesList] = useState<ProfessionalServiceItem[]>([]);
  const [loadingProfServices, setLoadingProfServices] = useState(false);
  const [savingProfServices, setSavingProfServices] = useState(false);

  // Escala de horários semanal padrão
  const [schedule, setSchedule] = useState<Record<string, { active: boolean; start: string; end: string; break_start?: string; break_end?: string }>>({
    monday: { active: true, start: '09:00', end: '18:00', break_start: '12:00', break_end: '13:00' },
    tuesday: { active: true, start: '09:00', end: '18:00', break_start: '12:00', break_end: '13:00' },
    wednesday: { active: true, start: '09:00', end: '18:00', break_start: '12:00', break_end: '13:00' },
    thursday: { active: true, start: '09:00', end: '18:00', break_start: '12:00', break_end: '13:00' },
    friday: { active: true, start: '09:00', end: '18:00', break_start: '12:00', break_end: '13:00' },
    saturday: { active: true, start: '09:00', end: '18:00', break_start: '12:00', break_end: '13:00' },
    sunday: { active: false, start: '09:00', end: '13:00', break_start: '12:00', break_end: '13:00' },
  });

  const fetchProfessionals = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('professionals')
        .select('*')
        .eq('tenant_id', tenant.tenantId)
        .order('name', { ascending: true });

      if (error) throw error;
      setProfessionals(data || []);
    } catch (error: any) {
      addToast('Não foi possível carregar a equipe de profissionais.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfessionals();
  }, [tenant.tenantId]);

  // Listener para fechar modal com tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isServicesModalOpen) {
        setIsServicesModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isServicesModalOpen]);

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
    setSchedule({
      monday: { active: true, start: '09:00', end: '18:00', break_start: '12:00', break_end: '13:00' },
      tuesday: { active: true, start: '09:00', end: '18:00', break_start: '12:00', break_end: '13:00' },
      wednesday: { active: true, start: '09:00', end: '18:00', break_start: '12:00', break_end: '13:00' },
      thursday: { active: true, start: '09:00', end: '18:00', break_start: '12:00', break_end: '13:00' },
      friday: { active: true, start: '09:00', end: '18:00', break_start: '12:00', break_end: '13:00' },
      saturday: { active: true, start: '09:00', end: '18:00', break_start: '12:00', break_end: '13:00' },
      sunday: { active: false, start: '09:00', end: '13:00', break_start: '12:00', break_end: '13:00' },
    });
  };

  const handleEdit = (prof: Professional) => {
    setEditingId(prof.id);
    setName(prof.name);
    setPhone(prof.phone);
    setCommission(prof.commission_percentage.toString());
    setIsActive(prof.is_active);
    setSelectedUserId(prof.user_id);

    const newSchedule = {
      monday: { active: false, start: '09:00', end: '18:00', break_start: '12:00', break_end: '13:00' },
      tuesday: { active: false, start: '09:00', end: '18:00', break_start: '12:00', break_end: '13:00' },
      wednesday: { active: false, start: '09:00', end: '18:00', break_start: '12:00', break_end: '13:00' },
      thursday: { active: false, start: '09:00', end: '18:00', break_start: '12:00', break_end: '13:00' },
      friday: { active: false, start: '09:00', end: '18:00', break_start: '12:00', break_end: '13:00' },
      saturday: { active: false, start: '09:00', end: '18:00', break_start: '12:00', break_end: '13:00' },
      sunday: { active: false, start: '09:00', end: '18:00', break_start: '12:00', break_end: '13:00' },
    };

    if (prof.weekly_schedule) {
      Object.keys(prof.weekly_schedule).forEach((day) => {
        const dayData = prof.weekly_schedule?.[day];
        if (dayData) {
          newSchedule[day as keyof typeof newSchedule] = {
            active: true,
            start: dayData.start,
            end: dayData.end,
            break_start: dayData.break_start || '12:00',
            break_end: dayData.break_end || '13:00',
          };
        }
      });
    }

    setSchedule(newSchedule);
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
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [type]: value,
      },
    }));
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

    try {
      setSaving(true);

      const weeklyScheduleJSON: Record<string, { start: string; end: string; break_start?: string; break_end?: string }> = {};
      Object.keys(schedule).forEach((day) => {
        if (schedule[day].active) {
          weeklyScheduleJSON[day] = {
            start: schedule[day].start,
            end: schedule[day].end,
            break_start: schedule[day].break_start || '12:00',
            break_end: schedule[day].break_end || '13:00',
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

      resetForm();
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
    <div className="prof-page">
      <header className="prof-header-intro">
        <h2>Equipe e escala da barbearia</h2>
        <p>
          Cadastre seus barbeiros, configure a comissão de cada profissional, personalize o tempo de atendimento por corte e organize os horários de atendimento na semana.
        </p>
      </header>

      <div className="prof-grid">
        {/* Painel do Formulário */}
        <section className="form-section card" aria-labelledby="prof-form-heading">
          <div className="section-title-wrap">
            <h3 id="prof-form-heading">{editingId ? 'Editar Profissional' : 'Novo Profissional'}</h3>
            <span className="section-subtitle">
              {editingId ? 'Atualize os dados e os dias de atendimento do barbeiro' : 'Preencha os dados cadastrais do novo barbeiro da equipe'}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="prof-form">
            <div className="form-group">
              <label htmlFor="prof-name">Nome do Barbeiro</label>
              <input
                id="prof-name"
                type="text"
                placeholder="Ex: Carlos Silva"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="prof-phone">WhatsApp / Celular</label>
                <input
                  id="prof-phone"
                  type="text"
                  placeholder="Ex: (11) 99999-9999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="prof-commission">Comissão Padrão (%)</label>
                <input
                  id="prof-commission"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Ex: 40"
                  value={commission}
                  onChange={(e) => setCommission(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* SEÇÃO DA ESCALA DE TRABALHO */}
            <div className="schedule-section">
              <div className="schedule-section-header">
                <ClockIcon />
                <span className="schedule-title">Escala semanal de atendimento</span>
              </div>
              <div className="schedule-list">
                {DAYS_OF_WEEK.map((day) => {
                  const daySched = schedule[day.key];
                  return (
                    <div
                      key={day.key}
                      className={`schedule-day-item ${daySched.active ? 'schedule-day-item--active' : ''}`}
                    >
                      <div className="day-checkbox">
                        <input
                          type="checkbox"
                          id={`check-${day.key}`}
                          checked={daySched.active}
                          onChange={() => handleScheduleDayToggle(day.key)}
                        />
                        <label htmlFor={`check-${day.key}`}>{day.label}</label>
                      </div>

                      {daySched.active && (
                        <div className="day-schedule-details">
                          {/* Horário de Trabalho */}
                          <div className="schedule-row">
                            <span className="schedule-row-label">Expediente:</span>
                            <div className="schedule-row-inputs">
                              <input
                                type="time"
                                className="day-times-input"
                                value={daySched.start}
                                aria-label={`Início do expediente de ${day.label}`}
                                onChange={(e) => handleScheduleTimeChange(day.key, 'start', e.target.value)}
                              />
                              <span className="schedule-row-sep">às</span>
                              <input
                                type="time"
                                className="day-times-input"
                                value={daySched.end}
                                aria-label={`Fim do expediente de ${day.label}`}
                                onChange={(e) => handleScheduleTimeChange(day.key, 'end', e.target.value)}
                              />
                            </div>
                          </div>

                          {/* Intervalo de Almoço */}
                          <div className="schedule-row">
                            <span className="schedule-row-label">Almoço:</span>
                            <div className="schedule-row-inputs">
                              <input
                                type="time"
                                className="day-times-input"
                                value={daySched.break_start || '12:00'}
                                aria-label="Início do Almoço"
                                onChange={(e) =>
                                  handleScheduleTimeChange(day.key, 'break_start', e.target.value)
                                }
                              />
                              <span className="schedule-row-sep">às</span>
                              <input
                                type="time"
                                className="day-times-input"
                                value={daySched.break_end || '13:00'}
                                aria-label="Fim do Almoço"
                                onChange={(e) =>
                                  handleScheduleTimeChange(day.key, 'break_end', e.target.value)
                                }
                              />
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
              <div className="form-group checkbox-group">
                <input
                  type="checkbox"
                  id="prof-active"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <label htmlFor="prof-active">Barbeiro ativo na agenda de clientes</label>
              </div>
            )}

            <div className="form-actions">
              {editingId && (
                <button type="button" onClick={resetForm} className="btn btn--outline-secondary">
                  Cancelar
                </button>
              )}
              <button type="submit" disabled={saving} className="btn btn--primary">
                {saving ? (
                  <div className="spinner spinner--sm" />
                ) : editingId ? (
                  'Salvar Alterações'
                ) : (
                  'Cadastrar Profissional'
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Painel da Listagem */}
        <section className="list-section card" aria-labelledby="prof-list-heading">
          <div className="list-header">
            <div className="list-header-left">
              <h3 id="prof-list-heading">Membros da equipe</h3>
              {!loading && (
                <span className="team-count-chip">
                  {professionals.length} {professionals.length === 1 ? 'barbeiro' : 'barbeiros'}
                </span>
              )}
            </div>
            <button
              onClick={() => navigate('/profissionais/cadastro-acesso')}
              className="btn btn--primary btn--sm"
              style={{ borderRadius: 'var(--radius-md)', padding: '0.45rem 0.9rem' }}
            >
              Criar acesso do barbeiro
            </button>
          </div>

          {loading ? (
            <div className="loading-state">
              <div
                className="spinner"
                style={{
                  borderColor: 'var(--color-brand-primary)',
                  borderTopColor: 'transparent',
                }}
              />
              <p>Carregando equipe...</p>
            </div>
          ) : professionals.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <HugeiconsIcon icon={UserGroupIcon} size={32} />
              </div>
              <p>Nenhum barbeiro cadastrado na barbearia.</p>
              <span className="empty-desc">
                Cadastre o primeiro profissional no formulário ao lado para liberar a agenda e permitir novos agendamentos.
              </span>
            </div>
          ) : (
            <div className="prof-list-container">
              {professionals.map((prof) => (
                <div
                  key={prof.id}
                  className={`prof-card ${!prof.is_active ? 'prof-card--inactive' : ''}`}
                >
                  <div className="prof-card-header">
                    <div className="prof-card-title-group">
                      <div className="prof-avatar" aria-hidden="true">
                        {prof.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="prof-meta-wrap">
                        <div className="prof-name-row">
                          <h4>{prof.name}</h4>
                          {!prof.is_active && (
                            <span className="prof-inactive-tag">Inativo</span>
                          )}
                        </div>
                        <span className="prof-phone">{prof.phone}</span>
                      </div>
                    </div>

                    <div className="prof-commission-badge">
                      <span>
                        Comissão: <strong>{prof.commission_percentage}%</strong>
                      </span>
                    </div>
                  </div>

                  <div className="prof-card-schedule">
                    <h5>Escala de atendimento</h5>
                    <div className="schedule-badges">
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
                              className="badge-schedule-active"
                              title={`${day.label}: ${dayData.start} às ${dayData.end}${breakInfo}`}
                            >
                              <span className="badge-day-name">{labelCurto}</span>
                              <span className="badge-schedule-hours">{dayData.start.substring(0, 5)}</span>
                            </div>
                          );
                        } else {
                          return (
                            <div
                              key={day.key}
                              className="badge-schedule-inactive"
                              title={`${day.label}: Folga`}
                            >
                              <span className="badge-day-name">{labelCurto}</span>
                              <span className="badge-schedule-hours">Folga</span>
                            </div>
                          );
                        }
                      })}
                    </div>
                  </div>

                  <div className="prof-card-actions">
                    <div className="login-status">
                      {prof.user_id ? (
                        <span
                          className="status-badge status-badge--linked"
                          title="Este barbeiro já possui login de acesso"
                        >
                          <CheckIcon /> Login vinculado
                        </span>
                      ) : (
                        <span
                          className="status-badge status-badge--unlinked"
                          title="Este barbeiro ainda não possui acesso ao painel"
                        >
                          <AlertIcon /> Sem login
                        </span>
                      )}
                    </div>

                    <div className="action-buttons">
                      <button
                        onClick={() => handleOpenServicesModal(prof)}
                        className="btn-action btn-action--services"
                        title="Configurar serviços atendidos e tempo de corte deste barbeiro"
                      >
                        <ScissorIcon /> Serviços e tempos
                      </button>
                      <button
                        onClick={() => handleEdit(prof)}
                        className="btn-action btn-action--edit"
                        title="Editar dados e escala deste barbeiro"
                      >
                        Editar Escala/Dados
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* MODAL DE ASSOCIAÇÃO DE SERVIÇOS E DURAÇÃO INDIVIDUAL */}
      {isServicesModalOpen && selectedProfForServices && (
        <div 
          className="modal-backdrop" 
          onClick={(e) => { 
            if (e.target === e.currentTarget) setIsServicesModalOpen(false); 
          }}
        >
          <div 
            className="modal-content shadow-xl animate-spring" 
            style={{ maxWidth: '680px' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-services-title"
          >
            <header className="modal-header">
              <div>
                <span className="modal-eyebrow">Tempo e comissão por serviço</span>
                <h3 id="modal-services-title" className="modal-title">
                  Serviços atendidos por {selectedProfForServices.name}
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => setIsServicesModalOpen(false)} 
                className="btn-close-modal"
                aria-label="Fechar modal de serviços"
                title="Fechar"
              >
                <CloseIcon />
              </button>
            </header>

            <div className="modal-body">
              <p className="modal-desc">
                Defina quais serviços este profissional realiza na barbearia e a duração individual de cada atendimento. O padrão da barbearia é de <strong>40 minutos</strong>.
              </p>

              <div className="modal-services-toolbar">
                <button
                  type="button"
                  onClick={handleEnableAllServices}
                  className="btn btn--outline btn--xs"
                >
                  Habilitar todos (40 min padrão)
                </button>
                <button
                  type="button"
                  onClick={handleDisableAllServices}
                  className="btn btn--outline-secondary btn--xs"
                >
                  Desabilitar todos
                </button>
              </div>

              {loadingProfServices ? (
                <div className="loading-state py-4">
                  <div className="spinner mb-2" />
                  <p>Carregando catálogo de serviços...</p>
                </div>
              ) : profServicesList.length === 0 ? (
                <div className="empty-state">
                  <p>Nenhum serviço cadastrado na barbearia.</p>
                </div>
              ) : (
                <div className="services-association-table-wrap">
                  <table className="services-association-table">
                    <thead>
                      <tr>
                        <th style={{ width: '48px', textAlign: 'center' }}>Atende?</th>
                        <th>Serviço</th>
                        <th style={{ width: '135px' }}>Duração (min)</th>
                        <th style={{ width: '135px' }}>Comissão (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profServicesList.map((svc) => (
                        <tr
                          key={svc.service_id}
                          className={!svc.is_enabled ? 'row-service-disabled' : ''}
                        >
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={svc.is_enabled}
                              onChange={() => handleToggleService(svc.service_id)}
                              aria-label={`Habilitar ${svc.service_name}`}
                            />
                          </td>
                          <td>
                            <div className="service-info-cell">
                              <strong>{svc.service_name}</strong>
                              <span className="text-muted text-xs">
                                R$ {svc.base_price.toFixed(2).replace('.', ',')}{' '}
                                {svc.service_category && `• ${svc.service_category}`}
                              </span>
                            </div>
                          </td>
                          <td>
                            <div className="input-suffix-wrapper">
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
                                className="form-control form-control--sm font-mono text-center"
                                placeholder="40"
                              />
                              <span className="input-suffix">min</span>
                            </div>
                          </td>
                          <td>
                            <div className="input-suffix-wrapper">
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
                                className="form-control form-control--sm font-mono text-center"
                                placeholder={`${selectedProfForServices.commission_percentage}%`}
                              />
                              <span className="input-suffix">%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <footer className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsServicesModalOpen(false)}
                  className="btn btn--outline"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveServices}
                  disabled={savingProfServices}
                  className="btn btn--primary"
                >
                  {savingProfServices ? (
                    <div className="spinner spinner--sm" />
                  ) : (
                    'Salvar configurações'
                  )}
                </button>
              </footer>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .prof-page {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .prof-header-intro {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.25rem;
        }

        .prof-header-intro h2 {
          font-size: var(--font-size-2xl);
          font-weight: 800;
          color: var(--color-text-primary);
          letter-spacing: -0.025em;
          margin: 0;
          line-height: 1.2;
        }

        .prof-header-intro p {
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
          margin: 0;
          max-width: 72ch;
          line-height: 1.5;
        }

        .prof-grid {
          display: grid;
          grid-template-columns: 420px 1fr;
          gap: 1.5rem;
          align-items: start;
        }

        @media (max-width: 1024px) {
          .prof-grid {
            grid-template-columns: 1fr;
          }
        }

        .card {
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 1.5rem;
          box-shadow: var(--shadow-sm);
        }

        .section-title-wrap {
          margin-bottom: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .section-title-wrap h3 {
          font-size: var(--font-size-lg);
          font-weight: 800;
          color: var(--color-text-primary);
          margin: 0;
          letter-spacing: -0.015em;
        }

        .section-subtitle {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
        }

        .list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
          margin-bottom: 1.25rem;
        }

        .list-header-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .list-header-left h3 {
          font-size: var(--font-size-lg);
          font-weight: 800;
          color: var(--color-text-primary);
          margin: 0;
          letter-spacing: -0.015em;
        }

        .team-count-chip {
          display: inline-flex;
          align-items: center;
          padding: 2px 8px;
          background: var(--color-bg-primary);
          color: var(--color-brand-deep);
          font-size: 11px;
          font-weight: 700;
          border-radius: var(--radius-full);
          border: 1px solid var(--color-border);
        }

        .prof-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
          align-items: start;
        }

        @media (max-width: 480px) {
          .form-row {
            grid-template-columns: 1fr;
          }
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .form-group label {
          font-size: var(--font-size-xs);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--color-text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.2;
        }

        .form-group input, .form-group select {
          padding: 0.65rem 0.85rem;
          min-height: 42px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background-color: var(--color-bg-secondary);
          color: var(--color-text-primary);
          font-size: var(--font-size-sm);
          outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
          width: 100%;
        }

        .form-group input:focus, .form-group select:focus {
          border-color: var(--color-brand-primary);
          box-shadow: 0 0 0 3px rgba(217, 108, 0, 0.15);
        }

        .form-group input::placeholder {
          color: rgba(112, 98, 91, 0.6);
        }

        .schedule-section {
          background: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .schedule-section-header {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          color: var(--color-brand-deep);
        }

        .schedule-title {
          font-size: var(--font-size-xs);
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--color-brand-deep);
        }

        .schedule-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .schedule-day-item {
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 0.65rem 0.85rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
        }

        .schedule-day-item--active {
          border-color: var(--color-brand-soft);
          background: var(--color-bg-secondary);
          box-shadow: 0 1px 3px rgba(217, 108, 0, 0.05);
        }

        .day-checkbox {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .day-checkbox input[type="checkbox"] {
          width: 18px;
          height: 18px;
          accent-color: var(--color-brand-primary);
          cursor: pointer;
        }

        .day-checkbox label {
          font-size: var(--font-size-sm);
          font-weight: 700;
          cursor: pointer;
          color: var(--color-text-primary);
        }

        .day-schedule-details {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          padding-top: 0.65rem;
          border-top: 1px dashed var(--color-border);
        }

        .schedule-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          width: 100%;
        }

        .schedule-row-label {
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          flex-shrink: 0;
          min-width: 78px;
        }

        .schedule-row-inputs {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          flex: 1;
          min-width: 0;
          justify-content: flex-end;
        }

        .day-times-input {
          flex: 1;
          min-width: 0;
          max-width: 105px;
          height: 38px;
          padding: 0.35rem 0.4rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          font-size: var(--font-size-xs);
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          background: var(--color-bg-secondary);
          color: var(--color-text-primary);
          text-align: center;
          box-sizing: border-box;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .day-times-input:focus {
          border-color: var(--color-brand-primary);
          outline: none;
          box-shadow: 0 0 0 2px rgba(217, 108, 0, 0.15);
        }

        .schedule-row-sep {
          color: var(--color-text-secondary);
          font-size: 11px;
          font-weight: 700;
          flex-shrink: 0;
        }

        @media (max-width: 480px) {
          .schedule-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.35rem;
          }

          .schedule-row-inputs {
            width: 100%;
            justify-content: space-between;
          }

          .day-times-input {
            max-width: none;
            width: 100%;
            height: 42px;
            font-size: var(--font-size-sm);
          }
        }

        .checkbox-group {
          flex-direction: row;
          align-items: center;
          gap: 0.5rem;
        }

        .checkbox-group input[type="checkbox"] {
          width: 18px;
          height: 18px;
          accent-color: var(--color-brand-primary);
          cursor: pointer;
        }

        .form-actions {
          display: flex;
          gap: 0.75rem;
          margin-top: 0.5rem;
        }

        .btn--outline-secondary {
          border: 1px solid var(--color-border);
          background: var(--color-bg-secondary);
          color: var(--color-text-secondary);
          border-radius: var(--radius-md);
        }

        .btn--outline-secondary:hover {
          background: var(--color-bg-primary);
          color: var(--color-text-primary);
          border-color: var(--color-brand-soft);
        }

        .prof-list-container {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .prof-card {
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease;
        }

        .prof-card:hover {
          border-color: var(--color-brand-soft);
          box-shadow: var(--shadow-md);
          transform: translateY(-1px);
        }

        .prof-card--inactive {
          opacity: 0.65;
          background: var(--color-bg-primary);
        }

        .prof-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .prof-card-title-group {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          min-width: 0;
          flex: 1 1 180px;
        }

        .prof-avatar {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, var(--color-brand-primary) 0%, var(--color-brand-deep) 100%);
          color: #ffffff;
          font-weight: 800;
          font-size: 1.15rem;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 2px 6px rgba(217, 108, 0, 0.2);
        }

        .prof-meta-wrap {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          min-width: 0;
        }

        .prof-name-row {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          flex-wrap: wrap;
        }

        .prof-name-row h4 {
          font-size: var(--font-size-base);
          font-weight: 800;
          color: var(--color-text-primary);
          margin: 0;
          letter-spacing: -0.01em;
          word-break: break-word;
        }

        .prof-inactive-tag {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          padding: 1px 6px;
          border-radius: var(--radius-sm);
          background: var(--color-warning-bg);
          color: var(--color-warning);
          border: 1px solid rgba(217, 119, 6, 0.2);
        }

        .prof-phone {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          font-variant-numeric: tabular-nums;
        }

        .prof-commission-badge {
          font-size: var(--font-size-xs);
          background: var(--color-brand-lightest);
          color: var(--color-brand-deep);
          border: 1px solid rgba(217, 108, 0, 0.2);
          padding: 0.35rem 0.65rem;
          border-radius: var(--radius-full);
          font-weight: 600;
          white-space: nowrap;
          box-shadow: 0 1px 2px rgba(217, 108, 0, 0.05);
          flex-shrink: 0;
        }

        .prof-card-schedule {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          width: 100%;
        }

        .prof-card-schedule h5 {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-secondary);
          margin: 0;
          font-weight: 700;
        }

        .schedule-badges {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 0.35rem;
          width: 100%;
          box-sizing: border-box;
        }

        .badge-schedule-active {
          background: var(--color-brand-lightest);
          border: 1px solid var(--color-brand-soft);
          border-radius: var(--radius-sm);
          padding: 0.4rem 0.2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.15rem;
          min-width: 0;
          width: 100%;
          box-sizing: border-box;
          text-align: center;
          transition: transform 0.2s ease, border-color 0.2s ease;
        }

        .badge-schedule-active:hover {
          border-color: var(--color-brand-primary);
          transform: translateY(-1px);
        }

        .badge-schedule-inactive {
          background: transparent;
          border: 1px dashed var(--color-border);
          border-radius: var(--radius-sm);
          padding: 0.4rem 0.2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.15rem;
          min-width: 0;
          width: 100%;
          box-sizing: border-box;
          text-align: center;
          opacity: 0.55;
        }

        .badge-day-name {
          font-size: clamp(9px, 2.4vw, 11px);
          font-weight: 700;
          text-transform: uppercase;
          color: var(--color-text-secondary);
          line-height: 1;
        }

        .badge-schedule-hours {
          font-size: clamp(9px, 2.4vw, 11px);
          font-weight: 800;
          font-variant-numeric: tabular-nums;
          color: var(--color-brand-deep);
          line-height: 1.1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: clip;
        }

        .prof-card-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid var(--color-border);
          padding-top: 0.75rem;
          flex-wrap: wrap;
          gap: 0.65rem;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 11px;
          font-weight: 700;
          padding: 4px 8px;
          border-radius: var(--radius-full);
        }

        .status-badge--linked {
          background: var(--color-success-bg);
          color: var(--color-success);
          border: 1px solid rgba(14, 159, 110, 0.25);
        }

        .status-badge--unlinked {
          background: var(--color-warning-bg);
          color: var(--color-warning);
          border: 1px solid rgba(217, 119, 6, 0.25);
        }

        .action-buttons {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .btn-action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          font-size: 12px;
          font-weight: 700;
          min-height: 40px;
          padding: 0.45rem 0.85rem;
          border-radius: var(--radius-md);
          cursor: pointer;
          border: 1px solid transparent;
          transition: all 0.2s ease;
          outline: none;
        }

        .btn-action:focus-visible {
          outline: 2px solid var(--color-brand-primary);
          outline-offset: 2px;
        }

        .btn-action--services {
          background: var(--color-bg-primary);
          color: var(--color-text-primary);
          border-color: var(--color-border);
        }

        .btn-action--services:hover {
          background: var(--color-brand-primary);
          color: #ffffff;
          border-color: var(--color-brand-primary);
          box-shadow: 0 2px 8px rgba(217, 108, 0, 0.2);
        }

        .btn-action--edit {
          background: var(--color-brand-lightest);
          color: var(--color-brand-deep);
          border-color: var(--color-brand-soft);
        }

        .btn-action--edit:hover {
          background: var(--color-brand-primary);
          color: #ffffff;
          border-color: var(--color-brand-primary);
          box-shadow: 0 2px 8px rgba(217, 108, 0, 0.2);
        }

        @media (max-width: 640px) {
          .card {
            padding: 1rem;
            border-radius: var(--radius-md);
          }

          .prof-card {
            padding: 1rem;
            gap: 0.75rem;
          }

          .list-header {
            flex-direction: column;
            align-items: stretch;
            gap: 0.75rem;
          }

          .list-header .btn {
            width: 100%;
            justify-content: center;
            min-height: 44px;
          }

          .schedule-badges {
            gap: 0.25rem;
          }

          .badge-schedule-active,
          .badge-schedule-inactive {
            padding: 0.35rem 0.1rem;
          }

          .prof-card-actions {
            flex-direction: column;
            align-items: stretch;
            gap: 0.65rem;
          }

          .login-status {
            display: flex;
            width: 100%;
          }

          .status-badge {
            width: 100%;
            justify-content: center;
            min-height: 28px;
          }

          .action-buttons {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0.5rem;
            width: 100%;
          }

          .btn-action {
            min-height: 44px;
            font-size: var(--font-size-xs);
            padding: 0.5rem 0.4rem;
            width: 100%;
          }
        }

        @media (max-width: 380px) {
          .action-buttons {
            grid-template-columns: 1fr;
          }
        }

        /* MODAL STYLES */
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(20, 17, 15, 0.5);
          backdrop-filter: blur(8px);
          display: grid;
          place-items: center;
          z-index: 1000;
          padding: 1rem;
        }

        .modal-content {
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          width: 100%;
          overflow: hidden;
          box-shadow: var(--shadow-xl);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--color-border);
          background: var(--color-bg-secondary);
        }

        .modal-eyebrow {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          font-weight: 800;
          color: var(--color-brand-deep);
          display: block;
          margin-bottom: 0.2rem;
        }

        .modal-title {
          font-size: var(--font-size-base);
          font-weight: 800;
          color: var(--color-text-primary);
          margin: 0;
          letter-spacing: -0.01em;
        }

        .btn-close-modal {
          background: transparent;
          border: none;
          color: var(--color-text-secondary);
          cursor: pointer;
          padding: 0.35rem;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s ease, background-color 0.2s ease;
        }

        .btn-close-modal:hover {
          color: var(--color-text-primary);
          background: var(--color-bg-primary);
        }

        .modal-body {
          padding: 1.25rem 1.5rem;
        }

        .modal-desc {
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
          margin-bottom: 1rem;
          line-height: 1.5;
        }

        .modal-services-toolbar {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1rem;
          flex-wrap: wrap;
        }

        .btn--outline {
          border: 1px solid var(--color-border);
          background: var(--color-bg-secondary);
          color: var(--color-text-primary);
          border-radius: var(--radius-md);
        }

        .btn--outline:hover {
          border-color: var(--color-brand-primary);
          color: var(--color-brand-primary);
          background: var(--color-bg-primary);
        }

        .btn--xs {
          padding: 0.35rem 0.75rem;
          font-size: 11px;
          font-weight: 700;
        }

        .services-association-table-wrap {
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
          max-height: 380px;
          overflow-y: auto;
          overflow-x: auto;
          background: var(--color-bg-secondary);
        }

        .services-association-table {
          width: 100%;
          border-collapse: collapse;
          font-size: var(--font-size-sm);
        }

        .services-association-table th {
          background: var(--color-bg-primary);
          padding: 0.75rem 1rem;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 700;
          color: var(--color-text-secondary);
          border-bottom: 1px solid var(--color-border);
          text-align: left;
          position: sticky;
          top: 0;
          z-index: 1;
        }

        .services-association-table td {
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--color-border);
        }

        .services-association-table input[type="checkbox"] {
          width: 18px;
          height: 18px;
          accent-color: var(--color-brand-primary);
          cursor: pointer;
        }

        .row-service-disabled {
          opacity: 0.5;
          background: var(--color-bg-primary);
        }

        .service-info-cell {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .text-muted {
          color: var(--color-text-secondary);
        }

        .text-xs {
          font-size: var(--font-size-xs);
        }

        .input-suffix-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-suffix-wrapper input {
          padding-right: 2rem !important;
          min-height: 36px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          font-size: var(--font-size-xs);
          font-variant-numeric: tabular-nums;
          background: var(--color-bg-secondary);
          color: var(--color-text-primary);
          width: 100%;
          text-align: center;
        }

        .input-suffix-wrapper input:focus {
          border-color: var(--color-brand-primary);
          outline: none;
          box-shadow: 0 0 0 2px rgba(217, 108, 0, 0.15);
        }

        .input-suffix {
          position: absolute;
          right: 0.6rem;
          font-size: 11px;
          color: var(--color-text-secondary);
          pointer-events: none;
          font-weight: 600;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          padding-top: 1.25rem;
          margin-top: 1rem;
          border-top: 1px solid var(--color-border);
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2.5rem 1.5rem;
          text-align: center;
          color: var(--color-text-secondary);
          gap: 0.5rem;
        }

        .empty-state-icon {
          color: var(--color-brand-soft);
          margin-bottom: 0.25rem;
        }

        .empty-state p {
          font-weight: 700;
          color: var(--color-text-primary);
          margin: 0;
        }

        .empty-desc {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          max-width: 34ch;
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem 1rem;
          gap: 0.75rem;
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
        }
      `}</style>
    </div>
  );
};
