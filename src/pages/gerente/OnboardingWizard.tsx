import React, { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useToast } from '../../components/Toast';
import { supabase } from '../../lib/supabase';
import { StepLocation } from './onboarding/StepLocation';
import { StepProfessionals } from './onboarding/StepProfessionals';
import { StepSegmentation } from './onboarding/StepSegmentation';
import { StepServices } from './onboarding/StepServices';
import type {
  OnboardingLocation,
  OnboardingProfessional,
  OnboardingSegmentation,
  OnboardingService,
} from './onboarding/types';

interface GerenteOutletContext {
  tenantId: string;
  tenantName: string;
  logoUrl: string | null;
  timezone: string;
  onboardingCompleted: boolean;
}

export const OnboardingWizard: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const tenant = useOutletContext<GerenteOutletContext>();

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [submitting, setSubmitting] = useState(false);
  const [planName, setPlanName] = useState<string>('Bronze');
  const [maxProfessionals, setMaxProfessionals] = useState<number>(3);
  const [managerName, setManagerName] = useState<string>('');
  const [managerPhone, setManagerPhone] = useState<string>('');

  // Passo 1: Localização
  const [location, setLocation] = useState<OnboardingLocation>({
    country: 'BR',
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    latitude: null,
    longitude: null,
  });

  // Passo 2: Segmentação Comercial
  const [segmentation, setSegmentation] = useState<OnboardingSegmentation>({
    baseCutPrice: 0,
    acquisitionChannel: '',
  });

  // Passo 3: Serviços
  const [services, setServices] = useState<OnboardingService[]>([]);

  // Passo 4: Profissionais
  const [professionals, setProfessionals] = useState<OnboardingProfessional[]>([]);

  // Carregar dados iniciais do gestor e do plano
  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          const { data: userData } = await supabase
            .from('users')
            .select('name')
            .eq('id', authData.user.id)
            .single();

          if (userData && isMounted) {
            setManagerName(userData.name || '');
          }
        }

        if (tenant?.tenantId) {
          const { data: tenantData } = await supabase
            .from('tenants')
            .select('phone')
            .eq('id', tenant.tenantId)
            .single();

          if (tenantData && isMounted) {
            setManagerPhone(tenantData.phone || '');
          }

          const { data: subData } = await supabase
            .from('tenant_subscriptions')
            .select('plans(name, max_professionals)')
            .eq('tenant_id', tenant.tenantId)
            .single();

          if (subData && subData.plans && isMounted) {
            const plan = subData.plans as any;
            setPlanName(plan.name || 'Bronze');
            setMaxProfessionals(plan.max_professionals || 3);
          }
        }
      } catch {
        // Silently continue
      }
    }

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, [tenant?.tenantId]);

  // Manipuladores de Serviços
  const handleAddService = (service: Omit<OnboardingService, 'id'>) => {
    const newService: OnboardingService = {
      ...service,
      id: crypto.randomUUID(),
    };
    setServices((prev) => [...prev, newService]);
  };

  const handleRemoveService = (id: string) => {
    setServices((prev) => prev.filter((s) => s.id !== id));
  };

  // Manipuladores de Profissionais
  const handleAddProfessional = (prof: Omit<OnboardingProfessional, 'id'>) => {
    const newProf: OnboardingProfessional = {
      ...prof,
      id: crypto.randomUUID(),
    };
    setProfessionals((prev) => [...prev, newProf]);
  };

  const handleRemoveProfessional = (id: string) => {
    if (professionals.length <= 1) {
      addToast('A barbearia precisa ter pelo menos 1 profissional ativo.', 'warning');
      return;
    }
    setProfessionals((prev) => prev.filter((p) => p.id !== id));
  };

  // Finalização Atômica do Wizard
  const handleFinish = async () => {
    if (!tenant?.tenantId) {
      addToast('Erro ao identificar estabelecimento. Tente recarregar a página.', 'error');
      return;
    }

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
      navigate('/agenda');
    } catch (err: any) {
      addToast(err.message || 'Erro ao finalizar configuração. Tente novamente.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const stepsList = [
    { num: 1, title: 'Endereço', desc: 'Onde fica o salão' },
    { num: 2, title: 'Preço Base', desc: 'Valor do corte e origem' },
    { num: 3, title: 'Serviços', desc: 'Cardápio inicial' },
    { num: 4, title: 'Equipe', desc: 'Barbeiros da casa' },
  ];

  return (
    <div className="onboarding-wrapper" data-testid="onboarding-wizard">
      {/* Barra de Topo do Onboarding */}
      <header className="onboarding-top-bar">
        <div className="onboarding-brand">
          <img src="/simbolo.svg" alt="Navalhado" className="onboarding-logo" />
          <div>
            <h1 className="onboarding-brand-title">Navalhado</h1>
            <span className="onboarding-tenant-name">{tenant?.tenantName || 'Minha Barbearia'}</span>
          </div>
        </div>
        <div className="onboarding-badge-step">
          Etapa {currentStep} de 4
        </div>
      </header>

      {/* Stepper Visual de 4 Etapas */}
      <div className="onboarding-stepper-container">
        <div className="onboarding-stepper">
          {stepsList.map((s) => {
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
            onChange={(upd) => setLocation((prev: OnboardingLocation) => ({ ...prev, ...upd }))}
            onNext={() => setCurrentStep(2)}
          />
        )}

        {currentStep === 2 && (
          <StepSegmentation
            data={segmentation}
            planName={planName}
            maxProfessionals={maxProfessionals}
            onChange={(upd) => setSegmentation((prev: OnboardingSegmentation) => ({ ...prev, ...upd }))}
            onNext={() => {
              if (services.length === 0) {
                const initialPrice = segmentation.baseCutPrice > 0 ? segmentation.baseCutPrice : 35;
                setServices([
                  {
                    id: crypto.randomUUID(),
                    name: 'Corte Tradicional',
                    price: initialPrice,
                    durationMinutes: 30,
                    category: 'Cabelo',
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

      {/* Estilos Completos em Tema Claro Alinhados ao Design System */}
      <style>{`
        .onboarding-wrapper {
          min-height: 100vh;
          background-color: var(--color-bg-primary, #FFF1E6);
          color: var(--color-text-primary, #2D231E);
          font-family: var(--font-family-base, 'Outfit', sans-serif);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 1.5rem 1rem 3rem 1rem;
          box-sizing: border-box;
        }

        .onboarding-top-bar {
          width: 100%;
          max-width: 820px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.85rem 1.25rem;
          background: #FFFFFF;
          border: 1px solid var(--color-border, #EADED6);
          border-radius: var(--radius-lg, 12px);
          box-shadow: var(--shadow-sm, 0 1px 3px rgba(45, 35, 30, 0.05));
          margin-bottom: 1.5rem;
        }

        .onboarding-brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .onboarding-logo {
          width: 38px;
          height: 38px;
        }

        .onboarding-brand-title {
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--color-text-primary, #2D231E);
          margin: 0;
          line-height: 1.2;
        }

        .onboarding-tenant-name {
          font-size: 0.82rem;
          color: var(--color-text-secondary, #70625B);
        }

        .onboarding-badge-step {
          background: var(--color-brand-lightest, #FFF1E6);
          color: var(--color-brand-primary, #D96C00);
          border: 1px solid var(--color-brand-soft, #F2B277);
          padding: 0.35rem 0.85rem;
          border-radius: var(--radius-full, 9999px);
          font-size: 0.82rem;
          font-weight: 600;
        }

        /* Stepper */
        .onboarding-stepper-container {
          width: 100%;
          max-width: 820px;
          margin-bottom: 1.5rem;
        }

        .onboarding-stepper {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #FFFFFF;
          border: 1px solid var(--color-border, #EADED6);
          padding: 1rem 1.5rem;
          border-radius: var(--radius-lg, 12px);
          box-shadow: var(--shadow-sm, 0 1px 3px rgba(45, 35, 30, 0.05));
        }

        .stepper-item {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          position: relative;
          flex: 1;
        }

        .stepper-circle {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #F7EFEA;
          color: var(--color-text-secondary, #70625B);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.88rem;
          border: 2px solid var(--color-border, #EADED6);
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .stepper-item--current .stepper-circle {
          background: var(--color-brand-primary, #D96C00);
          color: #FFFFFF;
          border-color: var(--color-brand-primary, #D96C00);
          box-shadow: 0 0 0 4px rgba(217, 108, 0, 0.15);
        }

        .stepper-item--completed .stepper-circle {
          background: var(--color-success, #0E9F6E);
          color: #FFFFFF;
          border-color: var(--color-success, #0E9F6E);
        }

        .stepper-labels {
          display: flex;
          flex-direction: column;
        }

        .stepper-title {
          font-size: 0.88rem;
          font-weight: 600;
          color: var(--color-text-secondary, #70625B);
        }

        .stepper-item--current .stepper-title {
          color: var(--color-text-primary, #2D231E);
          font-weight: 700;
        }

        .stepper-desc {
          font-size: 0.72rem;
          color: var(--color-text-secondary, #70625B);
          opacity: 0.8;
        }

        .stepper-line {
          flex: 1;
          height: 2px;
          background: var(--color-border, #EADED6);
          margin: 0 0.75rem;
        }

        .stepper-item--completed .stepper-line {
          background: var(--color-success, #0E9F6E);
        }

        /* Card Container Principal */
        .onboarding-card-box {
          width: 100%;
          max-width: 820px;
          background: #FFFFFF;
          border: 1px solid var(--color-border, #EADED6);
          border-radius: var(--radius-xl, 16px);
          padding: 2.25rem;
          box-shadow: var(--shadow-md, 0 4px 12px rgba(45, 35, 30, 0.08));
          box-sizing: border-box;
        }

        .step-pill {
          display: inline-block;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--color-brand-primary, #D96C00);
          background: var(--color-brand-lightest, #FFF1E6);
          padding: 0.25rem 0.6rem;
          border-radius: var(--radius-sm, 4px);
          margin-bottom: 0.5rem;
        }

        .onboarding-step-header h2 {
          font-size: 1.45rem;
          font-weight: 700;
          color: var(--color-text-primary, #2D231E);
          margin: 0 0 0.5rem 0;
          line-height: 1.3;
        }

        .onboarding-step-subtitle {
          font-size: 0.92rem;
          color: var(--color-text-secondary, #70625B);
          margin: 0 0 1.75rem 0;
          line-height: 1.5;
        }

        /* Grid de Formulários */
        .onboarding-form-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 1.15rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .form-group--full {
          width: 100%;
        }

        .form-group--half {
          width: calc(50% - 0.6rem);
        }

        .form-group--3-4 {
          width: calc(75% - 0.6rem);
        }

        .form-group--1-4 {
          width: calc(25% - 0.6rem);
        }

        .flex-1 { flex: 1; }
        .flex-2 { flex: 2; }

        .form-label {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--color-text-primary, #2D231E);
        }

        .form-label-opt {
          font-weight: 400;
          color: var(--color-text-secondary, #70625B);
          font-size: 0.78rem;
        }

        .text-required {
          color: var(--color-brand-primary, #D96C00);
        }

        .form-input,
        .form-select {
          width: 100%;
          height: 44px;
          padding: 0 0.9rem;
          background: #FFFFFF;
          border: 1.5px solid var(--color-border, #EADED6);
          border-radius: var(--radius-md, 8px);
          color: var(--color-text-primary, #2D231E);
          font-size: 0.92rem;
          font-family: inherit;
          box-sizing: border-box;
          transition: all 0.2s ease;
        }

        .form-input:focus,
        .form-select:focus {
          outline: none;
          border-color: var(--color-brand-primary, #D96C00);
          box-shadow: 0 0 0 3px rgba(217, 108, 0, 0.12);
        }

        .form-input--error {
          border-color: var(--color-error, #F05252);
        }

        .form-error {
          font-size: 0.78rem;
          color: var(--color-error, #F05252);
          margin-top: 0.2rem;
        }

        .form-hint {
          font-size: 0.78rem;
          color: var(--color-text-secondary, #70625B);
          line-height: 1.4;
          margin-top: 0.2rem;
        }

        .input-country-fixed {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          height: 44px;
          padding: 0 0.9rem;
          background: #FDF9F6;
          border: 1.5px solid var(--color-border, #EADED6);
          border-radius: var(--radius-md, 8px);
          font-size: 0.92rem;
          font-weight: 500;
        }

        .country-badge {
          margin-left: auto;
          font-size: 0.72rem;
          background: #EAE0D8;
          color: var(--color-text-secondary, #70625B);
          padding: 0.15rem 0.45rem;
          border-radius: var(--radius-sm, 4px);
        }

        .input-with-loading {
          position: relative;
        }

        .spinner-sm {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 1rem;
        }

        .currency-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .currency-prefix {
          position: absolute;
          left: 14px;
          font-weight: 700;
          color: var(--color-brand-primary, #D96C00);
          font-size: 1.1rem;
        }

        .currency-input {
          padding-left: 2.75rem !important;
          font-size: 1.15rem !important;
          font-weight: 700 !important;
          height: 48px !important;
        }

        .input-with-suffix {
          position: relative;
          display: flex;
          align-items: center;
        }

        .suffix {
          position: absolute;
          right: 12px;
          font-weight: 600;
          color: var(--color-text-secondary, #70625B);
        }

        /* Card de Plano */
        .plan-summary-card {
          background: linear-gradient(135deg, #FFF9F5 0%, #FFF2E8 100%);
          border: 1.5px solid var(--color-brand-soft, #F2B277);
          border-radius: var(--radius-lg, 12px);
          padding: 1.25rem 1.5rem;
          position: relative;
        }

        .plan-summary-card__badge {
          position: absolute;
          top: -10px;
          right: 18px;
          background: var(--color-brand-primary, #D96C00);
          color: #FFFFFF;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          padding: 0.2rem 0.6rem;
          border-radius: var(--radius-full, 9999px);
        }

        .plan-summary-card__title {
          font-size: 1.2rem;
          font-weight: 700;
          color: var(--color-text-primary, #2D231E);
          margin: 0 0 0.25rem 0;
        }

        .plan-summary-card__desc {
          font-size: 0.85rem;
          color: var(--color-text-secondary, #70625B);
          margin: 0;
        }

        .quota-tag {
          display: inline-block;
          margin-top: 0.75rem;
          background: #FFFFFF;
          border: 1px solid var(--color-border, #EADED6);
          padding: 0.4rem 0.85rem;
          border-radius: var(--radius-md, 8px);
          font-size: 0.82rem;
          color: var(--color-text-primary, #2D231E);
        }

        /* Templates de Serviços */
        .section-small-title {
          display: block;
          font-size: 0.88rem;
          font-weight: 700;
          color: var(--color-text-primary, #2D231E);
          margin-bottom: 0.75rem;
        }

        .template-chips-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }

        .template-chip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #FFFFFF;
          border: 1.5px solid var(--color-border, #EADED6);
          border-radius: var(--radius-md, 8px);
          padding: 0.75rem 0.9rem;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
        }

        .template-chip:hover:not(:disabled) {
          border-color: var(--color-brand-primary, #D96C00);
          background: #FFFBF8;
          transform: translateY(-2px);
          box-shadow: var(--shadow-sm, 0 2px 6px rgba(217, 108, 0, 0.1));
        }

        .template-chip--added {
          background: var(--color-success-bg, #E6F4EA) !important;
          border-color: var(--color-success, #0E9F6E) !important;
          cursor: default;
        }

        .template-chip__left {
          display: flex;
          align-items: center;
          gap: 0.65rem;
        }

        .template-chip__icon {
          font-size: 1.25rem;
        }

        .template-chip__title {
          display: block;
          font-size: 0.88rem;
          font-weight: 700;
          color: var(--color-text-primary, #2D231E);
        }

        .template-chip__meta {
          display: block;
          font-size: 0.78rem;
          color: var(--color-text-secondary, #70625B);
        }

        .template-chip__action {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--color-brand-primary, #D96C00);
        }

        .template-chip--added .template-chip__action {
          color: var(--color-success, #0E9F6E);
        }

        /* Lista / Tabela de Serviços */
        .services-list-container {
          background: #FAFAFA;
          border: 1px solid var(--color-border, #EADED6);
          border-radius: var(--radius-lg, 12px);
          padding: 1.25rem;
          margin-bottom: 1.5rem;
        }

        .services-list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .services-list-title {
          font-size: 1rem;
          font-weight: 700;
          color: var(--color-text-primary, #2D231E);
          margin: 0;
        }

        .services-table-wrapper {
          overflow-x: auto;
        }

        .services-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .services-table th {
          font-size: 0.78rem;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--color-text-secondary, #70625B);
          padding: 0.6rem 0.85rem;
          border-bottom: 1.5px solid var(--color-border, #EADED6);
        }

        .services-table td {
          padding: 0.75rem 0.85rem;
          font-size: 0.88rem;
          border-bottom: 1px solid #EFEAE6;
          background: #FFFFFF;
        }

        .service-row-name {
          color: var(--color-text-primary, #2D231E);
        }

        .service-category-badge {
          background: #F4ECE6;
          padding: 0.2rem 0.5rem;
          border-radius: var(--radius-sm, 4px);
          font-size: 0.75rem;
          font-weight: 600;
        }

        .service-duration-badge {
          background: #EBF5FF;
          color: #1E429F;
          padding: 0.2rem 0.55rem;
          border-radius: var(--radius-sm, 4px);
          font-size: 0.75rem;
          font-weight: 600;
        }

        .service-price-value {
          color: var(--color-brand-primary, #D96C00);
          font-weight: 700;
        }

        .btn-icon-delete {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 1.1rem;
          opacity: 0.6;
          transition: opacity 0.2s;
        }

        .btn-icon-delete:hover {
          opacity: 1;
        }

        .empty-services-alert {
          text-align: center;
          padding: 2rem 1rem;
          color: var(--color-text-secondary, #70625B);
          font-size: 0.9rem;
        }

        /* Formulário Customizado */
        .custom-service-form {
          background: #FFFFFF;
          border: 1.5px solid var(--color-border, #EADED6);
          border-radius: var(--radius-md, 8px);
          padding: 1.25rem;
          margin-bottom: 1.5rem;
        }

        .custom-service-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .custom-service-header h4 {
          margin: 0;
          font-size: 0.95rem;
          font-weight: 700;
        }

        .custom-service-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 0.85rem;
        }

        .custom-service-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.65rem;
          margin-top: 1rem;
        }

        /* Cota e Equipe */
        .quota-status-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #FFF9F5;
          border: 1.5px solid var(--color-brand-soft, #F2B277);
          border-radius: var(--radius-md, 8px);
          padding: 1rem 1.25rem;
          margin-bottom: 1.25rem;
        }

        .quota-status-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .quota-icon {
          font-size: 1.5rem;
        }

        .quota-count-title {
          font-size: 0.95rem;
          color: var(--color-text-primary, #2D231E);
        }

        .quota-plan-text {
          margin: 0;
          font-size: 0.78rem;
          color: var(--color-text-secondary, #70625B);
        }

        .quota-badge-open {
          background: var(--color-success-bg, #E6F4EA);
          color: var(--color-success, #0E9F6E);
          font-size: 0.75rem;
          font-weight: 700;
          padding: 0.25rem 0.65rem;
          border-radius: var(--radius-full, 9999px);
        }

        .quota-badge-full {
          background: var(--color-warning-bg, #FEF3C7);
          color: var(--color-warning, #D97706);
          font-size: 0.75rem;
          font-weight: 700;
          padding: 0.25rem 0.65rem;
          border-radius: var(--radius-full, 9999px);
        }

        .manager-prompt-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #F4FBF7;
          border: 1px dashed var(--color-success, #0E9F6E);
          border-radius: var(--radius-md, 8px);
          padding: 1rem 1.25rem;
          margin-bottom: 1.25rem;
        }

        .manager-prompt-card__text {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .manager-prompt-card__text p {
          margin: 0;
          font-size: 0.8rem;
          color: var(--color-text-secondary, #70625B);
        }

        .manager-icon {
          font-size: 1.35rem;
        }

        .add-barber-box {
          background: #FFFFFF;
          border: 1.5px solid var(--color-border, #EADED6);
          border-radius: var(--radius-md, 8px);
          padding: 1.25rem;
          margin-bottom: 1.25rem;
        }

        .add-barber-form {
          display: flex;
          gap: 0.75rem;
        }

        .badge-manager {
          margin-left: 0.5rem;
          font-size: 0.7rem;
          background: #FFF1E6;
          color: var(--color-brand-primary, #D96C00);
          border: 1px solid var(--color-brand-soft, #F2B277);
          padding: 0.1rem 0.4rem;
          border-radius: var(--radius-sm, 4px);
        }

        .tag-required {
          font-size: 0.72rem;
          color: var(--color-text-secondary, #70625B);
          background: #EAE0D8;
          padding: 0.15rem 0.45rem;
          border-radius: var(--radius-sm, 4px);
        }

        /* Botões Globais */
        .onboarding-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 2rem;
          padding-top: 1.5rem;
          border-top: 1px solid var(--color-border, #EADED6);
        }

        .onboarding-actions__info {
          font-size: 0.78rem;
          color: var(--color-text-secondary, #70625B);
        }

        .btn-primary {
          background: var(--color-brand-primary, #D96C00);
          color: #FFFFFF;
          border: none;
          font-weight: 700;
          font-size: 0.92rem;
          font-family: inherit;
          padding: 0.65rem 1.25rem;
          border-radius: var(--radius-md, 8px);
          cursor: pointer;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .btn-primary:hover:not(:disabled) {
          background: var(--color-brand-hover, #9C3F00);
          transform: translateY(-1px);
          box-shadow: var(--shadow-sm, 0 3px 8px rgba(217, 108, 0, 0.25));
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: #FFFFFF;
          color: var(--color-text-primary, #2D231E);
          border: 1.5px solid var(--color-border, #EADED6);
          font-weight: 600;
          font-size: 0.92rem;
          font-family: inherit;
          padding: 0.65rem 1.25rem;
          border-radius: var(--radius-md, 8px);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #FDF9F6;
          border-color: #D3C4B8;
        }

        .btn-outline-primary {
          background: #FFFFFF;
          color: var(--color-brand-primary, #D96C00);
          border: 1.5px solid var(--color-brand-soft, #F2B277);
          font-weight: 700;
          font-size: 0.85rem;
          padding: 0.45rem 0.85rem;
          border-radius: var(--radius-md, 8px);
          cursor: pointer;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          line-height: 1;
        }

        .btn-outline-primary svg,
        .btn-outline-primary .hugeicons-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .btn-outline-primary:hover {
          background: #FFF1E6;
        }

        .btn-link-sm {
          background: none;
          border: none;
          color: var(--color-text-secondary, #70625B);
          font-size: 0.8rem;
          cursor: pointer;
          text-decoration: underline;
        }

        .btn-lg {
          height: 48px;
          padding: 0 1.65rem;
          font-size: 0.98rem;
        }

        .btn-sm {
          height: 36px;
          padding: 0 0.85rem;
          font-size: 0.82rem;
        }

        .btn-finish {
          background: var(--color-success, #0E9F6E) !important;
        }

        .btn-finish:hover:not(:disabled) {
          background: #097A54 !important;
        }

        @media (max-width: 680px) {
          .onboarding-stepper {
            flex-direction: column;
            gap: 1rem;
            align-items: flex-start;
          }
          .stepper-line { display: none; }
          .form-group--half, .form-group--3-4, .form-group--1-4 {
            width: 100%;
          }
          .add-barber-form {
            flex-direction: column;
          }
          .onboarding-actions {
            flex-direction: column-reverse;
            gap: 0.75rem;
          }
          .onboarding-actions button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};
