import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MobileBottomSheet } from '../MobileBottomSheet';

describe('MobileBottomSheet Component', () => {
  it('não renderiza nada quando isOpen for false', () => {
    render(
      <MobileBottomSheet isOpen={false} onClose={vi.fn()} title="Gaveta de Teste">
        <div>Conteúdo Oculto</div>
      </MobileBottomSheet>
    );

    expect(screen.queryByText('Conteúdo Oculto')).not.toBeInTheDocument();
  });

  it('renderiza o conteúdo e chama onClose ao clicar no botão fechar', () => {
    const handleClose = vi.fn();
    render(
      <MobileBottomSheet isOpen={true} onClose={handleClose} title="Gaveta de Teste">
        <div>Conteúdo Visível</div>
      </MobileBottomSheet>
    );

    expect(screen.getByText('Conteúdo Visível')).toBeInTheDocument();
    expect(screen.getByText('Gaveta de Teste')).toBeInTheDocument();

    const closeButton = screen.getByLabelText('Fechar');
    fireEvent.click(closeButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
