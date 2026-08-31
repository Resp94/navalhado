import '../../components/cliente/cliente.css';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useToast } from '../../components/Toast';
import { useCanalCliente } from '../../modules/canal-cliente/useCanalCliente';
import type {
  ContextoPublicoCanal,
  HorarioGradeCanal,
  PerfilClienteCanal,
  ServicoCanal,
  ProfissionalCanal,
} from '../../modules/canal-cliente/types';
import { AgendamentoRegraCancelamentoError } from '../../modules/canal-cliente/errors';
import { dateInZone, formatTimeInZone, isSlotViableForToday, shiftCalendarDate } from '../../lib/timezone';
import { maskPhone } from '../../lib/whatsapp';
import { getDayBusinessHours } from '../gerente/Agenda';

// Novos componentes modulares baseados no Penpot
import { CatalogoServicosHeader } from '../../components/cliente/CatalogoServicosHeader';
import { ClienteBottomNav } from '../../components/cliente/ClienteBottomNav';
import { ServicoCard } from '../../components/cliente/ServicoCard';
import { ModalSelecaoDias } from '../../components/cliente/ModalSelecaoDias';
import { ModalSelecaoHorarios } from '../../components/cliente/ModalSelecaoHorarios';
import { ModalResumoAgendamento } from '../../components/cliente/ModalResumoAgendamento';
import { ModalIdentificacaoCliente } from '../../components/cliente/ModalIdentificacaoCliente';

const PUBLIC_TOKEN_STORAGE_PREFIX = 'navalhado_canal_cliente_v1_token_';
const publicTokenStorageKey = (slug: string): string =>
  `${PUBLIC_TOKEN_STORAGE_PREFIX}${encodeURIComponent(slug.trim().toLowerCase())}`;

export const FluxoAgendamento: React.FC = () => {
  const { state: locationState } = useLocation();
  const navigate = useNavigate();
  const { token: routeToken, slug: routeSlug } = useParams();
  const [searchParams] = useSearchParams();
  const publicSlug = routeSlug || searchParams.get('tenant');
  const turnstileSiteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim();
  const { addToast } = useToast();

  // Estados de Dados do Estabelecimento
  const [customerDetails, setCustomerDetails] = useState<PerfilClienteCanal | null>(null);
  const [publicContext, setPublicContext] = useState<ContextoPublicoCanal | null>(null);
  const [services, setServices] = useState<ServicoCanal[]>([]);
  const [professionals, setProfessionals] = useState<ProfissionalCanal[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados de Seleção do Fluxo
  const [selectedService, setSelectedService] = useState<ServicoCanal | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<{ id: string | null; name: string } | null>(null);
  const [baseTodayDate, setBaseTodayDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [, setPublicSchedule] = useState<HorarioGradeCanal[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  // Controle de Modais
  const [isDaysModalOpen, setIsDaysModalOpen] = useState(false);
  const [isTimesModalOpen, setIsTimesModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isManagementModalOpen, setIsManagementModalOpen] = useState(false);
  const [startingManagementSession, setStartingManagementSession] = useState(false);

  // Reagendamento
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleAppointmentId, setRescheduleAppointmentId] = useState<string | null>(null);

  // Categorias
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('Todos');

  const filteredServices = useMemo(() => {
    if (!activeCategory || activeCategory === 'Todos') {
      return services;
    }
    return services.filter((s) => s.category === activeCategory);
  }, [services, activeCategory]);

  // Identificação e Submissão
  const [booking, setBooking] = useState(false);
  const [canonicalToken, setCanonicalToken] = useState<string | null>(() =>
    routeToken || searchParams.get('token') || (routeSlug ? (typeof window !== 'undefined' && window.localStorage ? localStorage.getItem(publicTokenStorageKey(routeSlug)) : null) : (typeof window !== 'undefined' && window.localStorage ? localStorage.getItem('navalhado_customer_token') : null))
  );
  const [clientFullName, setClientFullName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [, setRecognizedCustomer] = useState<{ id: string; name: string } | null>(null);
  const [publicSessionAuthenticated, setPublicSessionAuthenticated] = useState(false);

  const canalClienteRepository = useCanalCliente();

  const resolvePublicIdentity = useCallback(async (name: string, phone: string) => {
    if (!publicSlug || canonicalToken) return;

    const trimmedName = name.trim();
    const normalizedPhone = phone.replace(/\D/g, '');
    if (trimmedName.split(/\s+/).filter(Boolean).length < 2 || normalizedPhone.length < 10) {
      return;
    }

    try {
      const lookup = await canalClienteRepository.resolverIdentidadePublica(
        publicSlug,
        trimmedName,
        normalizedPhone,
      );
      if (lookup?.found && lookup.customer_id && lookup.customer_name) {
        setRecognizedCustomer({ id: lookup.customer_id, name: lookup.customer_name });
        setClientFullName(lookup.customer_name);
      } else {
        setRecognizedCustomer(null);
      }
    } catch (error) {
      console.warn('Erro ao resolver identidade pública:', error);
    }
  }, [canalClienteRepository, canonicalToken, publicSlug]);

  const loadCatalog = useCallback(async (token: string | null, slug?: string) => {
    const { servicos, categorias } = token
      ? await canalClienteRepository.obterCatalogoServicos(token)
      : await canalClienteRepository.obterCatalogoServicosPublico(slug || '');
    setServices(servicos);
    setCategories(categorias);
    setActiveCategory('Todos');

    if (token) {
      const profs = await canalClienteRepository.obterProfissionais(token);
      setProfessionals(profs);
    } else {
      setProfessionals([]);
    }

    const stateData = locationState as {
      serviceId?: string;
      professionalId?: string;
      professionalName?: string;
      rescheduleAppointmentId?: string;
    } | null;

    if (stateData?.rescheduleAppointmentId) {
      setIsRescheduling(true);
      setRescheduleAppointmentId(stateData.rescheduleAppointmentId);
      if (stateData.serviceId) {
        const matchedService = (servicos || []).find((service) => service.id === stateData.serviceId);
        if (matchedService) {
          setSelectedService(matchedService);
          if (slug) {
            void canalClienteRepository.obterProfissionaisPublicos(slug, matchedService.id)
              .then(setProfessionals)
              .catch(() => setProfessionals([]));
          }
        }
      }
      if (stateData.professionalId !== undefined) {
        setSelectedProfessional({
          id: stateData.professionalId,
          name: stateData.professionalName || 'Qualquer profissional'
        });
      }
      setIsTimesModalOpen(true);
    }
  }, [locationState, canalClienteRepository]);

  // Carregar dados iniciais
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        let token = canonicalToken;
        let activeDetails: PerfilClienteCanal | null = null;
        let activePublicContext: ContextoPublicoCanal | null = null;

        if (publicSlug) {
          activePublicContext = await canalClienteRepository.obterContextoPublico(publicSlug);
          if (!activePublicContext) {
            addToast('Estabelecimento não encontrado.', 'error');
            navigate('/cliente/acesso-expirado');
            return;
          }

          const explicitToken = searchParams.get('token') || routeToken;
          let sessionProfile: PerfilClienteCanal | null = null;

          if (!explicitToken) {
            try {
              const candidateSession = await canalClienteRepository.obterPerfilPublicoSessao();
              if (candidateSession?.tenant_id === activePublicContext.tenant_id) {
                sessionProfile = candidateSession;
                setPublicSessionAuthenticated(true);
              }
            } catch (error) {
              console.warn('Não foi possível recuperar a sessão pública:', error);
            }
          }

          const storedToken = explicitToken?.trim() || (!sessionProfile &&
            typeof window !== 'undefined' && window.localStorage
              ? localStorage.getItem(publicTokenStorageKey(publicSlug)) || undefined
              : undefined);

          if (storedToken) {
            try {
              const candidateProfile = await canalClienteRepository.obterPerfil(storedToken);
              if (candidateProfile.tenant_id === activePublicContext.tenant_id && candidateProfile.cadastro_completo) {
                token = storedToken;
                activeDetails = candidateProfile;
              }
            } catch {
              token = null;
            }
          } else if (sessionProfile) {
            token = null;
            activeDetails = sessionProfile;
          } else {
            token = null;
          }

          setCanonicalToken(token);
          setPublicContext(activePublicContext);
          await loadCatalog(null, publicSlug);
        } else if (token) {
          activeDetails = await canalClienteRepository.obterPerfil(token);
          await loadCatalog(token);
        } else {
          addToast('Acesso não autorizado. Redirecionando...', 'error');
          navigate('/cliente/acesso-expirado');
          return;
        }

        if (!activeDetails && !activePublicContext) {
          navigate('/cliente/acesso-expirado');
          return;
        }

        const stateData = locationState as { fromMenu?: boolean; rescheduleAppointmentId?: string } | null;
        if (activeDetails?.cadastro_completo && !stateData?.fromMenu && !stateData?.rescheduleAppointmentId) {
          navigate('/cliente/menu', { replace: true });
          return;
        }

        setCustomerDetails(activeDetails);

        const tz = activeDetails?.tenant_timezone || activePublicContext?.timezone || 'America/Sao_Paulo';
        const today = dateInZone(new Date(), tz);
        const timeNow = formatTimeInZone(new Date().toISOString(), tz);
        const dayBh = getDayBusinessHours(today, activeDetails?.business_hours || activePublicContext?.business_hours);

        setBaseTodayDate(today);

        if (!dayBh.active || timeNow >= dayBh.close) {
          let nextDate = shiftCalendarDate(today, 1);
          for (let i = 0; i < 7; i++) {
            const nextBh = getDayBusinessHours(nextDate, activeDetails?.business_hours || activePublicContext?.business_hours);
            if (nextBh.active) {
              setSelectedDate(nextDate);
              break;
            }
            nextDate = shiftCalendarDate(nextDate, 1);
          }
        } else {
          setSelectedDate(today);
        }

      } catch (err) {
        console.error('Erro ao carregar dados do fluxo:', err);
        navigate('/cliente/acesso-expirado');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [publicSlug, routeToken, canonicalToken, searchParams, navigate, addToast, loadCatalog, canalClienteRepository, locationState]);

  // Sincronizar dados do cliente se já existirem
  useEffect(() => {
    if (customerDetails) {
      if (customerDetails.customer_name && customerDetails.customer_name !== 'Cliente') {
        setClientFullName(customerDetails.customer_name);
      }
      if (customerDetails.customer_phone) {
        setClientPhone(maskPhone(customerDetails.customer_phone || ''));
      }
    }
  }, [customerDetails]);

  // Carregar slots quando mudamos data, profissional ou serviço
  useEffect(() => {
    const fetchSlots = async () => {
      if (!selectedService || !selectedDate) return;

      setLoadingSlots(true);
      setSelectedSlot(null);
      setPublicSchedule([]);

      try {
        if (publicSlug) {
          const schedule = await canalClienteRepository.consultarGradeHorariosPublica(
            publicSlug,
            selectedDate,
            selectedService.id,
            selectedProfessional?.id || null
          );
          setPublicSchedule(schedule);
          setAvailableSlots(schedule.filter((slot) => slot.available).map((slot) => slot.slot_time));
        } else if (canonicalToken) {
          const slotsArray = await canalClienteRepository.consultarHorariosDisponiveis(
            selectedDate,
            selectedService.id,
            selectedProfessional?.id || null,
            canonicalToken,
            rescheduleAppointmentId || null
          );
          setAvailableSlots(slotsArray);
        }
      } catch (err) {
        console.error('Erro ao carregar slots:', err);
        addToast('Erro ao carregar horários disponíveis.', 'error');
      } finally {
        setLoadingSlots(false);
      }
    };

    if (isTimesModalOpen) {
      fetchSlots();
    }
  }, [isTimesModalOpen, selectedService, selectedProfessional, selectedDate, rescheduleAppointmentId, canonicalToken, publicSlug, canalClienteRepository, addToast]);

  // Filtragem defensiva de slots válidos
  const filteredAvailableSlots = useMemo(() => {
    const tz = customerDetails?.tenant_timezone || publicContext?.timezone || 'America/Sao_Paulo';
    const todayStr = dateInZone(new Date(), tz);
    const currentLocalTime = formatTimeInZone(new Date().toISOString(), tz);
    const dayBh = getDayBusinessHours(selectedDate, customerDetails?.business_hours || publicContext?.business_hours);

    if (!dayBh.active) return [];
    if (selectedDate < todayStr) return [];
    if (selectedDate > todayStr) return availableSlots;
    if (currentLocalTime >= dayBh.close) return [];

    const leadTime = customerDetails?.min_booking_lead_time_minutes ?? 30;
    return availableSlots.filter((slot) => isSlotViableForToday(slot, currentLocalTime, leadTime));
  }, [availableSlots, selectedDate, customerDetails, publicContext]);

  // Handlers de Fluxo
  const handleSelectService = (service: ServicoCanal) => {
    setSelectedService(service);
    if (publicSlug) {
      void canalClienteRepository.obterProfissionaisPublicos(publicSlug, service.id)
        .then(setProfessionals)
        .catch(() => {
          addToast('Erro ao carregar profissionais disponíveis.', 'error');
          setProfessionals([]);
        });
    }
    setIsDaysModalOpen(true);
  };

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    setIsDaysModalOpen(false);
    setIsTimesModalOpen(true);
  };

  const handleAdvanceToSummary = () => {
    if (!selectedSlot) return;

    if (isRescheduling) {
      void handleConfirmBooking();
      return;
    }

    setIsTimesModalOpen(false);
    setIsSummaryModalOpen(true);
  };

  const handleConfirmBooking = async () => {
    if (!selectedService || !selectedSlot) return;

    if (!isRescheduling) {
      const trimmedName = clientFullName.trim();
      if (!trimmedName || trimmedName.split(/\s+/).filter(Boolean).length < 2) {
        addToast('Por favor, informe seu nome e sobrenome completo.', 'warning');
        return;
      }

      let cleanPhone = clientPhone.replace(/\D/g, '');
      while (cleanPhone.startsWith('55') && cleanPhone.length > 11) {
        cleanPhone = cleanPhone.slice(2);
      }
      if (cleanPhone.length < 10 || cleanPhone.length > 11) {
        addToast('Por favor, informe um WhatsApp válido com DDD.', 'warning');
        return;
      }
    }

    setBooking(true);
    try {
      const confirmationSlug = publicSlug || customerDetails?.tenant_slug;
      if (confirmationSlug && !isRescheduling) {
        const trimmedName = clientFullName.trim();
        let cleanPhone = clientPhone.replace(/\D/g, '');
        while (cleanPhone.startsWith('55') && cleanPhone.length > 11) {
          cleanPhone = cleanPhone.slice(2);
        }

        if (publicSlug && !canonicalToken) {
          await resolvePublicIdentity(trimmedName, cleanPhone);
        }

        const confirmation = await canalClienteRepository.confirmarAgendamentoPublico({
          slug: confirmationSlug,
          token: canonicalToken,
          serviceId: selectedService.id,
          professionalId: selectedProfessional?.id || null,
          date: selectedDate,
          slot: selectedSlot,
          name: trimmedName,
          phone: cleanPhone,
        });

        if (!publicSessionAuthenticated && typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(publicTokenStorageKey(confirmationSlug), confirmation.token);
          localStorage.setItem('navalhado_customer_token', confirmation.token);
        }
        addToast('Agendamento realizado com sucesso!', 'success');
        setIsSummaryModalOpen(false);
        navigate('/cliente/menu');
        return;
      }

      if (isRescheduling && rescheduleAppointmentId && publicSessionAuthenticated) {
        await canalClienteRepository.reagendarAgendamentoPublicoSessao({
          appointmentId: rescheduleAppointmentId,
          newServiceId: selectedService.id,
          newProfessionalId: selectedProfessional?.id || null,
          newDate: selectedDate,
          newSlot: selectedSlot,
          newStartTime: `${selectedDate}T${selectedSlot}:00`,
        });
        addToast('Reagendamento concluído com sucesso!', 'success');
        setIsTimesModalOpen(false);
        navigate('/cliente/menu');
        return;
      }

      if (!customerDetails || !canonicalToken) {
        addToast('Não foi possível validar o acesso ao agendamento.', 'error');
        return;
      }

      let activeToken = canonicalToken;
      const trimmedName = clientFullName.trim();
      let cleanPhone = clientPhone.replace(/\D/g, '');
      while (cleanPhone.startsWith('55') && cleanPhone.length > 11) {
        cleanPhone = cleanPhone.slice(2);
      }

      const updateRes = await canalClienteRepository.promoverCadastroCliente(
        { name: trimmedName, phone: cleanPhone },
        canonicalToken
      );
      if (updateRes && updateRes.token_acesso) {
        activeToken = updateRes.token_acesso;
        setCanonicalToken(activeToken);
      }
      if (customerDetails?.tenant_slug && typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(publicTokenStorageKey(customerDetails.tenant_slug), activeToken);
        localStorage.setItem('navalhado_customer_token', activeToken);
      }

      if (isRescheduling && rescheduleAppointmentId) {
        await canalClienteRepository.reagendarAgendamento({
          appointmentId: rescheduleAppointmentId,
          newServiceId: selectedService.id,
          newProfessionalId: selectedProfessional?.id || null,
          newDate: selectedDate,
          newSlot: selectedSlot,
          newStartTime: `${selectedDate}T${selectedSlot}:00`,
        }, activeToken);
        addToast('Reagendamento concluído com sucesso!', 'success');
      } else {
        await canalClienteRepository.criarAgendamento({
          serviceId: selectedService.id,
          professionalId: selectedProfessional?.id || null,
          startTime: `${selectedDate}T${selectedSlot}:00`,
        }, activeToken);
        addToast('Agendamento realizado com sucesso!', 'success');
      }

      setIsTimesModalOpen(false);
      setIsSummaryModalOpen(false);
      navigate('/cliente/menu');
    } catch (err: unknown) {
      console.error('Erro ao agendar horário:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (err instanceof AgendamentoRegraCancelamentoError || errorMessage.includes('APPOINTMENT_CANCELLATION_DEADLINE_EXPIRED')) {
        addToast('O prazo para alteração online deste agendamento expirou. Fale com o estabelecimento pelo WhatsApp.', 'warning');
      } else if (errorMessage.includes('antecedência mínima') || errorMessage.includes('22023') || errorMessage.includes('não está mais disponível')) {
        addToast(errorMessage || 'Este horário não está mais disponível com a antecedência mínima necessária configurada pela barbearia.', 'warning');
      } else {
        addToast(errorMessage || 'Erro ao realizar o agendamento.', 'error');
      }
    } finally {
      setBooking(false);
    }
  };

  const handleOpenManagement = async () => {
    if (!publicSlug) return;

    try {
      const sessionProfile = await canalClienteRepository.obterPerfilPublicoSessao();
      if (sessionProfile?.tenant_id === publicContext?.tenant_id) {
        navigate('/cliente/menu', { replace: true });
        return;
      }
    } catch (error) {
      console.warn('Não foi possível recuperar a sessão pública:', error);
    }

    setIsManagementModalOpen(true);
  };

  const handleStartManagementSession = async (name: string, phone: string, captchaToken: string | null) => {
    if (!publicSlug) return;

    const trimmedName = name.trim();
    const cleanPhone = phone.replace(/\D/g, '');
    if (trimmedName.split(/\s+/).filter(Boolean).length < 2) {
      addToast('Informe seu nome e sobrenome completos.', 'warning');
      return;
    }
    if (cleanPhone.length < 10 || cleanPhone.length > 13) {
      addToast('Informe um WhatsApp válido com DDD.', 'warning');
      return;
    }
    if (turnstileSiteKey && !captchaToken) {
      addToast('Conclua a verificação de segurança para continuar.', 'warning');
      return;
    }

    setStartingManagementSession(true);
    try {
      const session = await canalClienteRepository.iniciarSessaoPublica(
        publicSlug,
        trimmedName,
        cleanPhone,
        captchaToken || undefined,
      );
      if (!session?.found) {
        addToast('Não encontramos agendamentos para esses dados nesta barbearia.', 'warning');
        return;
      }

      setIsManagementModalOpen(false);
      navigate('/cliente/menu', { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível iniciar sua sessão.';
      addToast(message, 'error');
    } finally {
      setStartingManagementSession(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-[#FFF1E6] text-[#D96C00]">
        <div className="w-11 h-11 border-3 border-[#EADED6] border-t-[#D96C00] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="cliente-screen">
      {/* 01: Topo com Logo Oficial Real (/simbolo.svg) e Nome Limpo */}
      <CatalogoServicosHeader
        tenantName={customerDetails?.tenant_name || publicContext?.tenant_name}
        tenantLogoUrl={publicContext?.logo_url || null}
      />

      <main className="cliente-container">
        {/* Filtro por Categorias Reais */}
        {categories.length > 1 && (
          <div className="categorias-bar">
            {['Todos', ...categories].map((cat) => {
              const isCatActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`categoria-pill ${isCatActive ? "categoria-pill--active" : ""}`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        )}

        {/* Lista de Cards de Serviços */}
        <div className="servicos-list">
          {filteredServices.map((service) => (
            <ServicoCard
              key={service.id}
              service={service}
              onSelect={handleSelectService}
              isSelected={selectedService?.id === service.id}
            />
          ))}
        </div>
      </main>

      {/* 02: Modal de Seleção de Dias da Semana */}
      <ModalSelecaoDias
        isOpen={isDaysModalOpen}
        onClose={() => setIsDaysModalOpen(false)}
        service={selectedService}
        baseDate={baseTodayDate}
        selectedDate={selectedDate}
        onSelectDate={handleSelectDate}
      />

      {/* 03: Modal de Seleção de Barbeiro e Horários */}
      <ModalSelecaoHorarios
        isOpen={isTimesModalOpen}
        onClose={() => setIsTimesModalOpen(false)}
        onBack={() => {
          setIsTimesModalOpen(false);
          setIsDaysModalOpen(true);
        }}
        service={selectedService}
        selectedDate={selectedDate}
        professionals={professionals}
        selectedProfessional={selectedProfessional}
        onSelectProfessional={(id, name) => setSelectedProfessional({ id, name })}
        slots={filteredAvailableSlots}
        loadingSlots={loadingSlots}
        selectedSlot={selectedSlot}
        onSelectSlot={(slot) => setSelectedSlot(slot)}
        onAdvance={handleAdvanceToSummary}
        isRescheduling={isRescheduling}
      />

      {/* 04: Modal de Resumo da Comanda e Checkout */}
      <ModalResumoAgendamento
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        onBack={() => {
          setIsSummaryModalOpen(false);
          setIsTimesModalOpen(true);
        }}
        service={selectedService}
        selectedProfessional={selectedProfessional}
        selectedDate={selectedDate}
        selectedSlot={selectedSlot}
        clientFullName={clientFullName}
        onChangeName={setClientFullName}
        clientPhone={clientPhone}
        onChangePhone={(phone) => setClientPhone(maskPhone(phone))}
        onConfirmBooking={handleConfirmBooking}
        booking={booking}
      />

      {/* 05: Modal de Identificação para Meus Agendamentos */}
      <ModalIdentificacaoCliente
        isOpen={isManagementModalOpen}
        onClose={() => setIsManagementModalOpen(false)}
        onConfirm={handleStartManagementSession}
        turnstileSiteKey={turnstileSiteKey}
        loading={startingManagementSession}
      />

      {/* Floating Bottom Nav (Agendar | Meus agendamentos) */}
      <ClienteBottomNav
        activeTab="agendar"
        onTabChange={(tab) => {
          if (tab === 'meus-agendamentos') {
            void handleOpenManagement();
          }
        }}
      />
    </div>
  );
};
