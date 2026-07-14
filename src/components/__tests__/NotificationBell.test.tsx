import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NotificationBell } from '../NotificationBell';

// Mock de dados de notificação
const mockNotifications = [
  {
    id: '1',
    tenant_id: 'tenant-123',
    profissional_id: null,
    type: 'appointment_created',
    title: 'Novo agendamento',
    message: 'Jonathas agendou um corte de cabelo.',
    created_at: '2026-07-14T14:49:00Z',
    read: false,
  },
  {
    id: '2',
    tenant_id: 'tenant-123',
    profissional_id: null,
    type: 'payment_received',
    title: 'Pagamento recebido',
    message: 'Recebido R$ 50,00 de Jonathas.',
    created_at: '2026-07-14T14:30:00Z',
    read: true,
  },
];

describe('NotificationBell Component - TDD', () => {
  it('deve renderizar o botão de sininho', () => {
    render(
      <NotificationBell
        notifications={[]}
        unreadCount={0}
        onMarkAllAsRead={vi.fn()}
        onMarkAsRead={vi.fn()}
      />
    );

    const button = screen.getByRole('button', { name: /notificações/i });
    expect(button).toBeInTheDocument();
  });

  it('deve renderizar o badge com a contagem correta de notificações não lidas', () => {
    render(
      <NotificationBell
        notifications={mockNotifications}
        unreadCount={1}
        onMarkAllAsRead={vi.fn()}
        onMarkAsRead={vi.fn()}
      />
    );

    const badge = screen.getByText('1');
    expect(badge).toBeInTheDocument();
  });

  it('não deve exibir o badge se a contagem for zero', () => {
    render(
      <NotificationBell
        notifications={mockNotifications}
        unreadCount={0}
        onMarkAllAsRead={vi.fn()}
        onMarkAsRead={vi.fn()}
      />
    );

    const badge = screen.queryByText('0');
    expect(badge).not.toBeInTheDocument();
  });

  it('deve abrir o dropdown ao clicar no botão do sininho', () => {
    render(
      <NotificationBell
        notifications={mockNotifications}
        unreadCount={1}
        onMarkAllAsRead={vi.fn()}
        onMarkAsRead={vi.fn()}
      />
    );

    // Inicialmente o dropdown não deve estar visível ou não renderizado
    expect(screen.queryByText('Novo agendamento')).not.toBeInTheDocument();

    const button = screen.getByRole('button', { name: /notificações/i });
    fireEvent.click(button);

    // Agora o dropdown deve estar visível
    expect(screen.getByText('Novo agendamento')).toBeInTheDocument();
    expect(screen.getByText('Pagamento recebido')).toBeInTheDocument();
  });

  it('deve exibir "Nenhuma notificação por aqui" quando a lista estiver vazia', () => {
    render(
      <NotificationBell
        notifications={[]}
        unreadCount={0}
        onMarkAllAsRead={vi.fn()}
        onMarkAsRead={vi.fn()}
      />
    );

    const button = screen.getByRole('button', { name: /notificações/i });
    fireEvent.click(button);

    expect(screen.getByText('Nenhuma notificação por aqui')).toBeInTheDocument();
  });

  it('deve chamar onMarkAllAsRead ao clicar em "Marcar todas como lidas"', () => {
    const handleMarkAllAsRead = vi.fn();
    render(
      <NotificationBell
        notifications={mockNotifications}
        unreadCount={1}
        onMarkAllAsRead={handleMarkAllAsRead}
        onMarkAsRead={vi.fn()}
      />
    );

    const button = screen.getByRole('button', { name: /notificações/i });
    fireEvent.click(button);

    const markAllButton = screen.getByRole('button', { name: /marcar todas como lidas/i });
    fireEvent.click(markAllButton);

    expect(handleMarkAllAsRead).toHaveBeenCalledTimes(1);
  });

  it('deve chamar onMarkAsRead com o id correto ao clicar para marcar uma notificação individual como lida', () => {
    const handleMarkAsRead = vi.fn();
    render(
      <NotificationBell
        notifications={mockNotifications}
        unreadCount={1}
        onMarkAllAsRead={vi.fn()}
        onMarkAsRead={handleMarkAsRead}
      />
    );

    const button = screen.getByRole('button', { name: /notificações/i });
    fireEvent.click(button);

    // Botão para marcar a primeira notificação (não lida) como lida
    const markAsReadButtons = screen.getAllByRole('button', { name: /marcar como lida/i });
    fireEvent.click(markAsReadButtons[0]);

    expect(handleMarkAsRead).toHaveBeenCalledWith('1');
  });
});
