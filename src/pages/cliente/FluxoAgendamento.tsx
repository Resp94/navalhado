import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { Modal } from '../../components/Modal';
import { HugeiconsIcon } from '@hugeicons/react';
import { 
  Calendar02Icon, 
  Time01Icon, 
  UserIcon, 
  CancelCircleIcon, 
  AlertCircleIcon, 
  Tick01Icon, 
  ArrowRight01Icon,
  ArrowLeft01Icon,
  SparklesIcon,
  InformationCircleIcon
} from '@hugeicons/core-free-icons';

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  category: string;
  is_active: boolean;
}

interface Professional {
  id: string;
  name: string;
  phone: string;
  is_active: boolean;
}

interface CustomerDetails {
  customer_id: string;
  customer_name: string;
  tenant_id: string;
  tenant_name: string;
  tenant_phone: string;
}

export const FluxoAgendamento: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { token: routeToken } = useParams();
  const [searchParams] = useSearchParams();
  const { addToast } = useToast();

  // Estados de Dados do Estabelecimento
  const [customerDetails, setCustomerDetails] = useState<CustomerDetails | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados de Seleção do Fluxo
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<{ id: string | null; name: string } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  // Controle de Etapas
  const [etapa, setEtapa] = useState<1 | 2 | 3>(1);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleAppointmentId, setRescheduleAppointmentId] = useState<string | null>(null);

  // Estados de Abas de Categoria (Etapa 1)
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('');

  // Modal de Confirmação
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [booking, setBooking] = useState(false);

  // Carregar dados iniciais e tratar reagendamento
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const urlToken = searchParams.get('token') || routeToken;
        if (urlToken) {
          localStorage.setItem('navalhado_customer_token', urlToken);
          navigate('/cliente/agendar', { replace: true, state: location.state });
          return;
        }

        const token = localStorage.getItem('navalhado_customer_token');
        if (!token) {
          addToast('Acesso não autorizado. Redirecionando...', 'error');
          navigate('/cliente/acesso-expirado');
          return;
        }

        // 1. Carrega dados do cliente
        const { data: details, error: detailsError } = await supabase.rpc(
          'get_customer_details_by_token',
          { p_token: token }
        );

        if (detailsError || !details || details.length === 0) {
          throw new Error('Erro ao validar token');
        }

        const activeDetails = details[0] as CustomerDetails;
        setCustomerDetails(activeDetails);

        // Salva informações no localStorage para fallback
        localStorage.setItem('navalhado_tenant_name', activeDetails.tenant_name);
        localStorage.setItem('navalhado_tenant_phone', activeDetails.tenant_phone);

        // 2. Carrega serviços ativos da barbearia via RPC (evita problemas de RLS)
        const { data: dbServices, error: servicesError } = await supabase.rpc(
          'get_services_by_customer_token',
          { p_token: token }
        );

        if (servicesError) throw servicesError;

        setServices(dbServices || []);

        // Extrai categorias únicas
        const uniqueCategories = Array.from(new Set((dbServices || []).map(s => s.category)));
        setCategories(uniqueCategories);
        if (uniqueCategories.length > 0) {
          setActiveCategory(uniqueCategories[0]);
        }

        // 3. Carrega profissionais ativos da barbearia via RPC (evita problemas de RLS)
        const { data: dbProfessionals, error: profsError } = await supabase.rpc(
          'get_professionals_by_customer_token',
          { p_token: token }
        );

        if (profsError) throw profsError;
        setProfessionals(dbProfessionals || []);

        // 4. Se veio do Reagendamento via state do React Router
        if (location.state) {
          const stateData = location.state as {
            serviceId?: string;
            serviceName?: string;
            servicePrice?: number;
            serviceDuration?: number;
            professionalId?: string;
            professionalName?: string;
            rescheduleAppointmentId?: string;
          };

          if (stateData.rescheduleAppointmentId) {
            setIsRescheduling(true);
            setRescheduleAppointmentId(stateData.rescheduleAppointmentId);

            // Preenche pré-seleções
            if (stateData.serviceId) {
              const matchedService = (dbServices || []).find(s => s.id === stateData.serviceId);
              if (matchedService) {
                setSelectedService(matchedService);
              }
            }

            if (stateData.professionalId !== undefined) {
              setSelectedProfessional({
                id: stateData.professionalId,
                name: stateData.professionalName || 'Tanto faz'
              });
            }

            // Pula direto para a etapa 3 (seleção de data/hora)
            setEtapa(3);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar dados do fluxo:', err);
        navigate('/cliente/acesso-expirado');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [searchParams, navigate, location.state]);

  // Carregar slots de horários disponíveis quando mudamos data, profissional ou serviço na Etapa 3
  useEffect(() => {
    const fetchSlots = async () => {
      if (etapa !== 3 || !selectedService || !selectedDate) return;

      setLoadingSlots(true);
      setSelectedSlot(null); // Reseta slot selecionado ao mudar critérios
      
      try {
        const { data, error } = await supabase.rpc('get_available_slots', {
          p_tenant_id: customerDetails?.tenant_id,
          p_service_id: selectedService.id,
          p_professional_id: selectedProfessional?.id || null,
          p_date: selectedDate,
          p_exclude_appointment_id: rescheduleAppointmentId || null
        });

        if (error) throw error;
        
        // Mapeia o resultado para extrair a string do slot_time do objeto do PostgREST
        const slotsArray = data 
          ? (data as any[]).map(d => typeof d === 'object' && d !== null ? d.slot_time : d)
          : [];
          
        setAvailableSlots(slotsArray);
      } catch (err) {
        console.error('Erro ao carregar slots:', err);
        addToast('Erro ao carregar horários disponíveis.', 'error');
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchSlots();
  }, [etapa, selectedService, selectedProfessional, selectedDate, rescheduleAppointmentId, customerDetails]);

  // Seleções do usuário
  const handleSelectService = (service: Service) => {
    setSelectedService(service);
    setEtapa(2);
  };

  const handleSelectProfessional = (id: string | null, name: string) => {
    setSelectedProfessional({ id, name });
    setEtapa(3);
  };

  const handleSlotClick = (slot: string) => {
    setSelectedSlot(slot);
    setIsConfirmModalOpen(true);
  };

  // Executa o agendamento no Supabase
  const handleConfirmBooking = async () => {
    if (!selectedService || !selectedSlot || !customerDetails) return;
    const token = localStorage.getItem('navalhado_customer_token');
    if (!token) return;

    setBooking(true);
    try {
      if (isRescheduling && rescheduleAppointmentId) {
        // Fluxo de Reagendamento (Cria novo e cancela o antigo em transação segura rpc)
        const { data, error } = await supabase.rpc('reschedule_appointment_by_token', {
          p_token: token,
          p_old_appointment_id: rescheduleAppointmentId,
          p_new_service_id: selectedService.id,
          p_new_professional_id: selectedProfessional?.id || null,
          p_new_date: selectedDate,
          p_new_slot: selectedSlot
        });

        if (error) throw error;
        addToast('Reagendamento concluído com sucesso', 'success');
      } else {
        // Fluxo de Novo Agendamento comum
        const { data, error } = await supabase.rpc('create_appointment_by_token', {
          p_token: token,
          p_service_id: selectedService.id,
          p_professional_id: selectedProfessional?.id || null,
          p_date: selectedDate,
          p_slot: selectedSlot
        });

        if (error) throw error;
        addToast('Agendamento realizado com sucesso', 'success');
      }

      setIsConfirmModalOpen(false);
      navigate('/cliente/menu');
    } catch (err: any) {
      console.error('Erro ao agendar horário:', err);
      addToast(err.message || 'Erro ao realizar o agendamento.', 'error');
    } finally {
      setBooking(false);
    }
  };

  // Formatação de data amigável
  const formatFriendlyDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));

    const weekdays = [
      'Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'
    ];
    const months = [
      'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
    ];

    return `${weekdays[date.getDay()]}, ${date.getDate()} de ${months[date.getMonth()]}`;
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg-primary)',
        color: 'var(--color-brand-primary)'
      }}>
        <div style={{
          width: '44px',
          height: '44px',
          border: '3px solid var(--color-border)',
          borderTopColor: 'var(--color-brand-primary)',
          borderRadius: '50%',
          animation: 'spin 0.8s cubic-bezier(0.32, 0.72, 0, 1) infinite'
        }} />
      </div>
    );
  }

  const filteredServices = services.filter(s => s.category === activeCategory);

  return (
    <div style={{
      minHeight: '100vh',
      minHeight: '100dvh',
      backgroundColor: 'var(--color-bg-primary)',
      color: 'var(--color-text-primary)',
      fontFamily: 'var(--font-family-base)',
      paddingBottom: '4rem',
      background: 'radial-gradient(circle at top, rgba(217, 108, 0, 0.06) 0%, var(--color-bg-primary) 50%)'
    }}>
      {/* Header Compacto Premium */}
      <header style={{
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--color-border)',
        padding: '1.25rem 1.5rem',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 4px 30px rgba(45, 35, 30, 0.03)'
      }}>
        <div style={{
          maxWidth: '600px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}>
          {/* Botão Voltar Etapa */}
          {etapa > 1 && !isRescheduling && (
            <button
              onClick={() => setEtapa((prev) => (prev - 1) as 1 | 2 | 3)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px',
                borderRadius: '50%',
                backgroundColor: 'rgba(234, 222, 214, 0.25)'
              }}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={20} strokeWidth={2.5} />
            </button>
          )}

          {/* Botão Voltar para o Menu */}
          {((etapa === 1) || isRescheduling) && (
            <button
              onClick={() => navigate('/cliente/menu')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px',
                borderRadius: '50%',
                backgroundColor: 'rgba(234, 222, 214, 0.25)'
              }}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={20} strokeWidth={2.5} />
            </button>
          )}

          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              {isRescheduling ? 'Reagendar Horário' : 'Novo Agendamento'}
            </h1>
            <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '2px 0 0 0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {customerDetails?.tenant_name}
            </p>
          </div>
        </div>
      </header>

      {/* Barra de Progresso do Fluxo */}
      {!isRescheduling && (
        <div style={{
          maxWidth: '600px',
          margin: '1.5rem auto 0',
          padding: '0 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative'
        }}>
          {/* Linha de fundo */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '1.5rem',
            right: '1.5rem',
            height: '2px',
            backgroundColor: 'var(--color-border)',
            zIndex: 1,
            transform: 'translateY(-50%)'
          }} />

          {/* Linha ativa */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '1.5rem',
            width: etapa === 1 ? '0%' : etapa === 2 ? '50%' : '100%',
            height: '2px',
            backgroundColor: 'var(--color-brand-primary)',
            zIndex: 2,
            transform: 'translateY(-50%)'
          }} />

          {/* Etapas */}
          {[
            { label: 'Serviço', step: 1 },
            { label: 'Profissional', step: 2 },
            { label: 'Horário', step: 3 }
          ].map((item) => {
            const isActive = etapa >= item.step;
            const isCurrent = etapa === item.step;

            return (
              <div
                key={item.step}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.35rem',
                  position: 'relative',
                  zIndex: 3
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: isCurrent 
                    ? '#FFFFFF' 
                    : isActive 
                      ? 'var(--color-brand-primary)' 
                      : 'var(--color-bg-secondary)',
                  border: isCurrent 
                    ? '2px solid var(--color-brand-primary)' 
                    : isActive 
                      ? '2px solid var(--color-brand-primary)' 
                      : '2px solid var(--color-border)',
                  color: isCurrent 
                    ? 'var(--color-brand-primary)' 
                    : isActive 
                      ? '#FFFFFF' 
                      : 'var(--color-text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '13px',
                  boxShadow: '0 4px 10px rgba(45,35,30,0.04)'
                }}>
                  {item.step}
                </div>
                <span style={{
                  fontSize: '11px',
                  fontWeight: isActive ? 800 : 600,
                  color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'
                }}>
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Conteúdo do Fluxo */}
      <main style={{
        maxWidth: '600px',
        margin: '2rem auto',
        padding: '0 1.25rem'
      }}>
        {/* ETAPA 1: SELEÇÃO DE SERVIÇOS */}
        {etapa === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
              Selecione o Serviço
            </h2>

            {/* Abas Horizontais de Categoria (Glassmorphic Tray) */}
            {categories.length > 1 && (
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                overflowX: 'auto',
                paddingBottom: '0.25rem',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }} className="categories-scroll">
                {categories.map((cat) => {
                  const isActive = activeCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      style={{
                        padding: '8px 18px',
                        borderRadius: '9999px',
                        border: '1px solid',
                        borderColor: isActive ? 'var(--color-brand-primary)' : 'var(--color-border)',
                        backgroundColor: isActive ? 'var(--color-brand-primary)' : 'var(--color-bg-secondary)',
                        color: isActive ? '#FFFFFF' : 'var(--color-text-secondary)',
                        fontWeight: isActive ? 700 : 600,
                        fontSize: '13px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        boxShadow: isActive ? '0 4px 10px rgba(217, 108, 0, 0.15)' : 'none'
                      }}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Lista de Serviços */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {filteredServices.length === 0 ? (
                <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '2rem' }}>
                  Nenhum serviço nesta categoria.
                </p>
              ) : (
                filteredServices.map((service) => (
                  /* DOUBLE-BEZEL DESIGN FOR SERVICES */
                  <div
                    key={service.id}
                    onClick={() => handleSelectService(service)}
                    style={{
                      backgroundColor: 'rgba(234, 222, 214, 0.2)',
                      padding: '6px',
                      borderRadius: '24px',
                      border: '1px solid var(--color-border)',
                      cursor: 'pointer'
                    }}
                    className="service-card"
                  >
                    <div style={{
                      backgroundColor: 'var(--color-bg-secondary)',
                      borderRadius: 'calc(24px - 6px)',
                      padding: '1.25rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.8)',
                      border: '1px solid rgba(255,255,255,0.7)',
                      gap: '1rem'
                    }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text-primary)' }}>
                          {service.name}
                        </h3>
                        {service.description && (
                          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0 0 12px 0', lineHeight: 1.5 }}>
                            {service.description}
                          </p>
                        )}
                        <span style={{
                          fontSize: '11px',
                          backgroundColor: 'var(--color-brand-lightest)',
                          color: 'var(--color-brand-primary)',
                          padding: '4px 10px',
                          borderRadius: '9999px',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          border: '1px solid rgba(217, 108, 0, 0.1)'
                        }}>
                          <HugeiconsIcon icon={Time01Icon} size={12} color="var(--color-brand-primary)" />
                          {service.duration_minutes} min
                        </span>
                      </div>
                      
                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.625rem' }}>
                        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-brand-primary)' }}>
                          R$ {Number(service.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: 'var(--color-text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          backgroundColor: 'rgba(234, 222, 214, 0.25)',
                          padding: '6px 12px',
                          borderRadius: '9999px'
                        }} className="select-badge">
                          Escolher
                          <div style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            backgroundColor: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
                          }} className="arrow-circle">
                            <HugeiconsIcon icon={ArrowRight01Icon} size={12} strokeWidth={2.5} color="var(--color-text-secondary)" />
                          </div>
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ETAPA 2: SELEÇÃO DE PROFISSIONAL */}
        {etapa === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
              Selecione o Profissional
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Opção Tanto Faz (Double-Bezel) */}
              <div
                onClick={() => handleSelectProfessional(null, 'Tanto faz')}
                style={{
                  backgroundColor: 'rgba(234, 222, 214, 0.2)',
                  padding: '6px',
                  borderRadius: '24px',
                  border: '1px solid var(--color-border)',
                  cursor: 'pointer'
                }}
                className="professional-card"
              >
                <div style={{
                  backgroundColor: 'var(--color-bg-secondary)',
                  borderRadius: 'calc(24px - 6px)',
                  padding: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.8)',
                  border: '1px solid rgba(255,255,255,0.7)',
                  gap: '1rem'
                }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--color-brand-soft) 0%, var(--color-brand-primary) 100%)',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(217, 108, 0, 0.2)'
                  }}>
                    <HugeiconsIcon icon={SparklesIcon} size={22} strokeWidth={2} color="#FFFFFF" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                      Tanto faz
                    </h3>
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '2px 0 0 0', lineHeight: 1.4 }}>
                      Qualquer profissional qualificado disponível no horário
                    </p>
                  </div>
                  <HugeiconsIcon icon={ArrowRight01Icon} size={18} strokeWidth={2} color="var(--color-text-secondary)" />
                </div>
              </div>

              {/* Lista dos Profissionais (Double-Bezel) */}
              {professionals.length === 0 ? (
                <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '2rem' }}>
                  Nenhum profissional disponível.
                </p>
              ) : (
                professionals.map((prof) => (
                  <div
                    key={prof.id}
                    onClick={() => handleSelectProfessional(prof.id, prof.name)}
                    style={{
                      backgroundColor: 'rgba(234, 222, 214, 0.2)',
                      padding: '6px',
                      borderRadius: '24px',
                      border: '1px solid var(--color-border)',
                      cursor: 'pointer'
                    }}
                    className="professional-card"
                  >
                    <div style={{
                      backgroundColor: 'var(--color-bg-secondary)',
                      borderRadius: 'calc(24px - 6px)',
                      padding: '1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.8)',
                      border: '1px solid rgba(255,255,255,0.7)',
                      gap: '1rem'
                    }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--color-brand-lightest)',
                        border: '1px solid rgba(217, 108, 0, 0.15)',
                        color: 'var(--color-brand-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: 'var(--font-size-base)',
                        boxShadow: 'inset 0 2px 4px rgba(217, 108, 0, 0.05)'
                      }}>
                        {getInitials(prof.name)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                          {prof.name}
                        </h3>
                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '2px 0 0 0', lineHeight: 1.4 }}>
                          Especialista em barbearia clássica
                        </p>
                      </div>
                      <HugeiconsIcon icon={ArrowRight01Icon} size={18} strokeWidth={2} color="var(--color-text-secondary)" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ETAPA 3: DATA E HORA */}
        {etapa === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
              Selecione o Horário
            </h2>

            {/* Resumo Rápido (Double-Bezel style inside) */}
            <div style={{
              backgroundColor: 'rgba(234, 222, 214, 0.15)',
              border: '1px solid var(--color-border)',
              borderRadius: '16px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.625rem',
              fontSize: 'var(--font-size-sm)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>Serviço:</span>
                <strong style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>{selectedService?.name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>Profissional:</span>
                <strong style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>{selectedProfessional?.name}</strong>
              </div>
            </div>

            {/* Seletor de Data */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                Selecione o dia:
              </label>
              
              <div style={{ position: 'relative', width: '100%' }}>
                <input
                  type="date"
                  value={selectedDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={{
                    padding: '0.85rem 1rem 0.85rem 2.75rem',
                    borderRadius: '12px',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg-secondary)',
                    color: 'var(--color-text-primary)',
                    fontSize: 'var(--font-size-base)',
                    fontWeight: 700,
                    outline: 'none',
                    cursor: 'pointer',
                    width: '100%',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.01)',
                    fontFamily: 'inherit'
                  }}
                />
                <div style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  color: 'var(--color-text-secondary)',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <HugeiconsIcon icon={Calendar02Icon} size={18} strokeWidth={2} />
                </div>
              </div>

              <span style={{ fontSize: '11px', color: 'var(--color-brand-primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                <HugeiconsIcon icon={Tick01Icon} size={12} strokeWidth={2.5} color="var(--color-brand-primary)" />
                {formatFriendlyDate(selectedDate)}
              </span>
            </div>

            {/* Listagem de Horários Disponíveis */}
            <div>
              <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.85rem' }}>
                Horários disponíveis para este dia:
              </h3>

              {loadingSlots ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    border: '3px solid var(--color-border)',
                    borderTopColor: 'var(--color-brand-primary)',
                    borderRadius: '50%',
                    animation: 'spin 0.8s cubic-bezier(0.32, 0.72, 0, 1) infinite'
                  }} />
                </div>
              ) : availableSlots.length === 0 ? (
                /* Empty state: Double-Bezel */
                <div style={{
                  backgroundColor: 'rgba(234, 222, 214, 0.15)',
                  padding: '6px',
                  borderRadius: '20px',
                  border: '1px dashed var(--color-border)',
                }}>
                  <div style={{
                    backgroundColor: 'var(--color-bg-secondary)',
                    borderRadius: 'calc(20px - 6px)',
                    padding: '2.5rem 1.5rem',
                    textAlign: 'center',
                    color: 'var(--color-text-secondary)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <HugeiconsIcon icon={AlertCircleIcon} size={24} color="var(--color-text-secondary)" />
                    <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                      Nenhum horário disponível para a data selecionada. Tente outro dia ou profissional.
                    </p>
                  </div>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
                  gap: '0.625rem'
                }}>
                  {availableSlots.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => handleSlotClick(slot)}
                      style={{
                        padding: '12px 0',
                        borderRadius: '12px',
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-bg-secondary)',
                        color: 'var(--color-text-primary)',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(45,35,30,0.02)'
                      }}
                      className="slot-btn"
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modal de Confirmação Final */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Confirmar Agendamento"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', color: 'var(--color-text-primary)' }}>
          <p style={{ margin: 0, fontSize: 'var(--font-size-base)', lineHeight: 1.5 }}>
            Confirme as informações abaixo para finalizar o seu agendamento na barbearia.
          </p>

          <div style={{
            backgroundColor: 'rgba(234, 222, 214, 0.2)',
            borderRadius: '20px',
            border: '1px solid var(--color-border)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)', opacity: 0.8 }}>
                Serviço
              </span>
              <strong style={{ fontSize: 'var(--font-size-base)', fontWeight: 800 }}>
                {selectedService?.name}
              </strong>
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <HugeiconsIcon icon={Time01Icon} size={14} color="var(--color-text-secondary)" />
                R$ {Number(selectedService?.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} • {selectedService?.duration_minutes} minutos
              </span>
            </div>

            <div style={{ height: '1px', backgroundColor: 'var(--color-border)' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)', opacity: 0.8 }}>
                Profissional
              </span>
              <strong style={{ fontSize: 'var(--font-size-base)', fontWeight: 800 }}>
                {selectedProfessional?.name}
              </strong>
            </div>

            <div style={{ height: '1px', backgroundColor: 'var(--color-border)' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)', opacity: 0.8 }}>
                Horário Escolhido
              </span>
              <strong style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-brand-primary)', fontWeight: 800 }}>
                {formatFriendlyDate(selectedDate)} às {selectedSlot}
              </strong>
            </div>
          </div>

          {isRescheduling && (
            <div style={{
              backgroundColor: 'var(--color-warning-bg)',
              border: '1px solid rgba(217, 119, 6, 0.2)',
              borderRadius: '12px',
              padding: '1rem',
              fontSize: '13px',
              color: 'var(--color-warning)',
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-start',
              lineHeight: 1.4
            }}>
              <HugeiconsIcon icon={AlertCircleIcon} size={18} strokeWidth={2.5} style={{ marginTop: '2px' }} />
              <span>
                <strong>Atenção:</strong> Ao confirmar, seu horário anterior será cancelado automaticamente.
              </span>
            </div>
          )}

          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            marginTop: '0.5rem'
          }}>
            <button
              onClick={() => setIsConfirmModalOpen(false)}
              disabled={booking}
              style={{
                backgroundColor: 'transparent',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
                padding: '10px 20px',
                borderRadius: '9999px',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Voltar
            </button>
            <button
              onClick={handleConfirmBooking}
              disabled={booking}
              style={{
                backgroundColor: 'var(--color-brand-primary)',
                color: '#FFFFFF',
                border: 'none',
                padding: '10px 24px',
                borderRadius: '9999px',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(217, 108, 0, 0.2)'
              }}
            >
              {booking ? 'Confirmando...' : 'Confirmar e Agendar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Estilos locais */}
      <style>{`
        .service-card:hover {
          border-color: var(--color-brand-primary) !important;
        }
        .service-card:hover .select-badge {
          background-color: var(--color-brand-primary) !important;
          color: #FFFFFF !important;
        }
        .service-card:hover .arrow-circle svg {
          color: var(--color-brand-primary) !important;
        }
        .professional-card:hover {
          border-color: var(--color-brand-primary) !important;
        }
        .slot-btn:hover {
          border-color: var(--color-brand-primary) !important;
          background-color: var(--color-brand-lightest) !important;
          color: var(--color-brand-primary) !important;
        }
        .categories-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};
