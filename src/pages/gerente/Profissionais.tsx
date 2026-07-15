import React, { useEffect, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import type { TenantContextType } from '../../components/GerenteLayout';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

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

export const Profissionais: React.FC = () => {
  const tenant = useOutletContext<TenantContextType>();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estados do Formulário
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [commission, setCommission] = useState('40');
  const [isActive, setIsActive] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  
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
      gsap.fromTo('.prof-card', 
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

    // Carregar escala semanal
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
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        active: !prev[day].active
      }
    }));
  };

  const handleScheduleTimeChange = (day: string, type: 'start' | 'end' | 'break_start' | 'break_end', value: string) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [type]: value
      }
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

      // Estruturar a weekly_schedule em JSONB
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
        updated_at: new Date().toISOString()
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
        const { error } = await supabase
          .from('professionals')
          .insert([profData]);

        if (error) throw error;
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

  return (
    <div className="prof-page">
      <div className="prof-header-intro">
        <span style={{
          display: 'inline-block',
          backgroundColor: 'rgba(217, 108, 0, 0.08)',
          color: 'var(--color-brand-primary)',
          fontSize: '10px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          padding: '4px 12px',
          borderRadius: '9999px',
          marginBottom: '0.5rem'
        }}>
          Gestão
        </span>
        <h2>Equipe e Escala</h2>
        <p style={{ margin: '4px 0 0' }}>Cadastre seus barbeiros, configure a comissão (%) de cada um e edite a escala de dias e horários de trabalho.</p>
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
                <label htmlFor="prof-commission">Comissão (%)</label>
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
                    <div key={day.key} className={`schedule-day-item ${daySched.active ? 'schedule-day-item--active' : ''}`}>
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
                              onChange={(e) => handleScheduleTimeChange(day.key, 'break_start', e.target.value)}
                            />
                            <span>às</span>
                            <input 
                              type="time" 
                              className="day-times-input"
                              value={daySched.break_end || '13:00'} 
                              aria-label="Fim do Almoço"
                              onChange={(e) => handleScheduleTimeChange(day.key, 'break_end', e.target.value)}
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
                {saving ? <div className="spinner spinner--sm" /> : (editingId ? 'Salvar Alterações' : 'Cadastrar Profissional')}
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
              <div className="spinner" style={{ borderColor: 'var(--color-brand-primary)', borderTopColor: 'transparent' }} />
              <p>Carregando equipe...</p>
            </div>
          ) : professionals.length === 0 ? (
            <div className="empty-state">
              <p>Nenhum profissional cadastrado.</p>
              <span className="empty-desc">Cadastre o primeiro barbeiro utilizando o formulário ao lado.</span>
            </div>
          ) : (
            <div className="prof-list-container">
              {professionals.map((prof) => (
                <div key={prof.id} className={`prof-card ${!prof.is_active ? 'prof-card--inactive' : ''}`}>
                  <div className="prof-card-header">
                    <div className="prof-card-title-group">
                      <div className="prof-avatar">
                        {prof.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4>{prof.name}</h4>
                        <span className="prof-phone">{prof.phone}</span>
                      </div>
                    </div>
                    
                    <div className="prof-commission-badge">
                      <span>Comissão: <strong>{prof.commission_percentage}%</strong></span>
                    </div>
                  </div>

                  <div className="prof-card-schedule">
                    <h5>Escala de Trabalho</h5>
                    <div className="schedule-badges">
                      {DAYS_OF_WEEK.map((day) => {
                        const dayData = prof.weekly_schedule?.[day.key] as any;
                        const labelCurto = day.label.substring(0, 3);
                        const isActive = !!dayData;
                        
                        if (isActive) {
                          const breakInfo = dayData.break_start ? ` (Almoço: ${dayData.break_start} - ${dayData.break_end})` : '';
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
                        <span className="status-badge status-badge--linked" title="Este barbeiro já tem login vinculado">
                          Login Vinculado
                        </span>
                      ) : (
                        <span className="status-badge status-badge--unlinked" title="Este barbeiro não consegue logar">
                          Sem Login
                        </span>
                      )}
                    </div>

                    <div className="action-buttons">
                      <button onClick={() => handleEdit(prof)} className="btn-action btn-action--edit">
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
          position: relative;
          background: linear-gradient(145deg, rgba(255,255,255,0.55) 0%, rgba(255,241,230,0.25) 100%);
          backdrop-filter: blur(16px) saturate(140%);
          -webkit-backdrop-filter: blur(16px) saturate(140%);
          border: 1px solid rgba(234, 222, 214, 0.35);
          border-radius: calc(var(--radius-lg) + 2px);
          padding: 1.5rem;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.5),
            inset 0 -1px 0 rgba(234, 222, 214, 0.12),
            var(--shadow-sm);
          transition: all 0.5s cubic-bezier(0.32, 0.72, 0, 1);
          overflow: hidden;
        }

        .card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: calc(var(--radius-lg) + 2px);
          padding: 1px;
          background: linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(234,222,214,0.08) 50%, rgba(255,255,255,0.15) 100%);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }

        .card h3 {
          font-size: var(--font-size-lg);
          font-weight: 800;
          margin-bottom: 1.25rem;
          border-bottom: 1px solid rgba(234, 222, 214, 0.8);
          padding-bottom: 0.5rem;
          color: var(--color-text-primary);
        }

        .list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.25rem;
          border-bottom: 1px solid rgba(234, 222, 214, 0.8);
          padding-bottom: 0.5rem;
        }

        .list-header h3 {
          margin-bottom: 0;
          border-bottom: none;
          padding-bottom: 0;
          font-weight: 800;
          color: var(--color-text-primary);
        }

        .prof-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .form-group label {
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .form-group input[type="text"],
        .form-group input[type="number"],
        .form-group select {
          padding: 0.65rem 0.875rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background-color: rgba(255, 255, 255, 0.75);
          color: var(--color-text-primary);
          font-size: var(--font-size-sm);
          outline: none;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .form-group input:focus,
        .form-group select:focus {
          border-color: var(--color-brand-primary);
          box-shadow: 0 0 0 3px rgba(217, 108, 0, 0.1);
        }

        .checkbox-group {
          flex-direction: row;
          align-items: center;
          gap: 0.5rem;
          margin: 0.5rem 0;
        }

        .checkbox-group label {
          text-transform: none;
          font-weight: 600;
          font-size: var(--font-size-sm);
        }

        .schedule-section {
          border-top: 1px solid rgba(234, 222, 214, 0.8);
          padding-top: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          min-width: 0;
        }

        .schedule-title {
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .schedule-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          min-width: 0;
        }

        .schedule-day-item {
          display: grid;
          grid-template-columns: 115px 1fr;
          align-items: start;
          gap: 0.5rem;
          padding: 0.75rem;
          background: linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.2) 100%);
          border: 1px solid rgba(234, 222, 214, 0.4);
          border-radius: var(--radius-md);
          transition: all 0.3s cubic-bezier(0.32, 0.72, 0, 1);
          min-width: 0;
        }

        .schedule-day-item > * {
          min-width: 0;
        }

        .schedule-day-item--active {
          border-color: rgba(217, 108, 0, 0.2);
          background: linear-gradient(135deg, rgba(255,255,255,0.7) 0%, rgba(255,241,230,0.4) 100%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.5);
        }

        .day-checkbox {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .day-checkbox label {
          font-size: var(--font-size-sm);
          font-weight: 600;
          cursor: pointer;
        }

        .day-checkbox input[type="checkbox"] {
          accent-color: var(--color-brand-primary);
          cursor: pointer;
        }

        .day-schedule-details {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 0.25rem 0;
        }

        .schedule-row {
          display: flex;
          align-items: center;
          gap: 0.2rem;
          min-width: 0;
        }

        .schedule-row > * {
          min-width: 0;
        }

        .schedule-row-label {
          font-size: 0.6rem;
          font-weight: 700;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.03em;
          width: 62px;
          flex-shrink: 0;
        }

        .day-times-input {
          padding: 0.2rem 0.15rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          background-color: rgba(255, 255, 255, 0.9);
          color: var(--color-text-primary);
          font-size: 0.7rem;
          outline: none;
          transition: all 0.2s ease;
          text-align: center;
          width: 68px;
          min-width: 0;
          flex-shrink: 1;
          flex-grow: 0;
          box-sizing: border-box;
          -webkit-appearance: none;
          appearance: none;
          -moz-appearance: textfield;
        }

        .day-times-input:focus {
          border-color: var(--color-brand-primary);
          box-shadow: 0 0 0 2px rgba(217, 108, 0, 0.08);
        }

        .schedule-row span {
          font-size: 0.65rem;
          color: var(--color-text-secondary);
          flex-shrink: 0;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 0.5rem;
          border-top: 1px solid rgba(234, 222, 214, 0.8);
          padding-top: 1rem;
        }

        .loading-state,
        .empty-state {
          padding: 4rem 1.5rem;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          color: var(--color-text-secondary);
          border: 1.5px dashed rgba(234, 222, 214, 0.8);
          border-radius: var(--radius-lg);
          background-color: rgba(255, 255, 255, 0.25);
        }

        .empty-desc {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
        }

        .prof-card {
          position: relative;
          background: linear-gradient(145deg, rgba(255,255,255,0.55) 0%, rgba(255,241,230,0.25) 100%);
          backdrop-filter: blur(16px) saturate(140%);
          -webkit-backdrop-filter: blur(16px) saturate(140%);
          border: 1px solid rgba(234, 222, 214, 0.35);
          border-radius: calc(var(--radius-lg) + 2px);
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.875rem;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.5),
            inset 0 -1px 0 rgba(234, 222, 214, 0.12),
            var(--shadow-sm);
          transition: all 0.5s cubic-bezier(0.32, 0.72, 0, 1);
          min-height: 0;
        }

        .prof-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: calc(var(--radius-lg) + 2px);
          padding: 1px;
          background: linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(234,222,214,0.08) 50%, rgba(255,255,255,0.15) 100%);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }

        .prof-list-container {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
          gap: 1.25rem;
          align-items: stretch;
        }

        .prof-card:hover {
          transform: translateY(-3px);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.5),
            inset 0 -1px 0 rgba(234, 222, 214, 0.12),
            0 8px 28px rgba(45, 35, 30, 0.1),
            0 2px 8px rgba(217, 108, 0, 0.06);
          border-color: rgba(217, 108, 0, 0.25);
        }

        .prof-card--inactive {
          opacity: 0.6;
          border-style: dashed;
        }

        .prof-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
        }

        .prof-card-title-group {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .prof-avatar {
          width: 44px;
          height: 44px;
          border-radius: var(--radius-full);
          background-color: var(--color-brand-soft);
          color: var(--color-brand-deep);
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.125rem;
          border: 1.5px solid rgba(255, 255, 255, 0.6);
          box-shadow: var(--shadow-sm);
        }

        .prof-card-title-group h4 {
          font-size: var(--font-size-base);
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .prof-phone {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
        }

        .prof-commission-badge {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          background: linear-gradient(135deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.4) 100%);
          padding: 0.25rem 0.75rem;
          border-radius: var(--radius-full);
          border: 1px solid rgba(234, 222, 214, 0.5);
          font-weight: 600;
          white-space: nowrap;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.6);
        }

        .prof-commission-badge strong {
          color: var(--color-brand-primary);
          font-weight: 800;
        }

        .prof-card-schedule {
          display: flex;
          flex-direction: column;
          flex: 1;
        }

        .prof-card-schedule h5 {
          font-size: 0.7rem;
          font-weight: 800;
          text-transform: uppercase;
          color: var(--color-text-secondary);
          letter-spacing: 0.05em;
          margin-bottom: 0.5rem;
        }

        .schedule-badges {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 0.35rem;
          width: 100%;
          min-width: 0;
        }

        .badge-schedule-active {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.125rem;
          background: linear-gradient(135deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.4) 100%);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 0.3rem 0.2rem;
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--color-text-primary);
          white-space: nowrap;
          min-width: 0;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.6);
        }

        .badge-schedule-inactive {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.125rem;
          background: transparent;
          border: 1px dashed rgba(234, 222, 214, 0.5);
          border-radius: var(--radius-md);
          padding: 0.3rem 0.2rem;
          font-size: 0.65rem;
          font-weight: 600;
          color: var(--color-text-secondary);
          opacity: 0.4;
          white-space: nowrap;
          min-width: 0;
        }

        .badge-schedule-hours {
          font-weight: 700;
          font-size: 0.7rem;
          color: var(--color-brand-primary);
          line-height: 1.1;
        }

        .badge-schedule-inactive .badge-schedule-hours {
          color: var(--color-text-secondary);
          font-weight: 500;
        }

        .badge-day-name {
          font-size: 0.65rem;
          line-height: 1.1;
        }

        .no-schedule-text {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
          font-style: italic;
        }

        .prof-card-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid rgba(234, 222, 214, 0.6);
          padding-top: 0.75rem;
        }

        .status-badge {
          font-size: 0.7rem;
          padding: 0.2rem 0.6rem;
          border-radius: var(--radius-full);
          font-weight: 700;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.5);
        }

        .status-badge--linked {
          background: linear-gradient(135deg, rgba(230, 244, 234, 0.6) 0%, rgba(230, 244, 234, 0.3) 100%);
          color: var(--color-success);
          border: 1px solid rgba(14, 159, 110, 0.2);
        }

        .status-badge--unlinked {
          background: linear-gradient(135deg, rgba(254, 243, 199, 0.6) 0%, rgba(254, 243, 199, 0.3) 100%);
          color: var(--color-warning);
          border: 1px solid rgba(217, 120, 6, 0.2);
        }

        .btn-action {
          background: none;
          border: 1px solid transparent;
          font-size: 0.75rem;
          font-weight: 700;
          cursor: pointer;
          padding: 0.3rem 0.6rem;
          border-radius: var(--radius-md);
          transition: all 0.4s cubic-bezier(0.32, 0.72, 0, 1);
        }

        .btn-action--edit {
          color: var(--color-brand-primary);
          background: linear-gradient(135deg, rgba(217, 108, 0, 0.08) 0%, rgba(217, 108, 0, 0.04) 100%);
          border: 1px solid rgba(217, 108, 0, 0.12);
        }

        .btn-action--edit:hover {
          background: var(--color-brand-primary);
          color: white;
          border-color: var(--color-brand-primary);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(217, 108, 0, 0.2);
        }

        .btn-action:active {
          transform: scale(0.97);
        }
      `}</style>
    </div>
  );
};
