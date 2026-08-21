import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MobileAgendaView } from '../MobileAgendaView';

describe('MobileAgendaView Component', () => {
  const mockProfessionals = [
    { id: 'prof-1', name: 'Lucas Barber', is_active: true },
    { id: 'prof-2', name: 'Marcos Silva', is_active: true },
  ];

  const mockAppointments = [
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

    expect(screen.getByText('Todos')).toBeInTheDocument();
    expect(screen.getByText('Lucas')).toBeInTheDocument();
    expect(screen.getByText('Marcos')).toBeInTheDocument();

    expect(screen.getByText('Carlos Santos')).toBeInTheDocument();
    expect(screen.getByText('Corte Degradê')).toBeInTheDocument();
    expect(screen.getByText('R$ 45.00')).toBeInTheDocument();
  });

  it('permite filtrar por profissional ao clicar no chip correspondente', () => {
    render(<MobileAgendaView {...defaultProps} />);

    const marcosChip = screen.getByText('Marcos');
    fireEvent.click(marcosChip);

    // Marcos não tem agendamento, deve mostrar empty state específico
    expect(screen.getByText('Nenhum agendamento para este dia')).toBeInTheDocument();
  });

  it('aciona o botão de WhatsApp ao clicar no atalho', () => {
    render(<MobileAgendaView {...defaultProps} />);

    const whatsBtn = screen.getByTitle('Conversar com o cliente no WhatsApp');
    fireEvent.click(whatsBtn);

    expect(defaultProps.onDirectWhatsApp).toHaveBeenCalledWith(
      '11999998888',
      'Carlos Santos',
      expect.any(String)
    );
  });

  it('aciona o botão de Encaixe com flag isFitting ativa', () => {
    render(<MobileAgendaView {...defaultProps} />);

    const encaixeBtn = screen.getByTitle('Atender cliente que chegou agora sem agendamento (Encaixe)');
    fireEvent.click(encaixeBtn);

    expect(defaultProps.onOpenNewAppointment).toHaveBeenCalledWith(
      undefined,
      undefined,
      true
    );
  });
});
