import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { TenantContextType } from '../../components/GerenteLayout';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Store01Icon,
  Calendar03Icon,
  Clock01Icon,
  Location01Icon,
  CheckmarkCircle02Icon,
} from '@hugeicons/core-free-icons';

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

const STANDARD_HOURS = [
  '00:00', '00:30', '01:00', '01:30', '02:00', '02:30', '03:00', '03:30',
  '04:00', '04:30', '05:00', '05:30', '06:00', '06:30', '07:00', '07:30',
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
  '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00', '23:30'
];

const SLOT_INTERVAL_PRESETS = [
  { label: '15 min', value: 15 },
  { label: '20 min', value: 20 },
  { label: '30 min', value: 30 },
  { label: '40 min', value: 40 },
  { label: '45 min', value: 45 },
  { label: '60 min', value: 60 },
];

const BOOKING_LEAD_TIME_PRESETS = [
  { label: 'Sem antecedência', value: 0 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '1 hora', value: 60 },
  { label: '2 horas', value: 120 },
];

const CANCELLATION_LEAD_TIME_PRESETS = [
  { label: 'Livre até a hora', value: 0 },
  { label: '30 min', value: 30 },
  { label: '1 hora', value: 60 },
  { label: '2 horas', value: 120 },
  { label: '4 horas', value: 240 },
  { label: '24 horas', value: 1440 },
];

export const Configuracoes: React.FC = () => {
  const tenant = useOutletContext<TenantContextType>();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // States do Card 1: Perfil e Endereço
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [cep, setCep] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressNeighborhood, setAddressNeighborhood] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressState, setAddressState] = useState('');
  const [loadingCep, setLoadingCep] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [timezone, setTimezone] = useState('America/Sao_Paulo');

  // States do Card 2: Regras de Agendamento
  const [slotIntervalMinutes, setSlotIntervalMinutes] = useState<number>(30);
  const [minBookingLeadTimeMinutes, setMinBookingLeadTimeMinutes] = useState<number>(15);
  const [minCancellationLeadTimeMinutes, setMinCancellationLeadTimeMinutes] = useState<number>(120);

  // States do Card 3: Horário de Funcionamento
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
        setCep(data.cep || '');
        setAddressStreet(data.address_street || '');
        setAddressNumber(data.address_number || '');
        setAddressNeighborhood(data.address_neighborhood || '');
        setAddressCity(data.address_city || '');
        setAddressState(data.address_state || '');
        setTimezone(data.timezone || 'America/Sao_Paulo');
        setSlotIntervalMinutes(data.slot_interval_minutes ?? 30);
        setMinBookingLeadTimeMinutes(data.min_booking_lead_time_minutes ?? 15);
        setMinCancellationLeadTimeMinutes(data.min_cancellation_lead_time_minutes ?? 120);
        setBusinessHours(data.business_hours || defaultBusinessHours);
      }
    } catch (error: unknown) {
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
      const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      if (prefersReducedMotion) {
        gsap.set('.card-config', { opacity: 1, y: 0 });
      } else {
        gsap.fromTo('.card-config', 
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.45, stagger: 0.1, ease: 'power2.out' }
        );
      }
    }
  }, [loading]);

  const formatCep = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    if (digits.length > 5) {
      return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    }
    return digits;
  };

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCep(e.target.value);
    setCep(formatted);
    setCepError(null);

    const cleanCep = formatted.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      setLoadingCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const viaCepData = await res.json();

        if (viaCepData.erro) {
          setCepError('CEP não localizado. Você pode preencher os campos manualmente.');
          return;
        }

        const street = viaCepData.logradouro || '';
        const neighborhood = viaCepData.bairro || '';
        const city = viaCepData.localidade || '';
        const state = viaCepData.uf || '';

        setAddressStreet(street);
        setAddressNeighborhood(neighborhood);
        setAddressCity(city);
        setAddressState(state);

        const fullAddr = [street, neighborhood, `${city}, ${state}`].filter(Boolean).join(', ');
        if (fullAddr) setAddress(fullAddr);
      } catch {
        setCepError('Não foi possível consultar o CEP no momento.');
      } finally {
        setLoadingCep(false);
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast('O nome da barbearia é obrigatório.', 'error');
      return;
    }

    const fullAddress = address.trim() || [
      addressStreet.trim(),
      addressNumber.trim(),
      addressNeighborhood.trim(),
      addressCity.trim(),
      addressState.trim()
    ].filter(Boolean).join(', ');

    try {
      setSaving(true);
      const { error } = await supabase
        .from('tenants')
        .update({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          address: fullAddress,
          cep: cep.trim(),
          address_street: addressStreet.trim(),
          address_number: addressNumber.trim(),
          address_neighborhood: addressNeighborhood.trim(),
          address_city: addressCity.trim(),
          address_state: addressState.trim(),
          timezone: timezone,
          slot_interval_minutes: Number(slotIntervalMinutes) || 30,
          min_booking_lead_time_minutes: Number(minBookingLeadTimeMinutes) || 0,
          min_cancellation_lead_time_minutes: Number(minCancellationLeadTimeMinutes) || 0,
          business_hours: businessHours
        })
        .eq('id', tenant.tenantId);

      if (error) throw error;
      await tenant.refreshTenant?.();
      addToast('Configurações atualizadas com sucesso.', 'success');
    } catch (error: unknown) {
      console.error('Erro ao atualizar configurações:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      addToast(errorMessage || 'Erro ao salvar alterações.', 'error');
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
      <div className="skeleton-container" style={{ padding: '1rem 0', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="skeleton" style={{ height: '48px', width: '260px', borderRadius: '12px' }} />
        <div className="skeleton" style={{ height: '320px', borderRadius: '16px' }} />
        <div className="skeleton" style={{ height: '240px', borderRadius: '16px' }} />
        <div className="skeleton" style={{ height: '400px', borderRadius: '16px' }} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="config-form">
      {/* Cabeçalho */}
      <div className="config-header">
        <div className="config-header-text">
          <h2>Ajustes da barbearia</h2>
          <p>
            Personalize os dados da sua barbearia, defina os horários de atendimento da equipe e controle as regras de agendamento online com total autonomia.
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="btn btn--primary btn-save-config"
        >
          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} strokeWidth={2} />
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>

      {/* CARD 1: Perfil e Localização */}
      <div className="card card-config">
        <div className="config-section-header">
          <div className="config-icon-badge">
            <HugeiconsIcon icon={Store01Icon} size={22} strokeWidth={2} />
          </div>
          <div>
            <h3>Perfil e localização</h3>
            <p>Dados cadastrais, canais de contato com o cliente e localização do estabelecimento.</p>
          </div>
        </div>

        <div className="config-fields-grid">
          {/* Nome da Barbearia */}
          <div className="form-group">
            <label htmlFor="name">Nome da barbearia</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Barbearia Navalha de Ouro"
              className="config-input"
            />
          </div>

          {/* E-mail de Contato */}
          <div className="form-group">
            <label htmlFor="email">E-mail de contato</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contato@barbearia.com"
              className="config-input"
            />
          </div>

          {/* Telefone */}
          <div className="form-group">
            <label htmlFor="phone">Telefone</label>
            <input
              id="phone"
              type="text"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="(00) 00000-0000"
              className="config-input"
            />
          </div>

          {/* Fuso Horário */}
          <div className="form-group">
            <label htmlFor="timezone">Fuso horário</label>
            <select
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="config-select"
            >
              <option value="America/Sao_Paulo">Horário de Brasília (UTC-3)</option>
              <option value="America/Manaus">Horário da Amazônia (UTC-4)</option>
              <option value="America/Rio_Branco">Horário do Acre (UTC-5)</option>
              <option value="America/Noronha">Fernando de Noronha (UTC-2)</option>
            </select>
          </div>
        </div>

        {/* Endereço Estruturado com CEP */}
        <div className="address-section">
          <div className="address-section-title">
            <HugeiconsIcon icon={Location01Icon} size={16} color="var(--color-brand-primary)" />
            <span>Endereço do estabelecimento</span>
          </div>

          <div className="address-row-grid">
            {/* CEP */}
            <div className="form-group cep-field">
              <label htmlFor="cep">
                CEP {loadingCep && <span className="cep-loading">(Buscando...)</span>}
              </label>
              <input
                id="cep"
                type="text"
                value={cep}
                onChange={handleCepChange}
                placeholder="00000-000"
                maxLength={9}
                className="config-input"
              />
            </div>

            {/* Logradouro / Rua */}
            <div className="form-group street-field">
              <label htmlFor="address_street">Rua ou avenida</label>
              <input
                id="address_street"
                type="text"
                value={addressStreet}
                onChange={(e) => setAddressStreet(e.target.value)}
                placeholder="Ex: Rua das Flores"
                className="config-input"
              />
            </div>

            {/* Número */}
            <div className="form-group number-field">
              <label htmlFor="address_number">Número</label>
              <input
                id="address_number"
                type="text"
                value={addressNumber}
                onChange={(e) => setAddressNumber(e.target.value)}
                placeholder="Ex: 123"
                className="config-input"
              />
            </div>
          </div>

          <div className="address-sub-grid">
            {/* Bairro */}
            <div className="form-group">
              <label htmlFor="address_neighborhood">Bairro</label>
              <input
                id="address_neighborhood"
                type="text"
                value={addressNeighborhood}
                onChange={(e) => setAddressNeighborhood(e.target.value)}
                placeholder="Ex: Centro"
                className="config-input"
              />
            </div>

            {/* Cidade */}
            <div className="form-group">
              <label htmlFor="address_city">Cidade</label>
              <input
                id="address_city"
                type="text"
                value={addressCity}
                onChange={(e) => setAddressCity(e.target.value)}
                placeholder="Ex: São Paulo"
                className="config-input"
              />
            </div>

            {/* UF */}
            <div className="form-group uf-field">
              <label htmlFor="address_state">UF</label>
              <input
                id="address_state"
                type="text"
                value={addressState}
                maxLength={2}
                onChange={(e) => setAddressState(e.target.value.toUpperCase())}
                placeholder="SP"
                className="config-input uf-input"
              />
            </div>
          </div>

          {cepError && (
            <span className="cep-error">{cepError}</span>
          )}

          {/* Campo de Endereço Completo (legado/resumo) */}
          <div className="form-group">
            <label htmlFor="address">Endereço completo ou ponto de referência</label>
            <input
              id="address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Rua, Número, Bairro, Cidade, Estado"
              className="config-input"
            />
          </div>
        </div>
      </div>

      {/* CARD 2: Regras de Agendamento Online */}
      <div className="card card-config">
        <div className="config-section-header">
          <div className="config-icon-badge">
            <HugeiconsIcon icon={Clock01Icon} size={22} strokeWidth={2} />
          </div>
          <div>
            <h3>Regras de agendamento online</h3>
            <p>Defina o ritmo dos atendimentos e proteja a rotina dos seus profissionais contra agendamentos ou cancelamentos de última hora.</p>
          </div>
        </div>

        {/* 2.1 Intervalo entre Horários */}
        <div className="lead-rule-block">
          <div className="lead-rule-header">
            <div>
              <label htmlFor="slot_interval_minutes" className="lead-rule-title">
                Intervalo entre horários na grade
              </label>
              <p className="lead-rule-desc">
                Frequência de novos horários gerados para os clientes reservarem online.
              </p>
            </div>
            <div className="lead-input-group">
              <input
                id="slot_interval_minutes"
                type="number"
                min={5}
                max={240}
                value={slotIntervalMinutes}
                onChange={(e) => setSlotIntervalMinutes(Number(e.target.value))}
                className="lead-number-input"
              />
              <span className="lead-input-unit">minutos</span>
            </div>
          </div>

          {/* Chips de Intervalo */}
          <div className="lead-chips-grid">
            {SLOT_INTERVAL_PRESETS.map((preset) => {
              const isSelected = slotIntervalMinutes === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setSlotIntervalMinutes(preset.value)}
                  className={`lead-chip-btn ${isSelected ? 'lead-chip-btn--active' : ''}`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2.2 Antecedência Mínima para Agendamento */}
        <div className="lead-rule-block lead-rule-block--bordered">
          <div className="lead-rule-header">
            <div>
              <label htmlFor="min_booking_lead_time_minutes" className="lead-rule-title">
                Antecedência mínima para agendar
              </label>
              <p className="lead-rule-desc">
                Tempo mínimo antes do corte em que o cliente ainda pode reservar um horário pelo link.
              </p>
            </div>
            <div className="lead-input-group">
              <input
                id="min_booking_lead_time_minutes"
                type="number"
                min={0}
                max={1440}
                value={minBookingLeadTimeMinutes}
                onChange={(e) => setMinBookingLeadTimeMinutes(Number(e.target.value))}
                className="lead-number-input"
              />
              <span className="lead-input-unit">minutos</span>
            </div>
          </div>

          {/* Chips de Antecedência de Agendamento */}
          <div className="lead-chips-grid">
            {BOOKING_LEAD_TIME_PRESETS.map((preset) => {
              const isSelected = minBookingLeadTimeMinutes === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setMinBookingLeadTimeMinutes(preset.value)}
                  className={`lead-chip-btn ${isSelected ? 'lead-chip-btn--active' : ''}`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2.3 Antecedência Mínima para Cancelamento */}
        <div className="lead-rule-block lead-rule-block--bordered">
          <div className="lead-rule-header">
            <div>
              <label htmlFor="min_cancellation_lead_time_minutes" className="lead-rule-title">
                Antecedência mínima para cancelar ou reagendar
              </label>
              <p className="lead-rule-desc">
                Após esse prazo, o cliente não consegue desmarcar pelo link e recebe um botão direto para conversar no WhatsApp do barbeiro.
              </p>
            </div>
            <div className="lead-input-group">
              <input
                id="min_cancellation_lead_time_minutes"
                type="number"
                min={0}
                max={2880}
                value={minCancellationLeadTimeMinutes}
                onChange={(e) => setMinCancellationLeadTimeMinutes(Number(e.target.value))}
                className="lead-number-input"
              />
              <span className="lead-input-unit">minutos</span>
            </div>
          </div>

          {/* Chips de Antecedência de Cancelamento */}
          <div className="lead-chips-grid">
            {CANCELLATION_LEAD_TIME_PRESETS.map((preset) => {
              const isSelected = minCancellationLeadTimeMinutes === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setMinCancellationLeadTimeMinutes(preset.value)}
                  className={`lead-chip-btn ${isSelected ? 'lead-chip-btn--active' : ''}`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* CARD 3: Horário de Funcionamento Geral */}
      <div className="card card-config">
        <div className="config-section-header">
          <div className="config-icon-badge">
            <HugeiconsIcon icon={Calendar03Icon} size={22} strokeWidth={2} />
          </div>
          <div>
            <h3>Horário de funcionamento geral</h3>
            <p>Escolha os dias da semana em que o estabelecimento atende e os horários de abertura e fechamento.</p>
          </div>
        </div>

        <div className="business-hours-list">
          {daysOfWeek.map(({ key, label }) => {
            const schedule = businessHours[key] || defaultBusinessHours[key];
            return (
              <div
                key={key}
                className={`business-day-row ${schedule.active ? 'business-day-row--active' : 'business-day-row--inactive'}`}
              >
                {/* Checkbox e Nome do Dia */}
                <div className="business-day-header">
                  <input
                    id={`checkbox-${key}`}
                    type="checkbox"
                    checked={schedule.active}
                    aria-label={label}
                    onChange={(e) => handleDayActiveChange(key, e.target.checked)}
                    className="business-checkbox"
                  />
                  <label htmlFor={`checkbox-${key}`} className="business-day-label">
                    {label}
                  </label>
                </div>

                {/* Seletores Padronizados de Horário */}
                <div className="business-day-selects">
                  <select
                    value={schedule.open}
                    disabled={!schedule.active}
                    aria-label={`Abertura ${label}`}
                    onChange={(e) => handleTimeChange(key, 'open', e.target.value)}
                    className="business-time-select"
                  >
                    {STANDARD_HOURS.map((hora) => (
                      <option key={hora} value={hora}>
                        {hora}
                      </option>
                    ))}
                  </select>
                  <span className="business-time-sep">às</span>
                  <select
                    value={schedule.close}
                    disabled={!schedule.active}
                    aria-label={`Fechamento ${label}`}
                    onChange={(e) => handleTimeChange(key, 'close', e.target.value)}
                    className="business-time-select"
                  >
                    {STANDARD_HOURS.map((hora) => (
                      <option key={hora} value={hora}>
                        {hora}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        .config-form {
          display: flex;
          flex-direction: column;
          gap: 2rem;
          padding-bottom: 3rem;
        }

        .config-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 1.25rem;
        }

        .config-header-text {
          max-width: 620px;
        }

        .config-header-text h2 {
          font-size: var(--font-size-xl);
          font-weight: 800;
          margin: 0;
          letter-spacing: -0.02em;
          color: var(--color-text-primary);
        }

        .config-header-text p {
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
          margin: 6px 0 0;
          line-height: 1.5;
        }

        .btn-save-config {
          padding: 12px 28px;
          border-radius: var(--radius-full);
          font-weight: 700;
          font-size: 14px;
          box-shadow: 0 4px 14px rgba(217, 108, 0, 0.2);
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 44px;
        }

        .card-config {
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 2rem;
          box-shadow: var(--shadow-sm);
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .config-section-header {
          display: flex;
          align-items: center;
          gap: 12px;
          border-bottom: 1px solid var(--color-border);
          padding-bottom: 1rem;
        }

        .config-icon-badge {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background-color: var(--color-brand-lightest);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-brand-primary);
          flex-shrink: 0;
        }

        .config-section-header h3 {
          font-size: var(--font-size-base);
          font-weight: 800;
          margin: 0;
          color: var(--color-text-primary);
        }

        .config-section-header p {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          margin: 2px 0 0;
        }

        .config-fields-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.25rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-group label {
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .config-input,
        .config-select {
          padding: 12px 16px;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border);
          background-color: var(--color-bg-primary);
          color: var(--color-text-primary);
          font-size: var(--font-size-sm);
          font-weight: 500;
          outline: none;
          min-height: 44px;
          box-sizing: border-box;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .config-input:focus,
        .config-select:focus {
          border-color: var(--color-brand-primary);
          box-shadow: 0 0 0 2px rgba(217, 108, 0, 0.15);
        }

        .address-section {
          border-top: 1px dashed var(--color-border);
          padding-top: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .address-section-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-primary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .address-row-grid {
          display: grid;
          grid-template-columns: 140px 1fr 100px;
          gap: 1rem;
        }

        .address-sub-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 90px;
          gap: 1rem;
        }

        .cep-loading {
          color: var(--color-brand-primary);
          font-size: 11px;
        }

        .cep-error {
          font-size: 12px;
          color: var(--color-error);
        }

        .uf-input {
          text-transform: uppercase;
          text-align: center;
        }

        .lead-rule-block {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .lead-rule-block--bordered {
          border-top: 1px dashed var(--color-border);
          padding-top: 1.25rem;
        }

        .lead-rule-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }

        .lead-rule-title {
          font-size: var(--font-size-sm);
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .lead-rule-desc {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          margin: 2px 0 0;
        }

        .lead-input-group {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .lead-number-input {
          width: 80px;
          padding: 8px 10px;
          min-height: 40px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--color-border);
          background-color: var(--color-bg-primary);
          color: var(--color-text-primary);
          font-size: var(--font-size-sm);
          font-weight: 700;
          text-align: center;
          box-sizing: border-box;
        }

        .lead-number-input:focus {
          border-color: var(--color-brand-primary);
          outline: none;
        }

        .lead-input-unit {
          font-size: 12px;
          color: var(--color-text-secondary);
          font-weight: 600;
        }

        .lead-chips-grid {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .lead-chip-btn {
          padding: 6px 14px;
          min-height: 38px;
          border-radius: var(--radius-full);
          border: 1px solid var(--color-border);
          background-color: var(--color-bg-primary);
          color: var(--color-text-primary);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .lead-chip-btn:hover {
          border-color: var(--color-brand-primary);
          color: var(--color-brand-primary);
        }

        .lead-chip-btn--active {
          border-color: var(--color-brand-primary);
          background-color: var(--color-brand-primary);
          color: #FFFFFF;
        }

        .lead-chip-btn--active:hover {
          color: #FFFFFF;
        }

        .business-hours-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .business-day-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-radius: var(--radius-md);
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          transition: all 0.2s ease;
          gap: 1rem;
        }

        .business-day-row--inactive {
          opacity: 0.65;
        }

        .business-day-header {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 160px;
        }

        .business-checkbox {
          width: 20px;
          height: 20px;
          border-radius: 4px;
          border: 1px solid var(--color-border);
          cursor: pointer;
          accent-color: var(--color-brand-primary);
          flex-shrink: 0;
        }

        .business-day-label {
          font-size: var(--font-size-sm);
          font-weight: 700;
          color: var(--color-text-primary);
          cursor: pointer;
        }

        .business-day-selects {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .business-time-select {
          padding: 8px 12px;
          min-height: 40px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--color-border);
          background-color: var(--color-bg-secondary);
          color: var(--color-text-primary);
          font-size: var(--font-size-sm);
          font-weight: 600;
          outline: none;
          cursor: pointer;
        }

        .business-time-select:disabled {
          cursor: not-allowed;
          background-color: var(--color-bg-disabled);
          opacity: 0.7;
        }

        .business-time-sep {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          font-weight: 600;
          flex-shrink: 0;
        }

        @media (max-width: 640px) {
          .config-form {
            gap: 1.25rem;
          }

          .card-config {
            padding: 1rem;
            border-radius: var(--radius-md);
            gap: 1.25rem;
          }

          .btn-save-config {
            width: 100%;
            justify-content: center;
          }

          .config-fields-grid {
            grid-template-columns: 1fr;
            gap: 1rem;
          }

          .address-row-grid {
            grid-template-columns: 1fr 1fr;
          }

          .cep-field {
            grid-column: span 2;
          }

          .address-sub-grid {
            grid-template-columns: 1fr 1fr;
          }

          .uf-field {
            grid-column: span 2;
          }

          .business-day-row {
            flex-direction: column;
            align-items: stretch;
            gap: 0.65rem;
            padding: 0.85rem 1rem;
          }

          .business-day-header {
            min-width: 0;
            width: 100%;
          }

          .business-day-selects {
            width: 100%;
            justify-content: space-between;
          }

          .business-time-select {
            flex: 1;
            min-height: 44px;
            text-align: center;
          }
        }

        @media (max-width: 480px) {
          .config-input,
          .config-select,
          .business-time-select {
            font-size: 16px; /* Previne auto-zoom iOS */
          }

          .address-row-grid,
          .address-sub-grid {
            grid-template-columns: 1fr;
          }

          .cep-field,
          .uf-field {
            grid-column: auto;
          }

          .lead-rule-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .lead-input-group {
            width: 100%;
            justify-content: space-between;
          }

          .lead-number-input {
            flex: 1;
            min-height: 44px;
          }
        }
      `}</style>
    </form>
  );
};
