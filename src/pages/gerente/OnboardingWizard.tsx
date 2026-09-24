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

      // O gestor que se incluiu como barbeiro fica vinculado ao próprio login,
      // para não aparecer como profissional sem acesso em "Criar acesso".
      const { data: authData } = await supabase.auth.getUser();
      const managerUserId = authData?.user?.id ?? null;

      const profPayload = professionals.map((p) => ({
        tenant_id: tenant.tenantId,
        user_id: p.isManager ? managerUserId : null,
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
    <div
      className="min-h-screen bg-bg-primary text-text-primary font-base flex flex-col items-center pt-6 px-4 pb-12 box-border"
      data-testid="onboarding-wizard"
    >
      {/* Barra de Topo do Onboarding */}
      <header className="w-full max-w-[820px] flex justify-between items-center py-[0.85rem] px-5 bg-white border border-border rounded-lg shadow-sm mb-6">
        <div className="flex items-center gap-3">
          <img src="/simbolo.svg" alt="Navalhado" className="w-[38px] h-[38px]" />
          <div>
            <h1 className="text-[1.15rem] font-bold text-text-primary m-0 leading-[1.2]">Navalhado</h1>
            <span className="text-[0.82rem] text-text-secondary">{tenant?.tenantName || 'Minha Barbearia'}</span>
          </div>
        </div>
        <div className="bg-brand-lightest text-brand-primary border border-brand-soft py-[0.35rem] px-[0.85rem] rounded-full text-[0.82rem] font-semibold">
          Etapa {currentStep} de 4
        </div>
      </header>

      {/* Stepper Visual de 4 Etapas */}
      <div className="w-full max-w-[820px] mb-6">
        <div className="flex items-center justify-between bg-white border border-border py-4 px-6 rounded-lg shadow-sm max-[680px]:flex-col max-[680px]:gap-4 max-[680px]:items-start">
          {stepsList.map((s) => {
            const isCompleted = currentStep > s.num;
            const isCurrent = currentStep === s.num;

            return (
              <div key={s.num} className="flex items-center gap-[0.65rem] relative flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[0.88rem] border-2 transition-all duration-200 shrink-0 ${
                    isCurrent
                      ? 'bg-brand-primary text-white border-brand-primary shadow-[0_0_0_4px_rgba(217,108,0,0.15)]'
                      : isCompleted
                        ? 'bg-success text-white border-success'
                        : 'bg-[#F7EFEA] text-text-secondary border-border'
                  }`}
                >
                  {isCompleted ? '✓' : s.num}
                </div>
                <div className="flex flex-col">
                  <span className={`text-[0.88rem] font-semibold ${isCurrent ? 'text-text-primary font-bold' : 'text-text-secondary'}`}>
                    {s.title}
                  </span>
                  <span className="text-[0.72rem] text-text-secondary opacity-80">{s.desc}</span>
                </div>
                {s.num < 4 && (
                  <div className={`flex-1 h-0.5 mx-3 max-[680px]:hidden ${isCompleted ? 'bg-success' : 'bg-border'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Conteúdo Dinâmico da Etapa */}
      <div className="w-full max-w-[820px] bg-white border border-border rounded-xl p-9 shadow-md box-border">
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
    </div>
  );
};
