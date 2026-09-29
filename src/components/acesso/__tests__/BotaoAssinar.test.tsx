import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockAssinar } = vi.hoisted(() => ({ mockAssinar: vi.fn() }));

vi.mock('../../../modules/assinatura/repositorio', () => ({
  assinaturaRepository: { assinar: (...args: unknown[]) => mockAssinar(...args) },
}));

import { BotaoAssinar } from '../BotaoAssinar';

// Spec 052, ticket 05: "Assinar" (Configurações) e "Pagar" (tela de bloqueio) chamam a função de
// cobrança e abrem o link de pagamento do Mercado Pago que ela devolve.

const criada = {
  linkDePagamento: 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=pre-1',
  assinaturaId: 'pre-1',
  primeiraCobrancaEm: null,
};

describe('BotaoAssinar', () => {
  beforeEach(() => {
    mockAssinar.mockReset();
  });

  it('chama a assinatura e abre o link que a função devolveu', async () => {
    mockAssinar.mockResolvedValue(criada);
    const abrirLink = vi.fn();
    render(<BotaoAssinar abrirLink={abrirLink} />);

    await userEvent.click(screen.getByRole('button', { name: 'Assinar' }));

    await waitFor(() => expect(abrirLink).toHaveBeenCalledWith(criada.linkDePagamento));
    expect(mockAssinar).toHaveBeenCalledTimes(1);
  });

  it('usa o rótulo pedido (Pagar, na tela de bloqueio)', () => {
    render(<BotaoAssinar rotulo="Pagar" abrirLink={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Pagar' })).toBeEnabled();
  });

  it('um segundo clique enquanto a assinatura é criada não cria outra', async () => {
    let concluir: (valor: typeof criada) => void = () => {};
    mockAssinar.mockReturnValue(new Promise((resolve) => { concluir = resolve; }));
    render(<BotaoAssinar abrirLink={vi.fn()} />);

    const botao = screen.getByRole('button', { name: 'Assinar' });
    await userEvent.click(botao);
    await userEvent.click(botao);

    expect(mockAssinar).toHaveBeenCalledTimes(1);
    expect(botao).toBeDisabled();
    concluir(criada);
  });

  // Voltar do Mercado Pago pelo botão do navegador restaura a página do cache (bfcache) como ela
  // ficou: sem isso, o botão continuaria preso em "carregando".
  it('ao voltar do Mercado Pago pelo navegador, o botão volta a valer', async () => {
    mockAssinar.mockResolvedValue(criada);
    render(<BotaoAssinar abrirLink={vi.fn()} />);

    const botao = screen.getByRole('button', { name: 'Assinar' });
    await userEvent.click(botao);
    await waitFor(() => expect(botao).toBeDisabled());

    const restaurada = new Event('pageshow');
    Object.defineProperty(restaurada, 'persisted', { value: true });
    act(() => {
      window.dispatchEvent(restaurada);
    });

    expect(screen.getByRole('button', { name: 'Assinar' })).toBeEnabled();
  });

  it('mostra a mensagem da recusa e deixa tentar de novo', async () => {
    mockAssinar.mockRejectedValue(new Error('A barbearia já tem uma assinatura ativa.'));
    const abrirLink = vi.fn();
    render(<BotaoAssinar abrirLink={abrirLink} />);

    await userEvent.click(screen.getByRole('button', { name: 'Assinar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('A barbearia já tem uma assinatura ativa.');
    expect(abrirLink).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Assinar' })).toBeEnabled();
  });

  it('a mensagem de erro some no próximo clique', async () => {
    mockAssinar.mockRejectedValueOnce(new Error('Falhou.'));
    mockAssinar.mockResolvedValueOnce(criada);
    render(<BotaoAssinar abrirLink={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Assinar' }));
    await screen.findByRole('alert');
    await userEvent.click(screen.getByRole('button', { name: 'Assinar' }));

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});
