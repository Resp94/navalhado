import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileHeader } from '../MobileHeader';

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../NotificationBell', () => ({ NotificationBell: () => <div data-testid="bell" /> }));

const baseProps = {
  tenantName: 'Barbearia Alpha',
  notifications: [],
  unreadCount: 0,
  onMarkAllAsRead: vi.fn(),
  onMarkAsRead: vi.fn(),
};

describe('MobileHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('leva para a agenda do gestor por padrão', () => {
    render(<MobileHeader {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: /Página inicial da barbearia Barbearia Alpha/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/agenda');
  });

  it('leva para a página inicial do papel quando ela é outra (barbeiro)', () => {
    render(<MobileHeader {...baseProps} homePath="/minha-agenda" />);

    fireEvent.click(screen.getByRole('button', { name: /Página inicial da barbearia Barbearia Alpha/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/minha-agenda');
  });
});
