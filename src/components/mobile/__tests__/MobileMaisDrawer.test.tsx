import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from '../../Toast';
import { MobileMaisDrawer } from '../MobileMaisDrawer';

describe('MobileMaisDrawer Component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    tenantId: 'tenant-123',
    tenantName: 'Barbearia Navalha',
    managerName: 'Lucas Gerente',
    onLogout: vi.fn(),
  };

  it('renderiza o perfil do gerente, atalhos de gerenciamento e botão de logout', () => {
    render(
      <ToastProvider>
        <BrowserRouter>
          <MobileMaisDrawer {...defaultProps} />
        </BrowserRouter>
      </ToastProvider>
    );

    expect(screen.getByText('Lucas Gerente')).toBeInTheDocument();
    expect(screen.getByText('Copiar Link da Barbearia')).toBeInTheDocument();
    expect(screen.getByText('Equipe')).toBeInTheDocument();
    expect(screen.getByText('Serviços')).toBeInTheDocument();
    expect(screen.getByText('Produtos')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Ajustes')).toBeInTheDocument();
    expect(screen.getByText('Sair da Conta')).toBeInTheDocument();

    const logoutBtn = screen.getByRole('button', { name: /Sair da Conta/i });
    fireEvent.click(logoutBtn);
    expect(defaultProps.onLogout).toHaveBeenCalledTimes(1);
  });
});
