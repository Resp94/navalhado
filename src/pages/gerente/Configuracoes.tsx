import React, { useEffect, useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { TenantContextType } from '../../components/GerenteLayout';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  CheckmarkCircle02Icon,
} from '@hugeicons/core-free-icons';
import { fetchAddressByCep, formatCep, cleanCepDigits } from '../../lib/cep';
import { normalizeBusinessHours } from '../../lib/schedule';

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

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallback;
};

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
  const lastSearchedCepRef = useRef<string>('');

  // States do Card 2: Regras de Agendamento
  const [slotIntervalMinutes, setSlotIntervalMinutes] = useState<number>(30);
  const [minBookingLeadTimeMinutes, setMinBookingLeadTimeMinutes] = useState<number>(15);
  const [minCancellationLeadTimeMinutes, setMinCancellationLeadTimeMinutes] = useState<number>(120);

  // States do Card 3: Horário de Funcionamento
  const [businessHours, setBusinessHours] = useState<BusinessHours>(defaultBusinessHours);
  const initialBusinessHoursRef = useRef<BusinessHours>(defaultBusinessHours);

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
        const loadedBusinessHours = normalizeBusinessHours(data.business_hours);
        setBusinessHours(loadedBusinessHours);
        initialBusinessHoursRef.current = loadedBusinessHours;
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

  const performLookupCep = async (cepValue: string) => {
    const cleanCep = cleanCepDigits(cepValue);
    if (cleanCep.length === 8) {
      if (lastSearchedCepRef.current === cleanCep && addressStreet) {
        return;
      }
      lastSearchedCepRef.current = cleanCep;
      setLoadingCep(true);
      setCepError(null);
      try {
        const addressData = await fetchAddressByCep(cleanCep);
        if (addressData) {
          setAddressStreet(addressData.street);
          setAddressNeighborhood(addressData.neighborhood);
          setAddressCity(addressData.city);
          setAddressState(addressData.state);

          const fullAddr = [addressData.street, addressData.neighborhood, `${addressData.city}, ${addressData.state}`].filter(Boolean).join(', ');
          if (fullAddr) setAddress(fullAddr);

          if (!addressData.street) {
            setCepError('Cidade localizada. Por favor, preencha a rua e o bairro manualmente.');
          }
        } else {
          setCepError('CEP não localizado. Você pode preencher os campos manualmente.');
        }
      } catch {
        setCepError('Não foi possível consultar o CEP no momento.');
      } finally {
        setLoadingCep(false);
      }
    }
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCep(e.target.value);
    setCep(formatted);
    setCepError(null);

    const cleanCep = cleanCepDigits(formatted);
    if (cleanCep.length === 8) {
      performLookupCep(cleanCep);
    }
  };

  const handleCepBlur = () => {
    const cleanCep = cleanCepDigits(cep);
    if (cleanCep.length === 8) {
      performLookupCep(cleanCep);
    }
  };

  const handleCepKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const cleanCep = cleanCepDigits(cep);
      if (cleanCep.length === 8) {
        performLookupCep(cleanCep);
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
      const updatePayload: Record<string, unknown> = {
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
        timezone,
        slot_interval_minutes: Number(slotIntervalMinutes) || 30,
        min_booking_lead_time_minutes: Number(minBookingLeadTimeMinutes) || 0,
        min_cancellation_lead_time_minutes: Number(minCancellationLeadTimeMinutes) || 0,
      };

      if (JSON.stringify(initialBusinessHoursRef.current) !== JSON.stringify(businessHours)) {
        updatePayload.business_hours = businessHours;
      }

      const { error } = await supabase
        .from('tenants')
        .update(updatePayload)
        .eq('id', tenant.tenantId);

      if (error) throw error;
      await tenant.refreshTenant?.();
      addToast('Configurações atualizadas com sucesso.', 'success');
    } catch (error: unknown) {
      console.error('Erro ao atualizar configurações:', error);
      const errorMessage = getErrorMessage(error, 'Erro ao salvar as configurações.');
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
        ...(prev[dayKey] || defaultBusinessHours[dayKey]),
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

  const configInputClass =
    'px-4 py-3 rounded-md border-0 shadow-[0_0_0_0.5px_var(--color-text-primary)] bg-bg-secondary text-text-primary text-sm font-medium outline-none min-h-11 box-border transition-[box-shadow,background-color] duration-200 ease-in focus:shadow-[0_0_0_2px_var(--color-brand-primary)] max-[480px]:text-base';
  const leadNumberInputClass =
    'w-20 px-2.5 py-2 min-h-10 rounded-sm border-0 shadow-[0_0_0_0.5px_var(--color-text-primary)] bg-bg-secondary text-text-primary text-sm font-bold text-center box-border outline-none transition-shadow duration-200 ease-in focus:shadow-[0_0_0_2px_var(--color-brand-primary)] max-[480px]:flex-1 max-[480px]:min-h-11 max-[480px]:text-base';
  const businessTimeSelectClass =
    'px-3 py-2 min-h-10 rounded-sm border-0 shadow-[0_0_0_0.5px_var(--color-text-primary)] bg-bg-secondary text-text-primary text-sm font-semibold outline-none cursor-pointer transition-shadow duration-200 ease-in focus:shadow-[0_0_0_2px_var(--color-brand-primary)] disabled:cursor-not-allowed disabled:bg-bg-primary disabled:opacity-60 max-sm:flex-1 max-sm:min-h-11 max-sm:text-center max-[480px]:text-base';
  const leadChipBtnBaseClass =
    'px-3.5 py-1.5 min-h-[38px] rounded-full border-0 text-xs font-bold cursor-pointer transition-all duration-150 ease-in max-[480px]:min-h-10';
  const leadChipBtnInactiveClass =
    'shadow-[0_0_0_0.5px_var(--color-text-primary)] bg-bg-secondary text-text-primary hover:shadow-[0_0_0_1px_var(--color-brand-primary)] hover:text-brand-primary';
  const leadChipBtnActiveClass =
    'shadow-[0_0_0_0.5px_var(--color-brand-primary)] bg-brand-primary text-white hover:shadow-[0_0_0_1px_var(--color-brand-hover)] hover:bg-brand-hover';

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-8 pb-12 max-sm:gap-5">
      {/* Cabeçalho */}
      <div className="flex justify-between items-start flex-wrap gap-5">
        <div className="max-w-[620px]">
          <h2 className="text-xl font-extrabold m-0 tracking-[-0.02em] text-text-primary">Ajustes da barbearia</h2>
          <p className="text-text-primary text-sm m-0 mt-1.5 leading-normal">
            Personalize os dados da sua barbearia, defina os horários de atendimento da equipe e controle as regras de agendamento online com total autonomia.
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="btn btn--primary px-7 py-3 rounded-full font-bold text-sm shadow-[0_4px_14px_rgba(217,108,0,0.2)] inline-flex items-center gap-2 min-h-11 max-sm:w-full max-sm:justify-center"
        >
          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} strokeWidth={2} />
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>

      {/* CARD 1: Perfil e Localização */}
      <div className="card card-config bg-bg-secondary border border-border rounded-lg p-8 shadow-sm flex flex-col gap-6 max-sm:p-4 max-sm:rounded-md max-sm:gap-5">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <div>
            <h3 className="text-base font-extrabold m-0 text-text-primary">Perfil e localização</h3>
            <p className="text-xs text-text-primary m-0 mt-0.5">Dados cadastrais, canais de contato com o cliente e localização do estabelecimento.</p>
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5 max-sm:grid-cols-1 max-sm:gap-4">
          {/* Nome da Barbearia */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-xs font-bold text-text-primary uppercase tracking-[0.05em]">Nome da barbearia</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Barbearia Navalha de Ouro"
              className={configInputClass}
            />
          </div>

          {/* E-mail de Contato */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-bold text-text-primary uppercase tracking-[0.05em]">E-mail de contato</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contato@barbearia.com"
              className={configInputClass}
            />
          </div>

          {/* Telefone */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="phone" className="text-xs font-bold text-text-primary uppercase tracking-[0.05em]">Telefone</label>
            <input
              id="phone"
              type="text"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="(00) 00000-0000"
              className={configInputClass}
            />
          </div>

          {/* Fuso Horário */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="timezone" className="text-xs font-bold text-text-primary uppercase tracking-[0.05em]">Fuso horário</label>
            <select
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className={configInputClass}
            >
              <option value="America/Sao_Paulo">Horário de Brasília (UTC-3)</option>
              <option value="America/Manaus">Horário da Amazônia (UTC-4)</option>
              <option value="America/Rio_Branco">Horário do Acre (UTC-5)</option>
              <option value="America/Noronha">Fernando de Noronha (UTC-2)</option>
            </select>
          </div>
        </div>

        {/* Endereço Estruturado com CEP */}
        <div className="flex flex-col gap-4 border-t border-dashed border-border pt-5">
          <div className="flex items-center gap-2 text-xs font-bold text-text-primary uppercase tracking-[0.05em]">
            <span>Endereço do estabelecimento</span>
          </div>

          <div className="grid grid-cols-[140px_1fr_100px] gap-4 max-sm:grid-cols-2 max-[480px]:grid-cols-1">
            {/* CEP */}
            <div className="flex flex-col gap-1.5 max-sm:col-span-2 max-[480px]:col-auto">
              <label htmlFor="cep" className="text-xs font-bold text-text-primary uppercase tracking-[0.05em]">
                CEP {loadingCep && <span className="text-brand-primary text-[11px]">(Buscando...)</span>}
              </label>
              <input
                id="cep"
                type="text"
                value={cep}
                onChange={handleCepChange}
                onBlur={handleCepBlur}
                onKeyDown={handleCepKeyDown}
                placeholder="00000-000"
                maxLength={9}
                className={configInputClass}
              />
            </div>

            {/* Logradouro / Rua */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="address_street" className="text-xs font-bold text-text-primary uppercase tracking-[0.05em]">Rua ou avenida</label>
              <input
                id="address_street"
                type="text"
                value={addressStreet}
                onChange={(e) => setAddressStreet(e.target.value)}
                placeholder="Ex: Rua das Flores"
                className={configInputClass}
              />
            </div>

            {/* Número */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="address_number" className="text-xs font-bold text-text-primary uppercase tracking-[0.05em]">Número</label>
              <input
                id="address_number"
                type="text"
                value={addressNumber}
                onChange={(e) => setAddressNumber(e.target.value)}
                placeholder="Ex: 123"
                className={configInputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-[1fr_1fr_90px] gap-4 max-sm:grid-cols-2 max-[480px]:grid-cols-1">
            {/* Bairro */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="address_neighborhood" className="text-xs font-bold text-text-primary uppercase tracking-[0.05em]">Bairro</label>
              <input
                id="address_neighborhood"
                type="text"
                value={addressNeighborhood}
                onChange={(e) => setAddressNeighborhood(e.target.value)}
                placeholder="Ex: Centro"
                className={configInputClass}
              />
            </div>

            {/* Cidade */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="address_city" className="text-xs font-bold text-text-primary uppercase tracking-[0.05em]">Cidade</label>
              <input
                id="address_city"
                type="text"
                value={addressCity}
                onChange={(e) => setAddressCity(e.target.value)}
                placeholder="Ex: São Paulo"
                className={configInputClass}
              />
            </div>

            {/* UF */}
            <div className="flex flex-col gap-1.5 max-sm:col-span-2 max-[480px]:col-auto">
              <label htmlFor="address_state" className="text-xs font-bold text-text-primary uppercase tracking-[0.05em]">UF</label>
              <input
                id="address_state"
                type="text"
                value={addressState}
                maxLength={2}
                onChange={(e) => setAddressState(e.target.value.toUpperCase())}
                placeholder="SP"
                className={`${configInputClass} uppercase text-center`}
              />
            </div>
          </div>

          {cepError && (
            <span className="text-error text-xs">{cepError}</span>
          )}

          {/* Campo de Endereço Completo (legado/resumo) */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="address" className="text-xs font-bold text-text-primary uppercase tracking-[0.05em]">Endereço completo ou ponto de referência</label>
            <input
              id="address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Rua, Número, Bairro, Cidade, Estado"
              className={configInputClass}
            />
          </div>
        </div>
      </div>

      {/* CARD 2: Regras de Agendamento Online */}
      <div className="card card-config bg-bg-secondary border border-border rounded-lg p-8 shadow-sm flex flex-col gap-6 max-sm:p-4 max-sm:rounded-md max-sm:gap-5">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <div>
            <h3 className="text-base font-extrabold m-0 text-text-primary">Regras de agendamento online</h3>
            <p className="text-xs text-text-primary m-0 mt-0.5">Defina o ritmo dos atendimentos e proteja a rotina dos seus profissionais contra agendamentos ou cancelamentos de última hora.</p>
          </div>
        </div>

        {/* 2.1 Intervalo entre Horários */}
        <div className="flex flex-col gap-2.5">
          <div className="flex justify-between items-center flex-wrap gap-2 max-[480px]:flex-col max-[480px]:flex-nowrap max-[480px]:items-start">
            <div>
              <label htmlFor="slot_interval_minutes" className="text-sm font-bold text-text-primary">
                Intervalo entre horários na grade
              </label>
              <p className="text-xs text-text-primary m-0 mt-0.5">
                Frequência de novos horários gerados para os clientes reservarem online.
              </p>
            </div>
            <div className="flex items-center gap-1.5 max-[480px]:w-full max-[480px]:justify-between">
              <input
                id="slot_interval_minutes"
                type="number"
                min={5}
                max={240}
                value={slotIntervalMinutes}
                onChange={(e) => setSlotIntervalMinutes(Number(e.target.value))}
                className={leadNumberInputClass}
              />
              <span className="text-xs text-text-primary font-semibold">minutos</span>
            </div>
          </div>

          {/* Chips de Intervalo */}
          <div className="flex gap-2 flex-wrap">
            {SLOT_INTERVAL_PRESETS.map((preset) => {
              const isSelected = slotIntervalMinutes === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setSlotIntervalMinutes(preset.value)}
                  className={`${leadChipBtnBaseClass} ${isSelected ? leadChipBtnActiveClass : leadChipBtnInactiveClass}`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2.2 Antecedência Mínima para Agendamento */}
        <div className="flex flex-col gap-2.5 border-t border-dashed border-border pt-5">
          <div className="flex justify-between items-center flex-wrap gap-2 max-[480px]:flex-col max-[480px]:flex-nowrap max-[480px]:items-start">
            <div>
              <label htmlFor="min_booking_lead_time_minutes" className="text-sm font-bold text-text-primary">
                Antecedência mínima para agendar
              </label>
              <p className="text-xs text-text-primary m-0 mt-0.5">
                Tempo mínimo antes do corte em que o cliente ainda pode reservar um horário pelo link.
              </p>
            </div>
            <div className="flex items-center gap-1.5 max-[480px]:w-full max-[480px]:justify-between">
              <input
                id="min_booking_lead_time_minutes"
                type="number"
                min={0}
                max={1440}
                value={minBookingLeadTimeMinutes}
                onChange={(e) => setMinBookingLeadTimeMinutes(Number(e.target.value))}
                className={leadNumberInputClass}
              />
              <span className="text-xs text-text-primary font-semibold">minutos</span>
            </div>
          </div>

          {/* Chips de Antecedência de Agendamento */}
          <div className="flex gap-2 flex-wrap">
            {BOOKING_LEAD_TIME_PRESETS.map((preset) => {
              const isSelected = minBookingLeadTimeMinutes === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setMinBookingLeadTimeMinutes(preset.value)}
                  className={`${leadChipBtnBaseClass} ${isSelected ? leadChipBtnActiveClass : leadChipBtnInactiveClass}`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2.3 Antecedência Mínima para Cancelamento */}
        <div className="flex flex-col gap-2.5 border-t border-dashed border-border pt-5">
          <div className="flex justify-between items-center flex-wrap gap-2 max-[480px]:flex-col max-[480px]:flex-nowrap max-[480px]:items-start">
            <div>
              <label htmlFor="min_cancellation_lead_time_minutes" className="text-sm font-bold text-text-primary">
                Antecedência mínima para cancelar ou reagendar
              </label>
              <p className="text-xs text-text-primary m-0 mt-0.5">
                Após esse prazo, o cliente não consegue desmarcar pelo link e recebe um botão direto para conversar no WhatsApp do barbeiro.
              </p>
            </div>
            <div className="flex items-center gap-1.5 max-[480px]:w-full max-[480px]:justify-between">
              <input
                id="min_cancellation_lead_time_minutes"
                type="number"
                min={0}
                max={2880}
                value={minCancellationLeadTimeMinutes}
                onChange={(e) => setMinCancellationLeadTimeMinutes(Number(e.target.value))}
                className={leadNumberInputClass}
              />
              <span className="text-xs text-text-primary font-semibold">minutos</span>
            </div>
          </div>

          {/* Chips de Antecedência de Cancelamento */}
          <div className="flex gap-2 flex-wrap">
            {CANCELLATION_LEAD_TIME_PRESETS.map((preset) => {
              const isSelected = minCancellationLeadTimeMinutes === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setMinCancellationLeadTimeMinutes(preset.value)}
                  className={`${leadChipBtnBaseClass} ${isSelected ? leadChipBtnActiveClass : leadChipBtnInactiveClass}`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* CARD 3: Horário de Funcionamento Geral */}
      <div className="card card-config bg-bg-secondary border border-border rounded-lg p-8 shadow-sm flex flex-col gap-6 max-sm:p-4 max-sm:rounded-md max-sm:gap-5">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <div>
            <h3 className="text-base font-extrabold m-0 text-text-primary">Horário de funcionamento geral</h3>
            <p className="text-xs text-text-primary m-0 mt-0.5">Escolha os dias da semana em que o estabelecimento atende e os horários de abertura e fechamento.</p>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {daysOfWeek.map(({ key, label }) => {
            const schedule = businessHours[key] || defaultBusinessHours[key];
            return (
              <div
                key={key}
                className={`flex items-center justify-between px-4 py-3 rounded-md bg-bg-secondary border-0 shadow-[0_0_0_0.5px_var(--color-text-primary)] transition-all duration-200 ease-in gap-4 max-sm:flex-col max-sm:items-stretch max-sm:gap-[0.65rem] max-sm:px-4 max-sm:py-[0.85rem] ${schedule.active ? '' : 'opacity-[0.65]'}`}
              >
                {/* Checkbox e Nome do Dia */}
                <div className="flex items-center gap-3 min-w-[160px] max-sm:min-w-0 max-sm:w-full">
                  <input
                    id={`checkbox-${key}`}
                    type="checkbox"
                    checked={schedule.active}
                    aria-label={label}
                    onChange={(e) => handleDayActiveChange(key, e.target.checked)}
                    className="w-5 h-5 rounded-sm border border-border cursor-pointer accent-brand-primary shrink-0"
                  />
                  <label htmlFor={`checkbox-${key}`} className="text-sm font-bold text-text-primary cursor-pointer">
                    {label}
                  </label>
                </div>

                {/* Seletores Padronizados de Horário */}
                <div className="flex items-center gap-2 max-sm:w-full max-sm:justify-between">
                  <select
                    value={schedule.open}
                    disabled={!schedule.active}
                    aria-label={`Abertura ${label}`}
                    onChange={(e) => handleTimeChange(key, 'open', e.target.value)}
                    className={businessTimeSelectClass}
                  >
                    {STANDARD_HOURS.map((hora) => (
                      <option key={hora} value={hora}>
                        {hora}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-text-primary font-semibold shrink-0">às</span>
                  <select
                    value={schedule.close}
                    disabled={!schedule.active}
                    aria-label={`Fechamento ${label}`}
                    onChange={(e) => handleTimeChange(key, 'close', e.target.value)}
                    className={businessTimeSelectClass}
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
