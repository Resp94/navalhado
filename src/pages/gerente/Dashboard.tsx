import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { TenantContextType } from '../../components/GerenteLayout';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

interface Professional {
  id: string;
  name: string;
  is_active: boolean;
}

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface Appointment {
  id: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'confirmed' | 'completed' | 'canceled';
  payment_status: 'pending' | 'paid';
  customer: {
    id: string;
    name: string;
    phone: string;
  };
  service: {
    id: string;
    name: string;
    price: number;
  };
  professional_id: string;
}

export const Dashboard: React.FC = () => {
  const tenant = useOutletContext<TenantContextType>();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Estados dos Modais
  const [showModal, setShowModal] = useState(false);
  const [savingAppointment, setSavingAppointment] = useState(false);

  // Estados do Formulário de Encaixe
  const [clientType, setClientType] = useState<'existing' | 'new'>('existing');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedProfId, setSelectedProfId] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('09:00');

  // Carregar dados iniciais (Profissionais ativos e Serviços)
  const loadInitialData = async () => {
    try {
      // 1. Carregar barbeiros ativos
      const { data: profs, error: profsError } = await supabase
        .from('professionals')
        .select('id, name, is_active')
        .eq('tenant_id', tenant.tenantId)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (profsError) throw profsError;
      setProfessionals(profs || []);

      // 2. Carregar serviços ativos
      const { data: servs, error: servsError } = await supabase
        .from('services')
        .select('id, name, price, duration_minutes')
        .eq('tenant_id', tenant.tenantId)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (servsError) throw servsError;
      setServices(servs || []);

      // 3. Carregar clientes cadastrados
      const { data: custs, error: custsError } = await supabase
        .from('customers')
        .select('id, name, phone')
        .eq('tenant_id', tenant.tenantId)
        .order('name', { ascending: true });

      if (custsError) throw custsError;
      setCustomers(custs || []);

    } catch (error: any) {
      console.error('Error loading agenda metadata:', error);
      addToast('Erro ao carregar dados básicos da barbearia.', 'error');
    }
  };

  // Carregar agendamentos do dia selecionado
  const fetchAppointments = async () => {
    try {
      setLoading(true);
      
      const startOfDay = `${selectedDate}T00:00:00Z`;
      const endOfDay = `${selectedDate}T23:59:59Z`;

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          start_time,
          end_time,
          status,
          payment_status,
          professional_id,
          customer:customers (id, name, phone),
          service:services (id, name, price)
        `)
        .eq('tenant_id', tenant.tenantId)
        .gte('start_time', startOfDay)
        .lte('start_time', endOfDay)
        .neq('status', 'canceled')
        .order('start_time', { ascending: true });

      if (error) throw error;
      
      // Mapear tipos corretos
      const mappedAppointments: Appointment[] = (data || []).map((app: any) => ({
        id: app.id,
        start_time: app.start_time,
        end_time: app.end_time,
        status: app.status,
        payment_status: app.payment_status,
        professional_id: app.professional_id,
        customer: Array.isArray(app.customer) ? app.customer[0] : app.customer,
        service: Array.isArray(app.service) ? app.service[0] : app.service
      }));

      setAppointments(mappedAppointments);
    } catch (error: any) {
      console.error('Error fetching appointments:', error);
      addToast('Não foi possível carregar os agendamentos.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [tenant.tenantId]);

  useEffect(() => {
    fetchAppointments();
  }, [tenant.tenantId, selectedDate]);

  useGSAP(() => {
    if (!loading && professionals.length > 0) {
      gsap.fromTo('.professional-column', 
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out' }
      );
    }
  }, [loading, professionals]);

  // Alterar data selecionada
  const shiftDate = (days: number) => {
    const d = new Date(selectedDate + 'T12:00:00'); // Evita bugs de timezone
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleOpenEncaixeModal = (profId: string) => {
    setSelectedProfId(profId);
    setClientType('existing');
    setSelectedCustomerId('');
    setNewClientName('');
    setNewClientPhone('');
    setSelectedServiceId(services[0]?.id || '');
    
    // Pegar a hora atual arredondada para o próximo slot
    const now = new Date();
    const currentHours = now.getHours().toString().padStart(2, '0');
    const currentMinutes = now.getMinutes() < 30 ? '30' : '00';
    setAppointmentTime(`${currentHours}:${currentMinutes}`);
    
    setShowModal(true);
  };

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProfId) {
      addToast('Selecione um profissional.', 'warning');
      return;
    }
    if (!selectedServiceId) {
      addToast('Selecione um serviço.', 'warning');
      return;
    }

    try {
      setSavingAppointment(true);

      let finalCustomerId = selectedCustomerId;

      // 1. Se for novo cliente, cadastrar na tabela customers
      if (clientType === 'new') {
        if (!newClientName.trim() || !newClientPhone.trim()) {
          addToast('Preencha o nome e telefone do novo cliente.', 'warning');
          setSavingAppointment(false);
          return;
        }

        const { data: newCust, error: custError } = await supabase
          .from('customers')
          .insert([
            {
              tenant_id: tenant.tenantId,
              name: newClientName.trim(),
              phone: newClientPhone.trim()
            }
          ])
          .select()
          .single();

        if (custError) throw custError;
        finalCustomerId = newCust.id;
      }

      if (!finalCustomerId) {
        addToast('Selecione ou cadastre um cliente.', 'warning');
        setSavingAppointment(false);
        return;
      }

      // 2. Calcular horários de início e fim
      const startTimeStr = `${selectedDate}T${appointmentTime}:00Z`;
      const selectedService = services.find(s => s.id === selectedServiceId);
      const duration = selectedService?.duration_minutes || 30;
      
      const startDateObj = new Date(startTimeStr);
      const endDateObj = new Date(startDateObj.getTime() + duration * 60000);
      const endTimeStr = endDateObj.toISOString();

      // 3. Inserir agendamento manual (já entra como confirmado)
      const { error: appError } = await supabase
        .from('appointments')
        .insert([
          {
            tenant_id: tenant.tenantId,
            customer_id: finalCustomerId,
            professional_id: selectedProfId,
            service_id: selectedServiceId,
            start_time: startTimeStr,
            end_time: endTimeStr,
            status: 'confirmed',
            payment_status: 'pending'
          }
        ]);

      if (appError) throw appError;

      addToast('Agendamento de encaixe realizado com sucesso!', 'success');
      setShowModal(false);
      fetchAppointments();
      loadInitialData(); // Atualiza a lista de clientes para novas buscas
    } catch (error: any) {
      console.error('Error saving appointment:', error);
      addToast(error.message || 'Erro ao realizar agendamento.', 'error');
    } finally {
      setSavingAppointment(false);
    }
  };

  const handleTogglePaymentStatus = async (appId: string, currentStatus: 'pending' | 'paid', servicePrice: number) => {
    try {
      const nextStatus = currentStatus === 'pending' ? 'paid' : 'pending';
      
      // Inserir registro financeiro em public.payments se estiver marcando como pago
      if (nextStatus === 'paid') {
        // Encontrar o agendamento completo
        const { data: appointmentFull } = await supabase
          .from('appointments')
          .select('professional_id')
          .eq('id', appId)
          .single();

        let commissionVal = 0;
        if (appointmentFull) {
          // Descobrir a comissão do profissional
          const { data: professional } = await supabase
            .from('professionals')
            .select('commission_percentage')
            .eq('id', appointmentFull.professional_id)
            .single();

          if (professional) {
            commissionVal = servicePrice * (professional.commission_percentage / 100);
          }
        }

        // Criar registro na tabela payments
        const { error: paymentError } = await supabase
          .from('payments')
          .insert([
            {
              tenant_id: tenant.tenantId,
              appointment_id: appId,
              method: 'PIX', // Método padrão para encaixe rápido, alterável no financeiro
              amount: servicePrice,
              commission_value: commissionVal
            }
          ]);

        if (paymentError) throw paymentError;
      } else {
        // Excluir registro na tabela payments caso reverta para pendente
        const { error: deletePaymentError } = await supabase
          .from('payments')
          .delete()
          .eq('appointment_id', appId)
          .eq('tenant_id', tenant.tenantId);

        if (deletePaymentError) throw deletePaymentError;
      }

      // Atualizar o status de pagamento do agendamento
      const { error } = await supabase
        .from('appointments')
        .update({
          payment_status: nextStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', appId);

      if (error) throw error;
      addToast(`Agendamento marcado como ${nextStatus === 'paid' ? 'Pago' : 'Pendente'}!`, 'success');
      fetchAppointments();
    } catch (error: any) {
      addToast('Erro ao atualizar status de pagamento.', 'error');
    }
  };

  const handleCancelAppointment = async (appId: string) => {
    if (!confirm('Deseja realmente cancelar este agendamento?')) return;
    try {
      const { error } = await supabase
        .from('appointments')
        .update({
          status: 'canceled',
          cancellation_reason: 'Cancelado pelo gerente no painel',
          updated_at: new Date().toISOString()
        })
        .eq('id', appId);

      if (error) throw error;
      
      // Excluir pagamento se já tivesse sido pago
      await supabase
        .from('payments')
        .delete()
        .eq('appointment_id', appId)
        .eq('tenant_id', tenant.tenantId);

      addToast('Agendamento cancelado.', 'warning');
      fetchAppointments();
    } catch (error: any) {
      addToast('Não foi possível cancelar o agendamento.', 'error');
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const hours = d.getUTCHours().toString().padStart(2, '0');
      const minutes = d.getUTCMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch (e) {
      return '';
    }
  };

  // Formatar ISO (yyyy-MM-dd) para dd/MM/yyyy
  const formatDateBR = (iso: string): string => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  return (
    <div className="agenda-page">
      {/* HEADER DA AGENDA */}
      <div className="agenda-header-control card">
        <div className="agenda-header-title">
          <h2>Agenda Geral</h2>
          <p>Selecione a data e faça agendamentos de encaixe para a equipe.</p>
        </div>

        {/* Controle de Navegação de Data */}
        <div className="date-nav-controls">
          <button onClick={() => shiftDate(-1)} className="btn-date-nav">◀</button>
          <div className="date-picker-custom">
            <span className="date-picker-custom__text">{formatDateBR(selectedDate)}</span>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="date-picker-custom__input"
            />
          </div>
          <button onClick={() => shiftDate(1)} className="btn-date-nav">▶</button>
          <button 
            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])} 
            className="btn btn--outline-secondary btn--sm"
            style={{ padding: '0.45rem 0.8rem', borderRadius: 'var(--radius-full)' }}
          >
            Hoje
          </button>
        </div>
      </div>

      {/* GRADE DA AGENDA POR PROFISSIONAL */}
      {loading ? (
        <div className="card loading-state">
          <div className="spinner" style={{ borderColor: 'var(--color-brand-primary)', borderTopColor: 'transparent' }} />
          <p>Carregando escala do dia...</p>
        </div>
      ) : professionals.length === 0 ? (
        <div className="card empty-state">
          <h4>Nenhum profissional cadastrado</h4>
          <p>Cadastre os membros da sua equipe na aba "Equipe" para liberar o painel de agenda.</p>
        </div>
      ) : (
        <div className="agenda-columns-grid">
          {professionals.map((prof) => {
            const profAppointments = appointments.filter(a => a.professional_id === prof.id);

            return (
              <div key={prof.id} className="professional-column card">
                <div className="column-header">
                  <div className="column-title-group">
                    <div className="prof-avatar-column">
                      {prof.name.charAt(0).toUpperCase()}
                    </div>
                    <h4>{prof.name}</h4>
                  </div>
                  <button 
                    onClick={() => handleOpenEncaixeModal(prof.id)}
                    className="btn-encaixar"
                    title="Encaixar horário para este barbeiro"
                  >
                    + Encaixar
                  </button>
                </div>

                <div className="column-body">
                  {profAppointments.length === 0 ? (
                    <div className="no-bookings">
                      <p>Sem horários agendados.</p>
                    </div>
                  ) : (
                    <div className="bookings-list">
                      {profAppointments.map((app) => (
                        <div 
                          key={app.id} 
                          className={`booking-card booking-card--${app.payment_status}`}
                        >
                          <div className="booking-card-time">
                            <span>{formatTime(app.start_time)} - {formatTime(app.end_time)}</span>
                          </div>
                          
                          <div className="booking-card-details">
                            <span className="client-name">{app.customer?.name}</span>
                            <span className="service-name">{app.service?.name}</span>
                          </div>

                          <div className="booking-card-footer">
                            <span className="price-tag">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(app.service?.price || 0)}
                            </span>
                            
                            <div className="booking-actions">
                              {/* Botão de Cobrança / Status de Pagamento */}
                              <button 
                                onClick={() => handleTogglePaymentStatus(app.id, app.payment_status, app.service?.price || 0)}
                                className={`btn-action-payment ${app.payment_status === 'paid' ? 'btn-action-payment--paid' : 'btn-action-payment--pending'}`}
                                title={app.payment_status === 'paid' ? 'Estornar pagamento' : 'Registrar pagamento'}
                              >
                                {app.payment_status === 'paid' ? 'Pago' : 'Cobrar'}
                              </button>
                              
                              {/* Cancelar */}
                              <button 
                                onClick={() => handleCancelAppointment(app.id)}
                                className="btn-action-cancel"
                                title="Cancelar agendamento"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE ENCAIXE MANUAL */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content card">
            <h3>Encaixar Agendamento</h3>
            
            <form onSubmit={handleCreateAppointment} className="modal-form">
              {/* Escolha do Tipo de Cliente */}
              <div className="client-type-toggle">
                <button 
                  type="button" 
                  onClick={() => setClientType('existing')}
                  className={`toggle-btn ${clientType === 'existing' ? 'toggle-btn--active' : ''}`}
                >
                  Cliente Cadastrado
                </button>
                <button 
                  type="button" 
                  onClick={() => setClientType('new')}
                  className={`toggle-btn ${clientType === 'new' ? 'toggle-btn--active' : ''}`}
                >
                  Cadastro Rápido
                </button>
              </div>

              {/* Seção Cliente Cadastrado */}
              {clientType === 'existing' && (
                <div className="form-group">
                  <label htmlFor="modal-customer">Cliente</label>
                  <select 
                    id="modal-customer"
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    required
                  >
                    <option value="">Selecione o cliente...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Seção Cadastro Rápido de Cliente */}
              {clientType === 'new' && (
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="modal-new-name">Nome do Cliente</label>
                    <input 
                      id="modal-new-name"
                      type="text" 
                      placeholder="Ex: Pedro Santos"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="modal-new-phone">WhatsApp</label>
                    <input 
                      id="modal-new-phone"
                      type="text" 
                      placeholder="Ex: (11) 98888-8888"
                      value={newClientPhone}
                      onChange={(e) => setNewClientPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              {/* Serviços */}
              <div className="form-group">
                <label htmlFor="modal-service">Serviço</label>
                <select 
                  id="modal-service"
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  required
                >
                  <option value="">Selecione o serviço...</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes}m - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.price)})</option>
                  ))}
                </select>
              </div>

              {/* Profissional e Hora */}
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="modal-prof">Barbeiro</label>
                  <select 
                    id="modal-prof"
                    value={selectedProfId}
                    onChange={(e) => setSelectedProfId(e.target.value)}
                    required
                  >
                    {professionals.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="modal-time">Horário de Início</label>
                  <input 
                    id="modal-time"
                    type="time" 
                    value={appointmentTime}
                    onChange={(e) => setAppointmentTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="btn btn--outline-secondary"
                  disabled={savingAppointment}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn--primary" disabled={savingAppointment}>
                  {savingAppointment ? <div className="spinner spinner--sm" /> : 'Confirmar Encaixe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .agenda-page {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .agenda-header-control {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1.5rem;
          padding: 1.25rem 1.75rem;
          background-color: rgba(255, 255, 255, 0.45);
          backdrop-filter: blur(12px) saturate(120%);
          -webkit-backdrop-filter: blur(12px) saturate(120%);
          border: 1px solid rgba(234, 222, 214, 0.5);
          border-radius: var(--radius-lg);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), var(--shadow-sm);
        }

        @media (max-width: 768px) {
          .agenda-header-control {
            flex-direction: column;
            align-items: flex-start;
          }
        }

        .agenda-header-title h2 {
          font-size: var(--font-size-xl);
          font-weight: 800;
          color: var(--color-text-primary);
          letter-spacing: -0.02em;
        }

        .agenda-header-title p {
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
        }

        .date-nav-controls {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .btn-date-nav {
          background-color: rgba(255, 255, 255, 0.65);
          border: 1px solid var(--color-border);
          color: var(--color-text-secondary);
          padding: 0.5rem 0.75rem;
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .btn-date-nav:hover {
          color: var(--color-brand-primary);
          background-color: var(--color-brand-lightest);
          border-color: var(--color-brand-soft);
          transform: translateY(-1px);
        }

        .btn-date-nav:active {
          transform: scale(0.97);
        }

        .date-picker-custom {
          position: relative;
          display: flex;
          align-items: center;
          cursor: pointer;
        }

        .date-picker-custom__text {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 110px;
          padding: 0.45rem 1rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          font-family: inherit;
          font-size: var(--font-size-sm);
          color: var(--color-text-primary);
          background-color: rgba(255, 255, 255, 0.75);
          backdrop-filter: blur(4px);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          user-select: none;
          letter-spacing: 0.02em;
        }

        .date-picker-custom:hover .date-picker-custom__text {
          border-color: var(--color-brand-soft);
          background-color: rgba(255, 255, 255, 0.9);
        }

        .date-picker-custom__input {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          opacity: 0;
          cursor: pointer;
          border: none;
          padding: 0;
          margin: 0;
        }

        /* Make the native picker trigger fill the visible area */
        .date-picker-custom__input::-webkit-calendar-picker-indicator {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          cursor: pointer;
          opacity: 0;
        }

        .agenda-columns-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 1.5rem;
          align-items: start;
          width: 100%;
        }

        .professional-column {
          padding: 1.5rem;
          background-color: rgba(255, 255, 255, 0.45);
          backdrop-filter: blur(12px) saturate(120%);
          -webkit-backdrop-filter: blur(12px) saturate(120%);
          border: 1px solid rgba(234, 222, 214, 0.5);
          border-radius: var(--radius-lg);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), var(--shadow-sm);
          display: flex;
          flex-direction: column;
          gap: 1rem;
          min-height: 400px;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .column-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(234, 222, 214, 0.6);
          padding-bottom: 0.75rem;
        }

        .column-title-group {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .prof-avatar-column {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-full);
          background-color: var(--color-brand-soft);
          color: var(--color-brand-deep);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: var(--font-size-sm);
          border: 1.5px solid rgba(255, 255, 255, 0.6);
          box-shadow: var(--shadow-sm);
        }

        .column-title-group h4 {
          font-size: var(--font-size-base);
          font-weight: 700;
          color: var(--color-text-primary);
          letter-spacing: -0.01em;
        }

        .btn-encaixar {
          background-color: rgba(217, 108, 0, 0.1);
          color: var(--color-brand-primary);
          border: 1px solid rgba(217, 108, 0, 0.15);
          font-size: 0.75rem;
          font-weight: 700;
          padding: 0.4rem 0.8rem;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .btn-encaixar:hover {
          background-color: var(--color-brand-primary);
          color: white;
          border-color: var(--color-brand-primary);
          transform: translateY(-1px);
        }

        .btn-encaixar:active {
          transform: scale(0.96);
        }

        .column-body {
          display: flex;
          flex-direction: column;
          flex: 1;
        }

        .no-bookings {
          padding: 4rem 1rem;
          text-align: center;
          color: var(--color-text-secondary);
          font-style: italic;
          font-size: var(--font-size-sm);
          border: 1.5px dashed rgba(234, 222, 214, 0.8);
          border-radius: var(--radius-md);
          background-color: rgba(255, 255, 255, 0.2);
          margin-top: 0.5rem;
        }

        .bookings-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .booking-card {
          border-radius: var(--radius-lg);
          border: 1px solid var(--color-border);
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          background-color: rgba(255, 255, 255, 0.65);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .booking-card:hover {
          transform: translateY(-2px);
          border-color: rgba(217, 108, 0, 0.3);
          box-shadow: var(--shadow-md);
        }

        /* Cores semânticas para pagamentos */
        .booking-card--pending {
          border-left: 4px solid var(--color-warning);
          background-color: rgba(254, 243, 199, 0.3);
        }

        .booking-card--paid {
          border-left: 4px solid var(--color-success);
          background-color: rgba(230, 244, 234, 0.4);
          border-color: var(--color-success) var(--color-border) var(--color-border) var(--color-success);
        }

        .booking-card-time {
          font-size: 0.7rem;
          font-weight: 800;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .booking-card-details {
          display: flex;
          flex-direction: column;
        }

        .client-name {
          font-size: var(--font-size-sm);
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .service-name {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
        }

        .booking-card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid rgba(45, 35, 30, 0.06);
          padding-top: 0.5rem;
          margin-top: 0.25rem;
        }

        .price-tag {
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--color-brand-primary);
        }

        .booking-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .btn-action-payment {
          border: 1px solid transparent;
          font-size: 0.7rem;
          font-weight: 700;
          padding: 0.25rem 0.6rem;
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .btn-action-payment--pending {
          background-color: var(--color-warning);
          color: white;
          border-color: var(--color-warning);
        }

        .btn-action-payment--pending:hover {
          background-color: var(--color-brand-hover);
          border-color: var(--color-brand-hover);
        }

        .btn-action-payment--paid {
          background-color: transparent;
          color: var(--color-success);
          border-color: var(--color-success);
        }

        .btn-action-payment--paid:hover {
          background-color: var(--color-success);
          color: white;
        }

        .btn-action-payment:active {
          transform: scale(0.95);
        }

        .btn-action-cancel {
          background: none;
          border: none;
          color: var(--color-text-secondary);
          font-size: 0.75rem;
          cursor: pointer;
          padding: 0.25rem;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .btn-action-cancel:hover {
          color: var(--color-error);
          background-color: rgba(240, 82, 82, 0.08);
        }

        /* MODAIS */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background-color: rgba(20, 17, 15, 0.3);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          max-width: 500px;
          width: 90%;
          padding: 2rem;
          background-color: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.5);
          border-radius: var(--radius-lg);
          box-shadow: 0 20px 40px -15px rgba(20, 17, 15, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.5);
        }

        .modal-content h3 {
          font-size: var(--font-size-lg);
          font-weight: 800;
          margin-bottom: 1.25rem;
          border-bottom: 1px solid rgba(234, 222, 214, 0.8);
          padding-bottom: 0.5rem;
          color: var(--color-text-primary);
        }

        .modal-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .client-type-toggle {
          display: flex;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 0.2rem;
          background-color: rgba(255, 255, 255, 0.5);
        }

        .toggle-btn {
          flex: 1;
          background: none;
          border: none;
          padding: 0.45rem;
          font-size: 0.75rem;
          font-weight: 700;
          border-radius: calc(var(--radius-md) - 2px);
          cursor: pointer;
          color: var(--color-text-secondary);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .toggle-btn--active {
          background-color: var(--color-bg-secondary);
          color: var(--color-brand-primary);
          box-shadow: var(--shadow-sm);
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .form-group label {
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .form-group input,
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

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          border-top: 1px solid rgba(234, 222, 214, 0.8);
          padding-top: 1rem;
          margin-top: 0.5rem;
        }

        .btn--outline-secondary {
          background-color: transparent;
          border: 1px solid var(--color-border);
          color: var(--color-text-secondary);
          font-weight: 600;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .btn--outline-secondary:hover {
          background-color: rgba(255, 255, 255, 0.5);
          transform: translateY(-1px);
        }

        .btn--primary {
          background-color: var(--color-brand-primary);
          color: white;
          border: none;
          font-weight: 700;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .btn--primary:hover {
          background-color: var(--color-brand-hover);
          transform: translateY(-1px);
        }

        .btn--primary:active {
          transform: scale(0.97);
        }
      `}</style>
    </div>
  );
};
