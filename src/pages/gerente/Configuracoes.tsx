import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { TenantContextType } from '../../components/GerenteLayout';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

interface DaySchedule {
  active: boolean;
  open: string;
  close: string;
}

interface BusinessHours {
  [key: string]: DaySchedule;
}

const defaultBusinessHours: BusinessHours = {
  segunda: { active: true, open: '09:00', close: '18:00' },
  terca: { active: true, open: '09:00', close: '18:00' },
  quarta: { active: true, open: '09:00', close: '18:00' },
  quinta: { active: true, open: '09:00', close: '18:00' },
  sexta: { active: true, open: '09:00', close: '18:00' },
  sabado: { active: true, open: '09:00', close: '15:00' },
  domingo: { active: false, open: '09:00', close: '12:00' },
};

const daysOfWeek = [
  { key: 'segunda', label: 'Segunda-feira' },
  { key: 'terca', label: 'Terça-feira' },
  { key: 'quarta', label: 'Quarta-feira' },
  { key: 'quinta', label: 'Quinta-feira' },
  { key: 'sexta', label: 'Sexta-feira' },
  { key: 'sabado', label: 'Sábado' },
  { key: 'domingo', label: 'Domingo' },
];

export const Configuracoes: React.FC = () => {
  const tenant = useOutletContext<TenantContextType>();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // States do formulário
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [businessHours, setBusinessHours] = useState<BusinessHours>(defaultBusinessHours);

  const fetchTenantData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenant.tenantId)
        .single();

      if (error) throw error;

      if (data) {
        setName(data.name || '');
        setEmail(data.email || '');
        setPhone(data.phone || '');
        setAddress(data.address || '');
        setTimezone(data.timezone || 'America/Sao_Paulo');
        setBusinessHours(data.business_hours || defaultBusinessHours);
      }
    } catch (error: any) {
      console.error('Erro ao carregar dados da barbearia:', error);
      addToast('Não foi possível carregar as configurações.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenantData();
  }, [tenant.tenantId]);

  useGSAP(() => {
    if (!loading) {
      gsap.fromTo('.card-config', 
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, ease: 'cubic-bezier(0.32, 0.72, 0, 1)' }
      );
    }
  }, [loading]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast('O nome da barbearia é obrigatório.', 'error');
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from('tenants')
        .update({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          address: address.trim(),
          timezone: timezone,
          business_hours: businessHours
        })
        .eq('id', tenant.tenantId);

      if (error) throw error;
      addToast('Configurações atualizadas com sucesso.', 'success');
    } catch (error: any) {
      console.error('Erro ao atualizar configurações:', error);
      addToast(error.message || 'Erro ao salvar alterações.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const digits = rawValue.replace(/\D/g, '');
    
    let formatted = '';
    if (digits.length <= 2) {
      formatted = digits;
    } else if (digits.length <= 6) {
      formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    } else if (digits.length <= 10) {
      formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    } else {
      formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
    }
    setPhone(formatted);
  };

  const handleDayActiveChange = (dayKey: string, active: boolean) => {
    setBusinessHours(prev => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        active
      }
    }));
  };

  const handleTimeChange = (dayKey: string, field: 'open' | 'close', value: string) => {
    setBusinessHours(prev => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        [field]: value
      }
    }));
  };

  if (loading) {
    return (
      <div className="skeleton-container" style={{ padding: '1rem 0' }}>
        <div className="skeleton" style={{ height: '40px', width: '200px', marginBottom: '1.5rem' }} />
        <div className="skeleton" style={{ height: '300px' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
          Ajustes Gerais
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', margin: '4px 0 0' }}>
          Gerencie os dados de cadastro e fuso horário de funcionamento da sua barbearia.
        </p>
      </div>

      <div className="card-config" style={{
        backgroundColor: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '2rem',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {/* Nome da Barbearia */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="name" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Nome da Barbearia
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg-primary)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 500,
                  outline: 'none',
                  transition: 'border-color 0.2s ease'
                }}
              />
            </div>

            {/* E-mail de Contato */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="email" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                E-mail de Contato
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg-primary)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 500,
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {/* Telefone */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="phone" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Telefone
              </label>
              <input
                id="phone"
                type="text"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="(00) 00000-0000"
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg-primary)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 500,
                  outline: 'none'
                }}
              />
            </div>

            {/* Fuso Horário */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="timezone" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Fuso Horário
              </label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg-primary)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 500,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="America/Sao_Paulo">Horário de Brasília (UTC-3) - America/Sao_Paulo</option>
                <option value="America/Manaus">Horário da Amazônia (UTC-4) - America/Manaus</option>
                <option value="America/Rio_Branco">Horário do Acre (UTC-5) - America/Rio_Branco</option>
                <option value="America/Noronha">Fernando de Noronha (UTC-2) - America/Noronha</option>
              </select>
            </div>
          </div>

          {/* Endereço */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="address" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Endereço
            </label>
            <input
              id="address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Rua, Número, Bairro, Cidade - Estado"
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 500,
                outline: 'none'
              }}
            />
          </div>

          {/* Horário de Funcionamento Geral */}
          <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '1.5rem' }}>
            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, marginBottom: '1rem', color: 'var(--color-text-primary)' }}>
              Horário de Funcionamento Geral
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {daysOfWeek.map(({ key, label }) => {
                const schedule = businessHours[key] || defaultBusinessHours[key];
                return (
                  <div key={key} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-border)',
                    transition: 'all 0.2s ease',
                    opacity: schedule.active ? 1 : 0.6
                  }}>
                    {/* Checkbox e Nome do Dia */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '150px' }}>
                      <input
                        id={`checkbox-${key}`}
                        type="checkbox"
                        checked={schedule.active}
                        onChange={(e) => handleDayActiveChange(key, e.target.checked)}
                        style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '4px',
                          border: '1px solid var(--color-border)',
                          cursor: 'pointer',
                          accentColor: 'var(--color-primary)'
                        }}
                      />
                      <label htmlFor={`checkbox-${key}`} style={{ 
                        fontSize: 'var(--font-size-sm)', 
                        fontWeight: 600, 
                        color: 'var(--color-text-primary)',
                        cursor: 'pointer'
                      }}>
                        {label}
                      </label>
                    </div>

                    {/* Inputs de Horário */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="time"
                        value={schedule.open}
                        disabled={!schedule.active}
                        aria-label={`Abertura ${label}`}
                        onChange={(e) => handleTimeChange(key, 'open', e.target.value)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)',
                          backgroundColor: schedule.active ? 'var(--color-bg-secondary)' : 'var(--color-bg-disabled)',
                          color: 'var(--color-text-primary)',
                          fontSize: 'var(--font-size-sm)',
                          outline: 'none',
                          cursor: schedule.active ? 'pointer' : 'not-allowed'
                        }}
                      />
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>às</span>
                      <input
                        type="time"
                        value={schedule.close}
                        disabled={!schedule.active}
                        aria-label={`Fechamento ${label}`}
                        onChange={(e) => handleTimeChange(key, 'close', e.target.value)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)',
                          backgroundColor: schedule.active ? 'var(--color-bg-secondary)' : 'var(--color-bg-disabled)',
                          color: 'var(--color-text-primary)',
                          fontSize: 'var(--font-size-sm)',
                          outline: 'none',
                          cursor: schedule.active ? 'pointer' : 'not-allowed'
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button
              type="submit"
              disabled={saving}
              className="btn btn--primary"
              style={{
                padding: '12px 28px',
                borderRadius: '9999px',
                fontWeight: 700,
                fontSize: '14px',
                boxShadow: '0 4px 12px rgba(217, 108, 0, 0.15)',
                cursor: 'pointer'
              }}
            >
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
          
        </form>
      </div>
    </div>
  );
};
