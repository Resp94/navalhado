import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AgendaEquipeFilter } from '../AgendaEquipeFilter';
import type { Professional } from '../Agenda';

describe('AgendaEquipeFilter Component', () => {
  const mockProfessionals: Professional[] = [
    { id: 'prof-1', name: 'Carlos Barbeiro', is_active: true },
    { id: 'prof-2', name: 'Marcos Navalha', is_active: true },
  ];

  it('renderiza botão com classe btn-agenda-filter e contagem correta', () => {
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
    expect(btn).toHaveClass('btn-agenda-filter');
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
    expect(btn).toHaveClass('btn-agenda-filter');
    expect(btn).toHaveTextContent('Equipe (1)');
    expect(btn).toHaveAttribute('title', 'Filtrar Equipe');
  });

  it('abre dropdown com checkboxes e botão Todos para seleção múltipla', () => {
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
    fireEvent.click(btn);

    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Exibir Barbeiros')).toBeInTheDocument();

    const todosBtn = screen.getByRole('button', { name: /Selecionar todos os barbeiros/i });
    fireEvent.click(todosBtn);
    expect(handleSelectAll).toHaveBeenCalledTimes(1);

    const carlosCheckbox = screen.getByLabelText('Carlos Barbeiro');
    expect(carlosCheckbox).toHaveAttribute('type', 'checkbox');
    expect(carlosCheckbox).toBeChecked();
    fireEvent.click(carlosCheckbox);
    expect(handleToggle).toHaveBeenCalledWith('prof-1');

    const marcosCheckbox = screen.getByLabelText('Marcos Navalha');
    expect(marcosCheckbox).toHaveAttribute('type', 'checkbox');
    expect(marcosCheckbox).not.toBeChecked();
    fireEvent.click(marcosCheckbox);
    expect(handleToggle).toHaveBeenCalledWith('prof-2');
  });

  it('fecha o dropdown ao pressionar a tecla Escape', () => {
    render(
      <AgendaEquipeFilter
        professionals={mockProfessionals}
        selectedProfessionalIds={['prof-1']}
        onToggleProfessional={vi.fn()}
        onSelectAllProfessionals={vi.fn()}
      />
    );

    const btn = screen.getByRole('button', { name: /Filtrar Equipe/i });
    fireEvent.click(btn);
    expect(screen.getByText('Exibir Barbeiros')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Exibir Barbeiros')).toBeNull();
  });

  it('fecha o dropdown ao clicar fora', () => {
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
    fireEvent.click(btn);
    expect(screen.getByText('Exibir Barbeiros')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId('outside-area'));
    expect(screen.queryByText('Exibir Barbeiros')).toBeNull();
  });
});
