import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { POLITICA_DE_PRIVACIDADE, TERMOS_DE_USO } from '../../../modules/termos/textos';
import { AceiteDosTermos } from '../AceiteDosTermos';

// Spec 052, ticket 16: a caixa "Li e aceito", com os links dos dois textos, é uma só para o cadastro, a tela de aceite e a tela de
// bloqueio: a frase que o usuário aceita não pode mudar de uma tela para outra.

describe('AceiteDosTermos', () => {
  it('mostra a caixa com a frase do aceite e os dois links, e começa como o chamador mandou', () => {
    const { rerender } = render(<AceiteDosTermos aceitou={false} onChange={vi.fn()} />);

    expect(screen.getByRole('checkbox', { name: 'Li e aceito os Termos de Uso e a Política de Privacidade.' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Termos de Uso' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Política de Privacidade' })).toBeInTheDocument();

    rerender(<AceiteDosTermos aceitou onChange={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: /Li e aceito/ })).toBeChecked();
  });

  it('marcar e desmarcar chamam onChange com o valor novo', () => {
    const onChange = vi.fn();
    const { rerender } = render(<AceiteDosTermos aceitou={false} onChange={onChange} />);

    fireEvent.click(screen.getByRole('checkbox', { name: /Li e aceito/ }));
    expect(onChange).toHaveBeenLastCalledWith(true);

    rerender(<AceiteDosTermos aceitou onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Li e aceito/ }));
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it('desabilitada, a caixa não muda', () => {
    render(<AceiteDosTermos aceitou={false} onChange={vi.fn()} disabled />);

    expect(screen.getByRole('checkbox', { name: /Li e aceito/ })).toBeDisabled();
  });

  it('os links abrem os Termos de Uso e a Política de Privacidade, e fechar volta à caixa', () => {
    render(<AceiteDosTermos aceitou={false} onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Termos de Uso' }));
    expect(screen.getByRole('heading', { name: TERMOS_DE_USO.titulo })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('heading', { name: TERMOS_DE_USO.titulo })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Política de Privacidade' }));
    expect(screen.getByRole('heading', { name: POLITICA_DE_PRIVACIDADE.titulo })).toBeInTheDocument();
  });

  it('ler os textos não marca o aceite', () => {
    const onChange = vi.fn();
    render(<AceiteDosTermos aceitou={false} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Termos de Uso' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: /Li e aceito/ })).not.toBeChecked();
  });
});
