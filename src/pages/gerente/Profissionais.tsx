import React, { useEffect, useState, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import type { TenantContextType } from '../../components/GerenteLayout';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { SupabaseProfessionalServicesAdapter } from '../../modules/profissionais/servicesAdapter';
import type { ProfessionalServiceItem } from '../../modules/profissionais/types';

interface Professional {
  id: string;
  name: string;
  phone: string;
  commission_percentage: number;
  weekly_schedule: Record<string, { start: string; end: string } | null> | null;
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

import { HugeiconsIcon } from '@hugeicons/react';
import {
  Cancel01Icon,
  ScissorIcon as HugeScissorIcon,
} from '@hugeicons/core-free-icons';

const CloseIcon = () => <HugeiconsIcon icon={Cancel01Icon} size={20} />;
const ScissorIcon = () => <HugeiconsIcon icon={HugeScissorIcon} size={16} />;


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

  useGSAP(() => {
    if (!loading && professionals.length > 0) {
      gsap.fromTo(
        '.prof-card',
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out' }
      );
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
        const dayData = prof.weekly_schedule?.[day] as any;
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
      <div className="prof-header-intro">
        <span
          style={{
            display: 'inline-block',
            backgroundColor: 'rgba(217, 108, 0, 0.08)',
            color: 'var(--color-brand-primary)',
            fontSize: '10px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            padding: '4px 12px',
            borderRadius: '9999px',
            marginBottom: '0.5rem',
          }}
        >
          Gestão
        </span>
        <h2>Equipe e Escala</h2>
        <p style={{ margin: '4px 0 0' }}>
          Cadastre seus barbeiros, configure a comissão (%) de cada um, vincule serviços com duração individual e edite a escala de trabalho.
        </p>
      </div>

      <div className="prof-grid">
        {/* Painel do Formulário */}
        <section className="form-section card">
          <h3>{editingId ? 'Editar Profissional' : 'Novo Profissional'}</h3>

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
              <span className="schedule-title">Escala Semanal de Trabalho</span>
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
                            <span className="schedule-row-label">Trabalho:</span>
                            <input
                              type="time"
                              className="day-times-input"
                              value={daySched.start}
                              onChange={(e) => handleScheduleTimeChange(day.key, 'start', e.target.value)}
                            />
                            <span>às</span>
                            <input
                              type="time"
                              className="day-times-input"
                              value={daySched.end}
                              onChange={(e) => handleScheduleTimeChange(day.key, 'end', e.target.value)}
                            />
                          </div>

                          {/* Intervalo de Almoço */}
                          <div className="schedule-row">
                            <span className="schedule-row-label">Almoço:</span>
                            <input
                              type="time"
                              className="day-times-input"
                              value={daySched.break_start || '12:00'}
                              aria-label="Início do Almoço"
                              onChange={(e) =>
                                handleScheduleTimeChange(day.key, 'break_start', e.target.value)
                              }
                            />
                            <span>às</span>
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
                <label htmlFor="prof-active">Profissional Ativo (Exibir na agenda de clientes)</label>
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
        <section className="list-section card">
          <div className="list-header">
            <h3>Membros da Equipe</h3>
            <button
              onClick={() => navigate('/profissionais/cadastro-acesso')}
              className="btn btn--primary btn--sm"
              style={{ borderRadius: 'var(--radius-md)', padding: '0.4rem 0.8rem' }}
            >
              Criar Acesso / Login
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
              <p>Nenhum profissional cadastrado.</p>
              <span className="empty-desc">
                Cadastre o primeiro barbeiro utilizando o formulário ao lado.
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
                      <div className="prof-avatar">{prof.name.charAt(0).toUpperCase()}</div>
                      <div>
                        <h4>{prof.name}</h4>
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
                    <h5>Escala de Trabalho</h5>
                    <div className="schedule-badges">
                      {DAYS_OF_WEEK.map((day) => {
                        const dayData = prof.weekly_schedule?.[day.key] as any;
                        const labelCurto = day.label.substring(0, 3);
                        const isDayActive = !!dayData;

                        if (isDayActive) {
                          const breakInfo = dayData.break_start
                            ? ` (Almoço: ${dayData.break_start} - ${dayData.break_end})`
                            : '';
                          return (
                            <div
                              key={day.key}
                              className="badge-schedule-active"
                              title={`${day.label}: ${dayData.start} - ${dayData.end}${breakInfo}`}
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
                              <span className="badge-schedule-hours">—</span>
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
                          title="Este barbeiro já tem login vinculado"
                        >
                          Login Vinculado
                        </span>
                      ) : (
                        <span
                          className="status-badge status-badge--unlinked"
                          title="Este barbeiro não consegue logar"
                        >
                          Sem Login
                        </span>
                      )}
                    </div>

                    <div className="action-buttons">
                      <button
                        onClick={() => handleOpenServicesModal(prof)}
                        className="btn-action btn-action--services"
                        title="Configurar serviços e tempos específicos deste barbeiro"
                      >
                        <ScissorIcon /> Serviços e Tempos
                      </button>
                      <button
                        onClick={() => handleEdit(prof)}
                        className="btn-action btn-action--edit"
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

      {/* MODAL DE ASSOCIAÇÃO DE SERVIÇOS E DURAÇÃO INDIVIDUAL (DOUBLE-BEZEL) */}
      {isServicesModalOpen && selectedProfForServices && (
        <div className="modal-backdrop">
          <div className="modal-content shadow-xl animate-spring" style={{ maxWidth: '680px' }}>
            <header className="modal-header">
              <div>
                <span className="modal-eyebrow">Autonomia de Duração</span>
                <h3 className="modal-title">
                  Serviços Atendidos por {selectedProfForServices.name}
                </h3>
              </div>
              <button onClick={() => setIsServicesModalOpen(false)} className="btn-close-modal">
                <CloseIcon />
              </button>
            </header>

            <div className="modal-body">
              <p className="modal-desc">
                Defina quais serviços este profissional realiza na barbearia e a duração individual
                (tempo de corte/atendimento). O padrão é de <strong>40 minutos</strong>.
              </p>

              <div className="modal-services-toolbar">
                <button
                  type="button"
                  onClick={handleEnableAllServices}
                  className="btn btn--outline btn--xs"
                >
                  Habilitar Todos (40 min padrão)
                </button>
                <button
                  type="button"
                  onClick={handleDisableAllServices}
                  className="btn btn--outline-secondary btn--xs"
                >
                  Desabilitar Todos
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
                        <th style={{ width: '40px' }}>Atende?</th>
                        <th>Serviço</th>
                        <th style={{ width: '130px' }}>Duração (min)</th>
                        <th style={{ width: '130px' }}>Comissão (%)</th>
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
                    'Salvar Configurações'
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

        .prof-header-intro h2 {
          font-size: var(--font-size-xl);
          font-weight: 800;
          color: var(--color-text-primary);
          letter-spacing: -0.02em;
        }

        .prof-header-intro p {
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
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
          background: rgba(255, 255, 255, 0.65);
          backdrop-filter: blur(12px);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 1.5rem;
          box-shadow: var(--shadow-sm);
        }

        .form-section h3, .list-header h3 {
          font-size: var(--font-size-lg);
          font-weight: 800;
          color: var(--color-text-primary);
          margin-bottom: 1.25rem;
        }

        .list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
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
          letter-spacing: 0.05em;
          color: var(--color-text-secondary);
        }

        .form-group input, .form-group select {
          padding: 0.65rem 0.85rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background-color: var(--color-bg-secondary);
          color: var(--color-text-primary);
          font-size: var(--font-size-sm);
          outline: none;
          transition: all 0.2s ease;
        }

        .form-group input:focus, .form-group select:focus {
          border-color: var(--color-brand-primary);
          box-shadow: 0 0 0 3px rgba(217, 108, 0, 0.15);
        }

        .schedule-section {
          background: rgba(234, 222, 214, 0.2);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .schedule-title {
          font-size: var(--font-size-xs);
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--color-brand-primary);
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
          padding: 0.6rem 0.85rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          transition: all 0.2s ease;
        }

        .schedule-day-item--active {
          border-color: rgba(217, 108, 0, 0.3);
          background: #ffffff;
        }

        .day-checkbox {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .day-checkbox label {
          font-size: var(--font-size-sm);
          font-weight: 700;
          cursor: pointer;
        }

        .day-schedule-details {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          padding-top: 0.35rem;
          border-top: 1px dashed var(--color-border);
        }

        .schedule-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
        }

        .schedule-row-label {
          min-width: 55px;
          font-weight: 600;
        }

        .day-times-input {
          padding: 0.2rem 0.4rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          font-size: var(--font-size-xs);
          background: var(--color-bg-secondary);
        }

        .checkbox-group {
          flex-direction: row;
          align-items: center;
          gap: 0.5rem;
        }

        .form-actions {
          display: flex;
          gap: 0.75rem;
          margin-top: 0.5rem;
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
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .prof-card:hover {
          border-color: rgba(217, 108, 0, 0.4);
          box-shadow: var(--shadow-md);
        }

        .prof-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .prof-card-title-group {
          display: flex;
          align-items: center;
          gap: 0.85rem;
        }

        .prof-avatar {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, var(--color-brand-primary) 0%, #b85d00 100%);
          color: #ffffff;
          font-weight: 800;
          font-size: 1.15rem;
          display: grid;
          place-items: center;
        }

        .prof-card-title-group h4 {
          font-size: var(--font-size-base);
          font-weight: 800;
          color: var(--color-text-primary);
          margin: 0;
        }

        .prof-phone {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          font-family: monospace;
        }

        .prof-commission-badge {
          font-size: var(--font-size-xs);
          background: rgba(217, 108, 0, 0.1);
          color: var(--color-brand-primary);
          padding: 0.35rem 0.75rem;
          border-radius: var(--radius-full);
          font-weight: 600;
        }

        .prof-card-schedule h5 {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-secondary);
          margin-bottom: 0.5rem;
          font-weight: 700;
        }

        .schedule-badges {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 0.35rem;
        }

        .badge-schedule-active {
          background: rgba(217, 108, 0, 0.12);
          border: 1px solid rgba(217, 108, 0, 0.25);
          border-radius: var(--radius-sm);
          padding: 0.35rem 0.2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.15rem;
        }

        .badge-schedule-inactive {
          background: rgba(0, 0, 0, 0.03);
          border: 1px dashed var(--color-border);
          border-radius: var(--radius-sm);
          padding: 0.35rem 0.2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          opacity: 0.4;
        }

        .badge-day-name {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .badge-schedule-hours {
          font-size: 10px;
          font-weight: 800;
          color: var(--color-brand-primary);
        }

        .prof-card-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid var(--color-border);
          padding-top: 0.75rem;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .action-buttons {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .btn-action {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 12px;
          font-weight: 700;
          padding: 0.35rem 0.75rem;
          border-radius: var(--radius-md);
          cursor: pointer;
          border: 1px solid transparent;
          transition: all 0.2s ease;
        }

        .btn-action--services {
          background: rgba(45, 35, 30, 0.06);
          color: var(--color-text-primary);
          border-color: var(--color-border);
        }

        .btn-action--services:hover {
          background: var(--color-brand-primary);
          color: #ffffff;
          border-color: var(--color-brand-primary);
        }

        .btn-action--edit {
          background: rgba(217, 108, 0, 0.08);
          color: var(--color-brand-primary);
          border-color: rgba(217, 108, 0, 0.2);
        }

        .btn-action--edit:hover {
          background: var(--color-brand-primary);
          color: #ffffff;
        }

        /* MODAL STYLES */
        .modal-eyebrow {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          font-weight: 800;
          color: var(--color-brand-primary);
        }

        .modal-desc {
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
          margin-bottom: 1rem;
        }

        .modal-services-toolbar {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .services-association-table-wrap {
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
          max-height: 380px;
          overflow-y: auto;
        }

        .services-association-table {
          width: 100%;
          border-collapse: collapse;
          font-size: var(--font-size-sm);
        }

        .services-association-table th {
          background: var(--color-bg-secondary);
          padding: 0.75rem 1rem;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 700;
          color: var(--color-text-secondary);
          border-bottom: 1px solid var(--color-border);
          text-align: left;
        }

        .services-association-table td {
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--color-border);
        }

        .row-service-disabled {
          opacity: 0.45;
          background: rgba(0, 0, 0, 0.02);
        }

        .service-info-cell {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .input-suffix-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-suffix-wrapper input {
          padding-right: 2rem !important;
        }

        .input-suffix {
          position: absolute;
          right: 0.6rem;
          font-size: 11px;
          color: var(--color-text-secondary);
          pointer-events: none;
        }
      `}</style>
    </div>
  );
};
