import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from '../../Toast';
import { MobileMaisDrawer } from '../MobileMaisDrawer';
import { MobileBottomNav, type MobileNavItem } from '../MobileBottomNav';
import { Calendar03Icon, Invoice01Icon, Money01Icon, UserIcon, Menu01Icon } from '@hugeicons/core-free-icons';

/**
 * Módulo de Relatórios (spec 038): exclusivo do desktop, então o item
 * "Relatórios" não pode aparecer nem na barra inferior nem na gaveta
 * "Mais" do celular. `MobileBottomNav` é genérico (a lista de itens vem
 * de `GerenteLayout`, que não inclui "Relatórios"); este teste trava essa
 * lista real, e o comportamento de `MobileMaisDrawer` (grade fixa de
 * atalhos, sem "Relatórios").
 */
describe('Navegação móvel sem o item Relatórios', () => {
  it('MobileBottomNav com os itens reais do GerenteLayout não mostra "Relatórios"', () => {
    const items: MobileNavItem[] = [
      { id: 'agenda', label: 'Agenda', icon: Calendar03Icon, path: '/agenda' },
      { id: 'comandas', label: 'Comandas', icon: Invoice01Icon, path: '/comandas' },
      { id: 'caixa', label: 'Caixa', icon: Money01Icon, path: '/financeiro' },
      { id: 'clientes', label: 'Clientes', icon: UserIcon, path: '/clientes' },
      { id: 'mais', label: 'Mais', icon: Menu01Icon, onClick: () => {} },
    ];

    render(
      <BrowserRouter>
        <MobileBottomNav items={items} />
      </BrowserRouter>
    );

    expect(items.some((item) => item.label === 'Relatórios')).toBe(false);
    expect(screen.queryByText('Relatórios')).not.toBeInTheDocument();
  });

  it('MobileMaisDrawer não lista "Relatórios" entre os atalhos de gerenciamento', () => {
    render(
      <ToastProvider>
        <BrowserRouter>
          <MobileMaisDrawer
            isOpen
            onClose={vi.fn()}
            tenantId="tenant-1"
            tenantName="Barbearia Navalha"
            managerName="Gerente"
            onLogout={vi.fn()}
          />
        </BrowserRouter>
      </ToastProvider>
    );

    expect(screen.queryByText('Relatórios')).not.toBeInTheDocument();
  });
});
