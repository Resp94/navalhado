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

    const fullAddress = addressStreet.trim()
      ? `${addressStreet.trim()}${addressNumber ? `, ${addressNumber.trim()}` : ''}${addressNeighborhood ? `, ${addressNeighborhood.trim()}` : ''}${addressCity ? `, ${addressCity.trim()}` : ''}${addressState ? `, ${addressState.trim()}` : ''}`
      : address.trim();

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
      <div className="skeleton-container" style={{ padding: '1rem 0', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="skeleton" style={{ height: '48px', width: '260px', borderRadius: '12px' }} />
        <div className="skeleton" style={{ height: '320px', borderRadius: '16px' }} />
        <div className="skeleton" style={{ height: '240px', borderRadius: '16px' }} />
        <div className="skeleton" style={{ height: '400px', borderRadius: '16px' }} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '3rem' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.25rem' }}>
        <div style={{ maxWidth: '620px' }}>
          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
            Ajustes da barbearia
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', margin: '6px 0 0', lineHeight: 1.5 }}>
            Personalize os dados da sua barbearia, defina os horários de atendimento da equipe e controle as regras de agendamento online com total autonomia.
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="btn btn--primary"
          style={{
            padding: '12px 28px',
            borderRadius: '9999px',
            fontWeight: 700,
            fontSize: '14px',
            boxShadow: '0 4px 14px rgba(217, 108, 0, 0.2)',
            cursor: saving ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} strokeWidth={2} />
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>

      {/* CARD 1: Perfil e Localização */}
      <div className="card-config" style={{
        backgroundColor: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '2rem',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-brand-lightest)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-brand-primary)'
          }}>
            <HugeiconsIcon icon={Store01Icon} size={22} strokeWidth={2} />
          </div>
          <div>
            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
              Perfil e localização
            </h3>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
              Dados cadastrais, canais de contato com o cliente e localização do estabelecimento.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {/* Nome da Barbearia */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="name" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Nome da barbearia
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Barbearia Navalha de Ouro"
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

          {/* E-mail de Contato */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="email" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              E-mail de contato
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contato@barbearia.com"
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
              Fuso horário
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
              <option value="America/Sao_Paulo">Horário de Brasília (UTC-3)</option>
              <option value="America/Manaus">Horário da Amazônia (UTC-4)</option>
              <option value="America/Rio_Branco">Horário do Acre (UTC-5)</option>
              <option value="America/Noronha">Fernando de Noronha (UTC-2)</option>
            </select>
          </div>
        </div>

        {/* Endereço Estruturado com CEP */}
        <div style={{ borderTop: '1px dashed var(--color-border)', paddingTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HugeiconsIcon icon={Location01Icon} size={16} color="var(--color-brand-primary)" />
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Endereço do estabelecimento
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
            {/* CEP */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="cep" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                CEP {loadingCep && <span style={{ color: 'var(--color-brand-primary)' }}>(Buscando...)</span>}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="cep"
                  type="text"
                  value={cep}
                  onChange={handleCepChange}
                  placeholder="00000-000"
                  maxLength={9}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg-primary)',
                    color: 'var(--color-text-primary)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 600,
                    outline: 'none',
                    width: '100%'
                  }}
                />
              </div>
            </div>

            {/* Logradouro / Rua */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: 'span 2' }}>
              <label htmlFor="address_street" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                Rua ou avenida
              </label>
              <input
                id="address_street"
                type="text"
                value={addressStreet}
                onChange={(e) => setAddressStreet(e.target.value)}
                placeholder="Ex: Rua das Flores"
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg-primary)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--font-size-sm)',
                  outline: 'none'
                }}
              />
            </div>

            {/* Número */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="address_number" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                Número
              </label>
              <input
                id="address_number"
                type="text"
                value={addressNumber}
                onChange={(e) => setAddressNumber(e.target.value)}
                placeholder="Ex: 123"
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg-primary)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--font-size-sm)',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
            {/* Bairro */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="address_neighborhood" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                Bairro
              </label>
              <input
                id="address_neighborhood"
                type="text"
                value={addressNeighborhood}
                onChange={(e) => setAddressNeighborhood(e.target.value)}
                placeholder="Ex: Centro"
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg-primary)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--font-size-sm)',
                  outline: 'none'
                }}
              />
            </div>

            {/* Cidade */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="address_city" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                Cidade
              </label>
              <input
                id="address_city"
                type="text"
                value={addressCity}
                onChange={(e) => setAddressCity(e.target.value)}
                placeholder="Ex: São Paulo"
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg-primary)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--font-size-sm)',
                  outline: 'none'
                }}
              />
            </div>

            {/* UF */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="address_state" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                UF
              </label>
              <input
                id="address_state"
                type="text"
                value={addressState}
                maxLength={2}
                onChange={(e) => setAddressState(e.target.value.toUpperCase())}
                placeholder="SP"
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg-primary)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--font-size-sm)',
                  outline: 'none',
                  textTransform: 'uppercase'
                }}
              />
            </div>
          </div>

          {cepError && (
            <span style={{ fontSize: '12px', color: 'var(--color-error)' }}>{cepError}</span>
          )}

          {/* Campo de Endereço Completo (legado/resumo) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="address" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
              Endereço completo ou ponto de referência
            </label>
            <input
              id="address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Rua, Número, Bairro, Cidade, Estado"
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--font-size-sm)',
                outline: 'none'
              }}
            />
          </div>
        </div>
      </div>

      {/* CARD 2: Regras de Agendamento Online */}
      <div className="card-config" style={{
        backgroundColor: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '2rem',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-brand-lightest)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-brand-primary)'
          }}>
            <HugeiconsIcon icon={Clock01Icon} size={22} strokeWidth={2} />
          </div>
          <div>
            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
              Regras de agendamento online
            </h3>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
              Defina o ritmo dos atendimentos e proteja a rotina dos seus profissionais contra agendamentos ou cancelamentos de última hora.
            </p>
          </div>
        </div>

        {/* 2.1 Intervalo entre Horários */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <label htmlFor="slot_interval_minutes" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Intervalo entre horários na grade
              </label>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
                Frequência de novos horários gerados para os clientes reservarem online.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                id="slot_interval_minutes"
                type="number"
                min={5}
                max={240}
                value={slotIntervalMinutes}
                onChange={(e) => setSlotIntervalMinutes(Number(e.target.value))}
                style={{
                  width: '80px',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg-primary)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 700,
                  textAlign: 'center'
                }}
              />
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>minutos</span>
            </div>
          </div>

          {/* Chips de Intervalo */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {SLOT_INTERVAL_PRESETS.map((preset) => {
              const isSelected = slotIntervalMinutes === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setSlotIntervalMinutes(preset.value)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '9999px',
                    border: '1px solid',
                    borderColor: isSelected ? 'var(--color-brand-primary)' : 'var(--color-border)',
                    backgroundColor: isSelected ? 'var(--color-brand-primary)' : 'var(--color-bg-primary)',
                    color: isSelected ? '#FFFFFF' : 'var(--color-text-primary)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2.2 Antecedência Mínima para Agendamento */}
        <div style={{ borderTop: '1px dashed var(--color-border)', paddingTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <label htmlFor="min_booking_lead_time_minutes" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Antecedência mínima para agendar
              </label>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
                Tempo mínimo antes do corte em que o cliente ainda pode reservar um horário pelo link.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                id="min_booking_lead_time_minutes"
                type="number"
                min={0}
                max={1440}
                value={minBookingLeadTimeMinutes}
                onChange={(e) => setMinBookingLeadTimeMinutes(Number(e.target.value))}
                style={{
                  width: '80px',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg-primary)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 700,
                  textAlign: 'center'
                }}
              />
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>minutos</span>
            </div>
          </div>

          {/* Chips de Antecedência de Agendamento */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {BOOKING_LEAD_TIME_PRESETS.map((preset) => {
              const isSelected = minBookingLeadTimeMinutes === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setMinBookingLeadTimeMinutes(preset.value)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '9999px',
                    border: '1px solid',
                    borderColor: isSelected ? 'var(--color-brand-primary)' : 'var(--color-border)',
                    backgroundColor: isSelected ? 'var(--color-brand-primary)' : 'var(--color-bg-primary)',
                    color: isSelected ? '#FFFFFF' : 'var(--color-text-primary)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2.3 Antecedência Mínima para Cancelamento */}
        <div style={{ borderTop: '1px dashed var(--color-border)', paddingTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <label htmlFor="min_cancellation_lead_time_minutes" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Antecedência mínima para cancelar ou reagendar
              </label>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
                Após esse prazo, o cliente não consegue desmarcar pelo link e recebe um botão direto para conversar no WhatsApp do barbeiro.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                id="min_cancellation_lead_time_minutes"
                type="number"
                min={0}
                max={2880}
                value={minCancellationLeadTimeMinutes}
                onChange={(e) => setMinCancellationLeadTimeMinutes(Number(e.target.value))}
                style={{
                  width: '80px',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg-primary)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 700,
                  textAlign: 'center'
                }}
              />
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>minutos</span>
            </div>
          </div>

          {/* Chips de Antecedência de Cancelamento */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {CANCELLATION_LEAD_TIME_PRESETS.map((preset) => {
              const isSelected = minCancellationLeadTimeMinutes === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setMinCancellationLeadTimeMinutes(preset.value)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '9999px',
                    border: '1px solid',
                    borderColor: isSelected ? 'var(--color-brand-primary)' : 'var(--color-border)',
                    backgroundColor: isSelected ? 'var(--color-brand-primary)' : 'var(--color-bg-primary)',
                    color: isSelected ? '#FFFFFF' : 'var(--color-text-primary)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* CARD 3: Horário de Funcionamento Geral */}
      <div className="card-config" style={{
        backgroundColor: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '2rem',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-brand-lightest)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-brand-primary)'
          }}>
            <HugeiconsIcon icon={Calendar03Icon} size={22} strokeWidth={2} />
          </div>
          <div>
            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
              Horário de funcionamento geral
            </h3>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
              Escolha os dias da semana em que o estabelecimento atende e os horários de abertura e fechamento.
            </p>
          </div>
        </div>

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
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '160px' }}>
                  <input
                    id={`checkbox-${key}`}
                    type="checkbox"
                    checked={schedule.active}
                    aria-label={label}
                    onChange={(e) => handleDayActiveChange(key, e.target.checked)}
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '4px',
                      border: '1px solid var(--color-border)',
                      cursor: 'pointer',
                      accentColor: 'var(--color-brand-primary)'
                    }}
                  />
                  <label htmlFor={`checkbox-${key}`} style={{ 
                    fontSize: 'var(--font-size-sm)', 
                    fontWeight: 700, 
                    color: 'var(--color-text-primary)',
                    cursor: 'pointer'
                  }}>
                    {label}
                  </label>
                </div>

                {/* Seletores Padronizados de Horário */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <select
                    value={schedule.open}
                    disabled={!schedule.active}
                    aria-label={`Abertura ${label}`}
                    onChange={(e) => handleTimeChange(key, 'open', e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: schedule.active ? 'var(--color-bg-secondary)' : 'var(--color-bg-disabled)',
                      color: 'var(--color-text-primary)',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 600,
                      outline: 'none',
                      cursor: schedule.active ? 'pointer' : 'not-allowed'
                    }}
                  >
                    {STANDARD_HOURS.map((hora) => (
                      <option key={hora} value={hora}>
                        {hora}
                      </option>
                    ))}
                  </select>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>às</span>
                  <select
                    value={schedule.close}
                    disabled={!schedule.active}
                    aria-label={`Fechamento ${label}`}
                    onChange={(e) => handleTimeChange(key, 'close', e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: schedule.active ? 'var(--color-bg-secondary)' : 'var(--color-bg-disabled)',
                      color: 'var(--color-text-primary)',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 600,
                      outline: 'none',
                      cursor: schedule.active ? 'pointer' : 'not-allowed'
                    }}
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
    </form>
  );
};
