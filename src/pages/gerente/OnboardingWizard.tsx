import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import type { TenantContextType } from '../../components/GerenteLayout';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { StepLocation } from './onboarding/StepLocation';
import { StepSegmentation } from './onboarding/StepSegmentation';
import { StepServices } from './onboarding/StepServices';
import { StepProfessionals } from './onboarding/StepProfessionals';
import type {
  LocationData,
  SegmentationData,
  ServiceItem,
  ProfessionalItem,
} from './onboarding/types';

export const OnboardingWizard: React.FC = () => {
  const tenant = useOutletContext<TenantContextType>();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [planName, setPlanName] = useState('Bronze');
  const [maxProfessionals, setMaxProfessionals] = useState(3);
  const [managerName, setManagerName] = useState('Gestor');
  const [managerPhone, setManagerPhone] = useState('');

  // Estados dos Passos
  const [location, setLocation] = useState<LocationData>({
    cep: '',
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    state: '',
    complement: '',
    latitude: null,
    longitude: null,
  });

  const [segmentation, setSegmentation] = useState<SegmentationData>({
    baseCutPrice: 0,
    acquisitionChannel: '',
  });

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalItem[]>([]);

  // Carregar dados de plano e usuário logado
  useEffect(() => {
    let isMounted = true;

    const loadInitialMetadata = async () => {
      try {
        if (!tenant?.tenantId) return;

        // 1. Buscar dados do Gestor logado
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: userData } = await supabase
            .from('users')
            .select('name')
            .eq('id', user.id)
            .single();

          if (userData && isMounted) {
            setManagerName(userData.name || 'Gestor');
          }
        }

        // 2. Buscar telefone do tenant
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('phone')
          .eq('id', tenant.tenantId)
          .single();

        if (tenantData && isMounted) {
          setManagerPhone(tenantData.phone || '');
        }

        // 3. Buscar plano ativo da assinatura
        const { data: subData } = await supabase
          .from('tenant_subscriptions')
          .select(`
            plan_id,
            plans (
              name,
              max_professionals
            )
          `)
          .eq('tenant_id', tenant.tenantId)
          .single();

        if (subData && subData.plans && isMounted) {
          const plan: any = subData.plans;
          setPlanName(plan.name || 'Bronze');
          setMaxProfessionals(plan.max_professionals || 3);
        }
      } catch (err) {
        console.error('Erro ao carregar metadados do wizard:', err);
      }
    };

    loadInitialMetadata();

    return () => {
      isMounted = false;
    };
  }, [tenant?.tenantId]);

  // Manipuladores de Serviços
  const handleAddService = (srv: Omit<ServiceItem, 'id'>) => {
    const newItem: ServiceItem = {
      ...srv,
      id: crypto.randomUUID(),
    };
    setServices((prev) => [...prev, newItem]);
  };

  const handleRemoveService = (id: string) => {
    setServices((prev) => prev.filter((s) => s.id !== id));
  };

  // Manipuladores de Profissionais
  const handleAddProfessional = (prof: Omit<ProfessionalItem, 'id'>) => {
    const newItem: ProfessionalItem = {
      ...prof,
      id: crypto.randomUUID(),
    };
    setProfessionals((prev) => [...prev, newItem]);
  };

  const handleRemoveProfessional = (id: string) => {
    if (professionals.length <= 1) {
      addToast('A barbearia deve possuir ao menos 1 profissional ativo.', 'warning');
      return;
    }
    setProfessionals((prev) => prev.filter((p) => p.id !== id));
  };

  // Finalização do Onboarding
  const handleFinish = async () => {
    if (services.length === 0) {
      addToast('Cadastre pelo menos 1 serviço antes de finalizar.', 'warning');
      setCurrentStep(3);
      return;
    }

    if (professionals.length === 0) {
      addToast('Cadastre pelo menos 1 profissional antes de finalizar.', 'warning');
      return;
    }

    try {
      setSubmitting(true);

      // 1. Inserir catálogo inicial de serviços primeiro
      const servicesPayload = services.map((s) => ({
        tenant_id: tenant.tenantId,
        name: s.name,
        price: s.price,
        duration_minutes: s.durationMinutes,
        category: s.category,
        is_active: true,
      }));

      const { error: servicesErr } = await supabase
        .from('services')
        .insert(servicesPayload);

      if (servicesErr) throw servicesErr;

      // 2. Inserir profissionais da equipe
      const defaultSchedule = {
        monday: { active: true, start: '09:00', end: '18:00', break_start: '12:00', break_end: '13:00' },
        tuesday: { active: true, start: '09:00', end: '18:00', break_start: '12:00', break_end: '13:00' },
        wednesday: { active: true, start: '09:00', end: '18:00', break_start: '12:00', break_end: '13:00' },
        thursday: { active: true, start: '09:00', end: '18:00', break_start: '12:00', break_end: '13:00' },
        friday: { active: true, start: '09:00', end: '18:00', break_start: '12:00', break_end: '13:00' },
        saturday: { active: true, start: '09:00', end: '18:00', break_start: '12:00', break_end: '13:00' },
        sunday: { active: false, start: '09:00', end: '13:00', break_start: '12:00', break_end: '13:00' },
      };

      const profPayload = professionals.map((p) => ({
        tenant_id: tenant.tenantId,
        name: p.name,
        phone: p.phone,
        commission_percentage: p.commissionPercentage,
        weekly_schedule: defaultSchedule,
        is_active: true,
      }));

      const { error: profErr } = await supabase
        .from('professionals')
        .insert(profPayload);

      if (profErr) throw profErr;

      // 3. Somente após sucesso dos inserts, marcar tenant com onboarding_completed = true
      const { error: tenantErr } = await supabase
        .from('tenants')
        .update({
          cep: location.cep,
          address_street: location.street,
          address_number: location.number,
          address_neighborhood: location.neighborhood,
          address_city: location.city,
          address_state: location.state,
          address: `${location.street}, ${location.number} - ${location.neighborhood}, ${location.city}/${location.state}`,
          latitude: location.latitude,
          longitude: location.longitude,
          base_cut_price: segmentation.baseCutPrice,
          acquisition_channel: segmentation.acquisitionChannel,
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenant.tenantId);

      if (tenantErr) throw tenantErr;

      addToast('Configuração concluída com sucesso! Bem-vindo ao Navalhado.', 'success');
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Erro ao finalizar onboarding:', err);
      addToast(err.message || 'Erro ao salvar configurações do onboarding.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const STEPS = [
    { num: 1, title: 'Localização', desc: 'Endereço da Barbearia' },
    { num: 2, title: 'Segmentação', desc: 'Preço Base & Origem' },
    { num: 3, title: 'Serviços', desc: 'Cardápio Inicial' },
    { num: 4, title: 'Profissionais', desc: 'Equipe & Barbeiros' },
  ];

  return (
    <div className="onboarding-wrapper" data-testid="onboarding-wizard">
      {/* Topo com Logo e Boas-Vindas */}
      <header className="onboarding-top-bar">
        <div className="onboarding-brand">
          <img src="/simbolo.svg" alt="Navalhado" className="onboarding-logo" />
          <div>
            <h1 className="onboarding-brand-title">Navalhado</h1>
            <span className="onboarding-tenant-name">{tenant?.tenantName || 'Sua Barbearia'}</span>
          </div>
        </div>
        <div className="onboarding-badge-step">
          Passo {currentStep} de 4
        </div>
      </header>

      {/* Stepper Visual */}
      <div className="onboarding-stepper-container">
        <div className="onboarding-stepper">
          {STEPS.map((s) => {
            const isCompleted = currentStep > s.num;
            const isCurrent = currentStep === s.num;
            return (
              <div
                key={s.num}
                className={`stepper-item ${isCompleted ? 'stepper-item--completed' : ''} ${
                  isCurrent ? 'stepper-item--current' : ''
                }`}
              >
                <div className="stepper-circle">
                  {isCompleted ? '✓' : s.num}
                </div>
                <div className="stepper-labels">
                  <span className="stepper-title">{s.title}</span>
                  <span className="stepper-desc">{s.desc}</span>
                </div>
                {s.num < 4 && <div className="stepper-line" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Conteúdo Dinâmico da Etapa */}
      <div className="onboarding-card-box">
        {currentStep === 1 && (
          <StepLocation
            data={location}
            onChange={(upd) => setLocation((prev) => ({ ...prev, ...upd }))}
            onNext={() => setCurrentStep(2)}
          />
        )}

        {currentStep === 2 && (
          <StepSegmentation
            data={segmentation}
            planName={planName}
            maxProfessionals={maxProfessionals}
            onChange={(upd) => setSegmentation((prev) => ({ ...prev, ...upd }))}
            onNext={() => {
              if (services.length === 0) {
                const initialPrice = segmentation.baseCutPrice > 0 ? segmentation.baseCutPrice : 35;
                setServices([
                  {
                    id: crypto.randomUUID(),
                    name: 'Corte Tradicional',
                    price: initialPrice,
                    durationMinutes: 30,
                    category: 'cabelo',
                  },
                ]);
              }
              setCurrentStep(3);
            }}
            onBack={() => setCurrentStep(1)}
          />
        )}

        {currentStep === 3 && (
          <StepServices
            services={services}
            baseCutPrice={segmentation.baseCutPrice}
            onAddService={handleAddService}
            onRemoveService={handleRemoveService}
            onNext={() => setCurrentStep(4)}
            onBack={() => setCurrentStep(2)}
          />
        )}

        {currentStep === 4 && (
          <StepProfessionals
            professionals={professionals}
            maxProfessionals={maxProfessionals}
            planName={planName}
            managerName={managerName}
            managerPhone={managerPhone}
            submitting={submitting}
            onAddProfessional={handleAddProfessional}
            onRemoveProfessional={handleRemoveProfessional}
            onFinish={handleFinish}
            onBack={() => setCurrentStep(3)}
          />
        )}
      </div>

      <style>{`
        .onboarding-wrapper {
          max-width: 960px;
          margin: 0 auto;
          padding: 2rem 1.5rem;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          font-family: var(--font-sans, system-ui, -apple-system, sans-serif);
        }

        .onboarding-top-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          background: rgba(24, 24, 27, 0.65);
          border: 1px solid rgba(39, 39, 42, 0.8);
          border-radius: 12px;
          backdrop-filter: blur(12px);
        }

        .onboarding-brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .onboarding-logo {
          width: 28px;
          height: 28px;
        }

        .onboarding-brand-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: #f4f4f5;
          margin: 0;
        }

        .onboarding-tenant-name {
          font-size: 0.8rem;
          color: #a1a1aa;
        }

        .onboarding-badge-step {
          background: rgba(234, 88, 12, 0.15);
          color: #fb923c;
          border: 1px solid rgba(234, 88, 12, 0.3);
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.35rem 0.75rem;
          border-radius: 9999px;
        }

        .onboarding-stepper-container {
          background: rgba(24, 24, 27, 0.4);
          border: 1px solid rgba(39, 39, 42, 0.5);
          border-radius: 12px;
          padding: 1.25rem 1.5rem;
        }

        .onboarding-stepper {
          display: flex;
          justify-content: space-between;
          position: relative;
        }

        .stepper-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex: 1;
          position: relative;
        }

        .stepper-circle {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.875rem;
          background: #27272a;
          color: #a1a1aa;
          border: 2px solid #3f3f46;
          transition: all 0.3s ease;
          flex-shrink: 0;
        }

        .stepper-item--current .stepper-circle {
          background: #ea580c;
          color: #ffffff;
          border-color: #ea580c;
          box-shadow: 0 0 12px rgba(234, 88, 12, 0.4);
        }

        .stepper-item--completed .stepper-circle {
          background: #166534;
          color: #4ade80;
          border-color: #22c55e;
        }

        .stepper-labels {
          display: flex;
          flex-direction: column;
        }

        .stepper-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: #f4f4f5;
        }

        .stepper-desc {
          font-size: 0.75rem;
          color: #71717a;
        }

        .stepper-line {
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          width: calc(100% - 140px);
          height: 2px;
          background: #27272a;
          z-index: -1;
        }

        .onboarding-card-box {
          background: #18181b;
          border: 1px solid #27272a;
          border-radius: 16px;
          padding: 2rem;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        }

        .onboarding-step-header h2 {
          font-size: 1.4rem;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 0.5rem;
        }

        .onboarding-step-subtitle {
          font-size: 0.9rem;
          color: #a1a1aa;
          margin-bottom: 1.5rem;
        }

        .onboarding-form-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.25rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .form-group.span-2 {
          grid-column: span 2;
        }

        .form-label {
          font-size: 0.85rem;
          font-weight: 500;
          color: #d4d4d8;
        }

        .required-star {
          color: #ef4444;
        }

        .optional-tag {
          font-size: 0.75rem;
          color: #71717a;
        }

        .form-input, .form-select {
          background: #09090b;
          border: 1px solid #27272a;
          border-radius: 8px;
          color: #f4f4f5;
          padding: 0.65rem 0.875rem;
          font-size: 0.9rem;
          outline: none;
          transition: border-color 0.2s ease;
        }

        .form-input:focus, .form-select:focus {
          border-color: #ea580c;
        }

        .input-country-fixed {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: #09090b;
          border: 1px solid #27272a;
          border-radius: 8px;
          padding: 0.65rem 0.875rem;
          color: #d4d4d8;
          font-size: 0.9rem;
        }

        .input-with-spinner {
          position: relative;
        }

        .spinner-inline {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 0.85rem;
        }

        .form-error-msg {
          font-size: 0.75rem;
          color: #ef4444;
          margin-top: 0.25rem;
        }

        .form-help-text {
          font-size: 0.75rem;
          color: #71717a;
          margin-top: 0.25rem;
        }

        .plan-summary-card {
          background: linear-gradient(135deg, rgba(234, 88, 12, 0.1) 0%, rgba(24, 24, 27, 0.8) 100%);
          border: 1px solid rgba(234, 88, 12, 0.3);
          border-radius: 12px;
          padding: 1.25rem;
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
          gap: 1.25rem;
        }

        .plan-summary-badge {
          background: #ea580c;
          color: #ffffff;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 0.25rem 0.65rem;
          border-radius: 6px;
        }

        .plan-summary-info h3 {
          font-size: 1.1rem;
          color: #ffffff;
          margin: 0 0 0.25rem 0;
        }

        .plan-summary-info p {
          font-size: 0.85rem;
          color: #a1a1aa;
          margin: 0;
        }

        .input-currency-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .currency-symbol {
          position: absolute;
          left: 12px;
          color: #a1a1aa;
          font-weight: 600;
        }

        .currency-input {
          padding-left: 2.5rem;
          font-size: 1.1rem;
          font-weight: 600;
          width: 100%;
        }

        .services-templates-section {
          margin-bottom: 1.5rem;
        }

        .section-small-title {
          font-size: 0.85rem;
          font-weight: 600;
          color: #d4d4d8;
          display: block;
          margin-bottom: 0.65rem;
        }

        .template-chips-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
        }

        .template-chip {
          background: #09090b;
          border: 1px solid #27272a;
          border-radius: 10px;
          padding: 0.65rem 1rem;
          text-align: left;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          transition: all 0.2s ease;
        }

        .template-chip:hover:not(:disabled) {
          border-color: #ea580c;
          background: rgba(234, 88, 12, 0.05);
        }

        .template-chip--added {
          border-color: #166534;
          background: rgba(34, 197, 94, 0.08);
          opacity: 0.7;
          cursor: default;
        }

        .template-chip__title {
          font-size: 0.875rem;
          font-weight: 600;
          color: #f4f4f5;
        }

        .template-chip__meta {
          font-size: 0.75rem;
          color: #a1a1aa;
        }

        .template-chip__badge {
          font-size: 0.7rem;
          color: #4ade80;
          font-weight: 600;
        }

        .custom-service-box {
          background: #09090b;
          border: 1px solid #27272a;
          border-radius: 12px;
          padding: 1.25rem;
          margin-bottom: 1.5rem;
        }

        .custom-service-form {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .flex-1 { flex: 1; min-width: 110px; }
        .flex-2 { flex: 2; min-width: 180px; }

        .btn-add-service {
          background: #27272a;
          color: #f4f4f5;
          border: 1px solid #3f3f46;
          border-radius: 8px;
          padding: 0 1.25rem;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .btn-add-service:hover {
          background: #ea580c;
          border-color: #ea580c;
        }

        .onboarding-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
          margin-top: 0.5rem;
        }

        .onboarding-table th {
          text-align: left;
          padding: 0.65rem 0.875rem;
          color: #a1a1aa;
          font-size: 0.75rem;
          text-transform: uppercase;
          border-bottom: 1px solid #27272a;
        }

        .onboarding-table td {
          padding: 0.75rem 0.875rem;
          border-bottom: 1px solid rgba(39, 39, 42, 0.4);
          color: #f4f4f5;
        }

        .badge-category {
          background: #27272a;
          color: #d4d4d8;
          font-size: 0.75rem;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          text-transform: capitalize;
        }

        .btn-remove-row {
          background: transparent;
          border: none;
          color: #ef4444;
          font-size: 0.75rem;
          cursor: pointer;
          padding: 0.2rem 0.4rem;
        }

        .btn-remove-row:hover {
          text-decoration: underline;
        }

        .services-empty-state {
          padding: 1.5rem;
          text-align: center;
          color: #71717a;
          font-size: 0.875rem;
          background: #09090b;
          border-radius: 8px;
        }

        .quota-status-card {
          background: #09090b;
          border: 1px solid #27272a;
          border-radius: 12px;
          padding: 1rem 1.25rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.25rem;
        }

        .quota-status-card--full {
          border-color: rgba(234, 88, 12, 0.4);
          background: rgba(234, 88, 12, 0.05);
        }

        .quota-status-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .quota-icon {
          font-size: 1.4rem;
        }

        .quota-plan-text {
          font-size: 0.75rem;
          color: #a1a1aa;
          margin: 0;
        }

        .quota-badge-full {
          background: rgba(234, 88, 12, 0.2);
          color: #fb923c;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.25rem 0.65rem;
          border-radius: 6px;
        }

        .manager-prompt-card {
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(24, 24, 27, 0.8) 100%);
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 12px;
          padding: 1rem 1.25rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.25rem;
          gap: 1rem;
        }

        .manager-prompt-card strong {
          color: #ffffff;
          font-size: 0.9rem;
          display: block;
        }

        .manager-prompt-card p {
          color: #a1a1aa;
          font-size: 0.8rem;
          margin: 0.2rem 0 0 0;
        }

        .btn-add-manager {
          background: #166534;
          color: #ffffff;
          border: none;
          border-radius: 8px;
          padding: 0.5rem 1rem;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.2s ease;
        }

        .btn-add-manager:hover {
          background: #22c55e;
        }

        .badge-manager {
          background: rgba(34, 197, 94, 0.15);
          color: #4ade80;
          font-size: 0.7rem;
          font-weight: 600;
          padding: 0.15rem 0.45rem;
          border-radius: 4px;
          margin-left: 0.5rem;
        }

        .cant-remove-tooltip {
          font-size: 0.7rem;
          color: #71717a;
        }

        .input-with-suffix {
          position: relative;
          display: flex;
          align-items: center;
        }

        .suffix {
          position: absolute;
          right: 12px;
          color: #71717a;
          font-size: 0.85rem;
        }

        .plan-upgrade-alert {
          background: rgba(234, 88, 12, 0.1);
          border: 1px solid rgba(234, 88, 12, 0.3);
          border-radius: 8px;
          padding: 1rem;
          color: #fb923c;
          font-size: 0.85rem;
          margin-bottom: 1.25rem;
        }

        .onboarding-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 2rem;
          padding-top: 1.5rem;
          border-top: 1px solid #27272a;
        }

        .btn-onboarding-primary {
          background: #ea580c;
          color: #ffffff;
          border: none;
          border-radius: 8px;
          padding: 0.75rem 1.5rem;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .btn-onboarding-primary:hover:not(:disabled) {
          background: #f97316;
        }

        .btn-onboarding-primary:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .btn-onboarding-secondary {
          background: transparent;
          color: #a1a1aa;
          border: 1px solid #27272a;
          border-radius: 8px;
          padding: 0.75rem 1.25rem;
          font-size: 0.9rem;
          cursor: pointer;
        }

        .btn-onboarding-secondary:hover:not(:disabled) {
          color: #ffffff;
          border-color: #3f3f46;
        }

        .btn-onboarding-finish {
          background: #16a34a;
          color: #ffffff;
          border: none;
          border-radius: 8px;
          padding: 0.75rem 1.75rem;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .btn-onboarding-finish:hover:not(:disabled) {
          background: #22c55e;
        }

        .btn-onboarding-finish:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        @media (max-width: 640px) {
          .onboarding-form-grid {
            grid-template-columns: 1fr;
          }
          .form-group.span-2 {
            grid-column: span 1;
          }
          .custom-service-form {
            flex-direction: column;
          }
          .stepper-desc {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};
