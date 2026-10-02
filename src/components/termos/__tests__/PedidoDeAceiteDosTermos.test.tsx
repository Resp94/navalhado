import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PedidoDeAceiteDosTermos } from '../PedidoDeAceiteDosTermos';

// Spec 052, ticket 16: o pedido de aceite (caixa, erro e botão) que a tela de aceite e a tela de bloqueio mostram.

const caixaDeAceite = () => screen.getByRole('checkbox', { name: /Li e aceito/ });
const botaoDeAceitar = () => screen.getByRole('button', { name: 'Aceitar e continuar' });

describe('PedidoDeAceiteDosTermos', () => {
  it('começa sem aceitar, com o botão travado', () => {
    render(<PedidoDeAceiteDosTermos aceitando={false} erro={null} onAceitar={vi.fn()} />);

    expect(caixaDeAceite()).not.toBeChecked();
    expect(botaoDeAceitar()).toBeDisabled();
  });

  it('marcar o aceite libera o botão, e clicar chama onAceitar uma vez', () => {
    const onAceitar = vi.fn();
    render(<PedidoDeAceiteDosTermos aceitando={false} erro={null} onAceitar={onAceitar} />);

    fireEvent.click(caixaDeAceite());
    expect(botaoDeAceitar()).toBeEnabled();
    fireEvent.click(botaoDeAceitar());

    expect(onAceitar).toHaveBeenCalledTimes(1);
  });

  it('desmarcar de novo trava o botão', () => {
    render(<PedidoDeAceiteDosTermos aceitando={false} erro={null} onAceitar={vi.fn()} />);

    fireEvent.click(caixaDeAceite());
    fireEvent.click(caixaDeAceite());

    expect(botaoDeAceitar()).toBeDisabled();
  });

  it('enquanto o aceite é gravado, o botão mostra o andamento, fica travado e a caixa não muda', () => {
    render(<PedidoDeAceiteDosTermos aceitando erro={null} onAceitar={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Registrando…' })).toBeDisabled();
    expect(caixaDeAceite()).toBeDisabled();
  });

  it('mostra o erro de gravar o aceite, e a caixa marcada continua marcada para tentar de novo', () => {
    const { rerender } = render(<PedidoDeAceiteDosTermos aceitando={false} erro={null} onAceitar={vi.fn()} />);
    fireEvent.click(caixaDeAceite());

    rerender(
      <PedidoDeAceiteDosTermos aceitando={false} erro="Não foi possível registrar o seu aceite. Tente de novo." onAceitar={vi.fn()} />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível registrar o seu aceite. Tente de novo.');
    expect(caixaDeAceite()).toBeChecked();
    expect(botaoDeAceitar()).toBeEnabled();
  });

  it('sem erro, não mostra alerta', () => {
    render(<PedidoDeAceiteDosTermos aceitando={false} erro={null} onAceitar={vi.fn()} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
