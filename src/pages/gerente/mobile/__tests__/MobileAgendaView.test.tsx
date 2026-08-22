import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MobileAgendaView } from '../MobileAgendaView';
import type { Appointment } from '../../Agenda';

describe('MobileAgendaView Component', () => {
  const mockProfessionals = [
    { id: 'prof-1', name: 'Lucas Barber', is_active: true },
    { id: 'prof-2', name: 'Marcos Silva', is_active: true },
  ];

  const mockAppointments: Appointment[] = [
    {
      id: 'app-1',
      start_time: '2026-08-20T10:00:00Z',
      end_time: '2026-08-20T10:30:00Z',
      status: 'confirmed',
      payment_status: 'pending',
      is_fitting: false,
      customer: { id: 'cust-1', name: 'Carlos Santos', phone: '11999998888' },
      service: { id: 'srv-1', name: 'Corte Degradê', price: 45 },
      professional_id: 'prof-1',
    },
  ];

  const defaultProps = {
    timezone: 'America/Sao_Paulo',
    selectedDate: '2026-08-20',
    onSelectDate: vi.fn(),
    professionals: mockProfessionals,
    appointments: mockAppointments,
    blockedSlots: [],
    timeSlots: ['08:00', '08:30', '09:00', '09:30', '10:00'],
    onOpenNewAppointment: vi.fn(),
    onOpenCheckout: vi.fn(),
    onOpenCancel: vi.fn(),
    onStartService: vi.fn(),
    onDirectWhatsApp: vi.fn(),
    onRemoveBlock: vi.fn(),
  };

  it('renderiza o carrossel de barbeiros e lista o agendamento', () => {
    render(<MobileAgendaView {...defaultProps} />);

    expect(screen.queryByText('Todos')).not.toBeInTheDocument();
    expect(screen.getByText('Lucas')).toBeInTheDocument();
    expect(screen.getByText('Marcos')).toBeInTheDocument();

    expect(screen.getByText('Carlos Santos')).toBeInTheDocument();
    expect(screen.getByText('11999998888')).toBeInTheDocument();
    expect(screen.getByText(/CORTE DEGRADÊ - R\$ 45\.00/i)).toBeInTheDocument();
  });

  it('permite filtrar por profissional ao clicar no chip correspondente', () => {
    render(<MobileAgendaView {...defaultProps} />);

    const marcosChip = screen.getByText('Marcos');
    fireEvent.click(marcosChip);

    // Marcos não tem agendamento, deve mostrar empty state específico
    expect(screen.getByText('Nenhum agendamento para este dia')).toBeInTheDocument();
  });

  it('aciona a comanda ao clicar no card de agendamento compacto', () => {
    render(<MobileAgendaView {...defaultProps} />);

    const card = screen.getByTitle('Toque para abrir a comanda');
    fireEvent.click(card);

    expect(defaultProps.onOpenCheckout).toHaveBeenCalledWith(mockAppointments[0]);
  });

  it('aciona o botão de Encaixe com flag isFitting ativa e o profissional selecionado', () => {
    render(<MobileAgendaView {...defaultProps} />);

    const encaixeBtn = screen.getByTitle('Atender cliente que chegou agora sem agendamento (Encaixe)');
    fireEvent.click(encaixeBtn);

    expect(defaultProps.onOpenNewAppointment).toHaveBeenCalledWith(
      'prof-1',
      undefined,
      true
    );
  });

  it('exibe apenas slots dentro do horário de funcionamento da barbearia', () => {
    const props = {
      ...defaultProps,
      businessHours: {
        quinta: { active: true, open: '09:00', close: '12:00' },
      },
      timeSlots: ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30'],
      appointments: [],
    };

    render(<MobileAgendaView {...props} />);

    // Não deve conter 08:00 nem 12:00
    expect(screen.queryByText('08:00')).not.toBeInTheDocument();
    expect(screen.queryByText('12:00')).not.toBeInTheDocument();

    // Deve conter 09:00 e 11:30
    expect(screen.getByText('09:00')).toBeInTheDocument();
    expect(screen.getByText('11:30')).toBeInTheDocument();
  });

  it('exibe banner de barbearia fechada quando dia for inativo', () => {
    const props = {
      ...defaultProps,
      businessHours: {
        quinta: { active: false, open: '09:00', close: '18:00' },
      },
      appointments: [],
    };

    render(<MobileAgendaView {...props} />);

    expect(screen.getByText('Barbearia fechada neste dia')).toBeInTheDocument();
  });

  it('omite horários de intervalo na agenda do barbeiro e mantém o horário de retorno disponível', () => {
    const profWithBreak = {
      id: 'prof-1',
      name: 'Carlos',
      is_active: true,
      weekly_schedule: {
        thursday: {
          active: true,
          start: '08:00',
          end: '18:00',
          break_start: '12:00',
          break_end: '13:00',
        },
      },
    };

    const props = {
      ...defaultProps,
      selectedDate: '2026-08-20', // Quinta-feira
      selectedProfId: 'prof-1',
      professionals: [profWithBreak],
      timeSlots: ['11:20', '12:00', '12:40', '13:00', '13:40'],
      appointments: [],
      blockedSlots: [],
      businessHours: {
        quinta: { active: true, open: '08:00', close: '18:00' },
      },
    };

    render(<MobileAgendaView {...props} />);

    // 11:20 (antes do intervalo) deve estar visível
    expect(screen.getByText('11:20')).toBeInTheDocument();

    // 12:00 e 12:40 (dentro do intervalo 12:00 às 13:00) NÃO devem aparecer
    expect(screen.queryByText('12:00')).not.toBeInTheDocument();
    expect(screen.queryByText('12:40')).not.toBeInTheDocument();

    // 13:00 (retorno do intervalo) DEVE estar visível e disponível
    expect(screen.getByText('13:00')).toBeInTheDocument();
    expect(screen.getByText('13:40')).toBeInTheDocument();
  });
});
