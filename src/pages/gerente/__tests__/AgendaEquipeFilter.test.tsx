import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AgendaEquipeFilter } from '../AgendaEquipeFilter';
import type { Professional } from '../Agenda';

describe('AgendaEquipeFilter Component', () => {
  const mockProfessionals: Professional[] = [
    { id: 'prof-1', name: 'Carlos Barbeiro', is_active: true },
    { id: 'prof-2', name: 'Marcos Navalha', is_active: true },
  ];

  it('renderiza botão com contagem correta', () => {
    render(
      <AgendaEquipeFilter
        professionals={mockProfessionals}
        selectedProfessionalIds={['prof-1', 'prof-2']}
        onToggleProfessional={vi.fn()}
        onSelectAllProfessionals={vi.fn()}
      />
    );

    const btn = screen.getByRole('button', { name: /Filtrar Equipe/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent('Equipe (2)');
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });

  it('renderiza botão com contagem de 1 quando apenas 1 profissional está selecionado', () => {
    render(
      <AgendaEquipeFilter
        professionals={mockProfessionals}
        selectedProfessionalIds={['prof-1']}
        onToggleProfessional={vi.fn()}
        onSelectAllProfessionals={vi.fn()}
      />
    );

    const btn = screen.getByRole('button', { name: /Filtrar Equipe/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent('Equipe (1)');
    expect(btn).toHaveAttribute('title', 'Filtrar Equipe');
  });

  it('abre dropdown com checkboxes e botão Todos para seleção múltipla', async () => {
    const user = userEvent.setup();
    const handleToggle = vi.fn();
    const handleSelectAll = vi.fn();

    render(
      <AgendaEquipeFilter
        professionals={mockProfessionals}
        selectedProfessionalIds={['prof-1']}
        onToggleProfessional={handleToggle}
        onSelectAllProfessionals={handleSelectAll}
      />
    );

    const btn = screen.getByRole('button', { name: /Filtrar Equipe/i });
    await user.click(btn);

    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Exibir Barbeiros')).toBeInTheDocument();

    const todosBtn = screen.getByRole('button', { name: /Selecionar todos os barbeiros/i });
    await user.click(todosBtn);
    expect(handleSelectAll).toHaveBeenCalledTimes(1);

    const carlosItem = screen.getByRole('menuitemcheckbox', { name: 'Carlos Barbeiro' });
    expect(carlosItem).toHaveAttribute('aria-checked', 'true');
    await user.click(carlosItem);
    expect(handleToggle).toHaveBeenCalledWith('prof-1');

    const marcosItem = screen.getByRole('menuitemcheckbox', { name: 'Marcos Navalha' });
    expect(marcosItem).toHaveAttribute('aria-checked', 'false');
    await user.click(marcosItem);
    expect(handleToggle).toHaveBeenCalledWith('prof-2');
  });

  it('fecha o dropdown ao pressionar a tecla Escape', async () => {
    const user = userEvent.setup();
    render(
      <AgendaEquipeFilter
        professionals={mockProfessionals}
        selectedProfessionalIds={['prof-1']}
        onToggleProfessional={vi.fn()}
        onSelectAllProfessionals={vi.fn()}
      />
    );

    const btn = screen.getByRole('button', { name: /Filtrar Equipe/i });
    await user.click(btn);
    expect(screen.getByText('Exibir Barbeiros')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByText('Exibir Barbeiros')).toBeNull();
  });

  it('fecha o dropdown ao clicar fora', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <div data-testid="outside-area">Fora</div>
        <AgendaEquipeFilter
          professionals={mockProfessionals}
          selectedProfessionalIds={['prof-1']}
          onToggleProfessional={vi.fn()}
          onSelectAllProfessionals={vi.fn()}
        />
      </div>
    );

    const btn = screen.getByRole('button', { name: /Filtrar Equipe/i });
    await user.click(btn);
    expect(screen.getByText('Exibir Barbeiros')).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByTestId('outside-area'));
    expect(screen.queryByText('Exibir Barbeiros')).toBeNull();
  });
});
