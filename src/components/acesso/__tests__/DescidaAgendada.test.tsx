import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDesfazer } = vi.hoisted(() => ({ mockDesfazer: vi.fn() }));

vi.mock('../../../modules/assinatura/repositorio', () => ({
  assinaturaRepository: { desfazerDescidaDePlano: (...args: unknown[]) => mockDesfazer(...args) },
}));

import { DescidaAgendada } from '../DescidaAgendada';

// Spec 052, ticket 11: a tela Assinatura mostra a descida de plano agendada ("Muda para Tesoura em DD/MM") e deixa o
// Gerente desfazê-la antes da data. Descer não cobra nem reembolsa nada: o plano menor vale na próxima cobrança.

const tesoura = { id: 'plano-tesoura', nome: 'Tesoura', preco: 59.9 };
const fimDoPeriodo = new Date('2026-10-29T23:26:22Z');

const renderizar = (extra: Partial<React.ComponentProps<typeof DescidaAgendada>> = {}) => {
  const onDesfeita = vi.fn();
  render(<DescidaAgendada planoAgendado={tesoura} dataDaMudanca={fimDoPeriodo} onDesfeita={onDesfeita} {...extra} />);
  return { onDesfeita };
};

describe('DescidaAgendada', () => {
  beforeEach(() => {
    mockDesfazer.mockReset();
  });

  it('diz para qual plano a assinatura muda e em que dia', () => {
    renderizar();

    const grupo = screen.getByRole('group', { name: 'Descida de plano agendada' });
    expect(grupo).toHaveTextContent('Muda para Tesoura em 29/10');
  });

  it('explica o que a descida faz: vale na próxima cobrança, pelo preço do plano menor, e o limite menor já vale', () => {
    renderizar();

    const grupo = screen.getByRole('group', { name: 'Descida de plano agendada' });
    expect(grupo).toHaveTextContent('Até lá você continua no plano atual.');
    expect(grupo).toHaveTextContent(/A próxima cobrança é de R\$\s59,90\./);
    expect(grupo).toHaveTextContent('O limite do plano menor já vale para cadastrar profissionais.');
  });

  // Sem a data: o período pago já venceu e o aviso da mensalidade ainda não chegou, ou o pagamento foi recusado e o
  // Mercado Pago tenta de novo. Mostrar uma data vencida contradiz a tela, então a descida vale "na próxima cobrança aprovada".
  it('sem a data, diz que muda na próxima cobrança aprovada', () => {
    renderizar({ dataDaMudanca: null });

    const grupo = screen.getByRole('group', { name: 'Descida de plano agendada' });
    expect(grupo).toHaveTextContent('Muda para Tesoura na próxima cobrança aprovada');
    expect(screen.getByRole('button', { name: 'Desfazer' })).toBeEnabled();
  });

  it('usa o fuso da barbearia para o dia', () => {
    // 02:30 UTC de 30/10 ainda é 29/10 em Brasília e já é 30/10 em Lisboa.
    renderizar({ dataDaMudanca: new Date('2026-10-30T02:30:00Z'), timezone: 'Europe/Lisbon' });

    expect(screen.getByRole('group', { name: 'Descida de plano agendada' })).toHaveTextContent('em 30/10');
  });

  it('"Desfazer" pede à função de cobrança e avisa a tela, que relê a assinatura', async () => {
    mockDesfazer.mockResolvedValue(undefined);
    const { onDesfeita } = renderizar();

    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));

    await waitFor(() => expect(onDesfeita).toHaveBeenCalledTimes(1));
    expect(mockDesfazer).toHaveBeenCalledTimes(1);
  });

  // Depois de desfeita a descida o aviso fica na tela até a releitura da assinatura chegar. Com o botão de volta, um clique
  // nessa janela pediria de novo e levaria um 409 ("não há descida agendada") num aviso que está para sumir.
  it('depois de desfazer, o botão some até a tela reler a assinatura: não dá para pedir outra vez', async () => {
    mockDesfazer.mockResolvedValue(undefined);
    const { onDesfeita } = renderizar();

    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));

    await waitFor(() => expect(onDesfeita).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: 'Desfazer' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Descida desfeita');
    expect(mockDesfazer).toHaveBeenCalledTimes(1);
  });

  it('enquanto desfaz, o botão fica desabilitado: um clique repetido não pede duas vezes', async () => {
    let concluir: () => void = () => {};
    mockDesfazer.mockReturnValue(new Promise<void>((resolve) => (concluir = resolve)));
    renderizar();

    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));

    expect(screen.getByRole('button', { name: 'Desfazer' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(mockDesfazer).toHaveBeenCalledTimes(1);
    await act(async () => concluir());
  });

  it('se não deu para desfazer, mostra o motivo, mantém o botão para tentar de novo e não avisa a tela', async () => {
    mockDesfazer.mockRejectedValue(new Error('Não foi possível desfazer a descida de plano agora. Tente de novo em instantes.'));
    const { onDesfeita } = renderizar();

    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível desfazer a descida de plano agora.');
    expect(screen.getByRole('button', { name: 'Desfazer' })).toBeEnabled();
    expect(onDesfeita).not.toHaveBeenCalled();
  });

  it('tentar de novo depois de uma falha limpa o erro', async () => {
    mockDesfazer.mockRejectedValueOnce(new Error('Não foi possível desfazer a descida de plano agora.'));
    mockDesfazer.mockResolvedValueOnce(undefined);
    const { onDesfeita } = renderizar();
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    await screen.findByRole('alert');

    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));

    await waitFor(() => expect(onDesfeita).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
