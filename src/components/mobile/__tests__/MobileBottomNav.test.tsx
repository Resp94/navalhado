import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { MobileBottomNav, type MobileNavItem } from '../MobileBottomNav';
import { Calendar03Icon, Money01Icon } from '@hugeicons/core-free-icons';

describe('MobileBottomNav Component', () => {
  it('renderiza os itens de navegação corretamente com links e botões', () => {
    const handleClick = vi.fn();
    const items: MobileNavItem[] = [
      { id: 'agenda', label: 'Agenda', icon: Calendar03Icon, path: '/agenda' },
      { id: 'mais', label: 'Mais', icon: Money01Icon, onClick: handleClick },
    ];

    render(
      <BrowserRouter>
        <MobileBottomNav items={items} activeItemId="agenda" />
      </BrowserRouter>
    );

    expect(screen.getByText('Agenda')).toBeInTheDocument();
    expect(screen.getByText('Mais')).toBeInTheDocument();

    const maisButton = screen.getByRole('button', { name: /Mais/i, hidden: true });
    fireEvent.click(maisButton);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
