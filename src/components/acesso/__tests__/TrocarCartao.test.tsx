import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CartaoRepository } from '../../../modules/cartao/CartaoRepository';
import { InMemoryCartaoAdapter } from '../../../modules/cartao/adapters/InMemoryCartaoAdapter';

const { mockTrocarCartao } = vi.hoisted(() => ({ mockTrocarCartao: vi.fn() }));

vi.mock('../../../modules/assinatura/repositorio', () => ({
  assinaturaRepository: { trocarCartao: (...args: unknown[]) => mockTrocarCartao(...args) },
}));

import { TrocarCartao } from '../TrocarCartao';

// Spec 052, ticket 09: o fluxo de trocar o cartão. Começa como um botão; o formulário abre no lugar
// dele. O token vem do formulário (falso no teste) e segue para a função de cobrança; depois a tela
// avisa o que acontece com a próxima cobrança e deixa fechar ou trocar de novo.

const CPF_VALIDO = '529.982.247-25';

const renderizar = (props: Partial<React.ComponentProps<typeof TrocarCartao>> = {}) => {
  const adapter = new InMemoryCartaoAdapter();
  const onTrocado = vi.fn();
  render(<TrocarCartao onTrocado={onTrocado} repositorio={new CartaoRepository(adapter)} {...props} />);
  return { adapter, onTrocado };
};

const abrir = async (props: Partial<React.ComponentProps<typeof TrocarCartao>> = {}) => {
  const contexto = renderizar(props);
  await userEvent.click(screen.getByRole('button', { name: 'Trocar cartão' }));
  await waitFor(() => expect(contexto.adapter.montados).toHaveLength(1));
  return contexto;
};

const preencherEEnviar = async () => {
  await userEvent.type(screen.getByLabelText('Nome no cartão'), 'Maria da Silva');
  await userEvent.type(screen.getByLabelText('CPF ou CNPJ do titular'), CPF_VALIDO);
  await userEvent.click(screen.getByRole('button', { name: 'Trocar cartão' }));
};

describe('TrocarCartao', () => {
  beforeEach(() => {
    mockTrocarCartao.mockReset();
  });

  it('começa só com o botão: o formulário do cartão (e o SDK do Mercado Pago) só carregam ao abrir', () => {
    const { adapter } = renderizar();

    expect(screen.getByRole('button', { name: 'Trocar cartão' })).toBeEnabled();
    expect(screen.queryByLabelText('Nome no cartão')).not.toBeInTheDocument();
    expect(adapter.montados).toHaveLength(0);
  });

  it('o botão é secundário; com "destaque" (tela de bloqueio) é a ação principal', () => {
    const { unmount } = render(<TrocarCartao repositorio={new CartaoRepository(new InMemoryCartaoAdapter())} />);
    expect(screen.getByRole('button', { name: 'Trocar cartão' })).toHaveAttribute('data-variant', 'outline');
    unmount();

    render(<TrocarCartao destaque repositorio={new CartaoRepository(new InMemoryCartaoAdapter())} />);
    expect(screen.getByRole('button', { name: 'Trocar cartão' })).toHaveAttribute('data-variant', 'primary');
  });

  it('abre o formulário no lugar do botão e "Cancelar" volta ao botão, sem trocar nada', async () => {
    const { adapter } = await abrir();
    expect(screen.getByLabelText('Nome no cartão')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByLabelText('Nome no cartão')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trocar cartão' })).toBeInTheDocument();
    expect(adapter.montados).toHaveLength(0);
    expect(mockTrocarCartao).not.toHaveBeenCalled();
  });

  it('manda só o token à função de cobrança e avisa que a próxima cobrança sai no cartão novo', async () => {
    mockTrocarCartao.mockResolvedValue({ bandeira: 'master', final: '5555' });
    const { onTrocado } = await abrir();

    await preencherEEnviar();

    await waitFor(() => expect(mockTrocarCartao).toHaveBeenCalledWith('token-falso-1', '0604'));
    expect(mockTrocarCartao).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('status')).toHaveTextContent('Cartão trocado. A próxima cobrança sai no cartão novo.');
    expect(onTrocado).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('Nome no cartão')).not.toBeInTheDocument();
  });

  it('com o pagamento recusado, diz que o Mercado Pago tenta a cobrança de novo, sem prazo certo, e que a assinatura volta ao normal', async () => {
    mockTrocarCartao.mockResolvedValue({ bandeira: 'master', final: '5555' });
    await abrir({ cobrancaPendente: true });

    await preencherEEnviar();

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Cartão trocado. O Mercado Pago vai tentar a cobrança pendente de novo no cartão novo, por conta própria, e isso pode levar alguns dias. Quando ela for aprovada, a assinatura volta ao normal.',
    );
  });

  it('já bloqueada por pagamento recusado, diz que o acesso volta quando a cobrança for aprovada', async () => {
    mockTrocarCartao.mockResolvedValue({ bandeira: 'master', final: '5555' });
    await abrir({ cobrancaPendente: true, acessoBloqueado: true });

    await preencherEEnviar();

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Cartão trocado. O Mercado Pago vai tentar a cobrança pendente de novo no cartão novo, por conta própria, e isso pode levar alguns dias. Quando ela for aprovada, o acesso volta ao normal.',
    );
  });

  it('a função recusa a troca: mostra o motivo, mantém o formulário e não avisa que trocou', async () => {
    mockTrocarCartao.mockRejectedValue(new Error('O Mercado Pago não aceitou o cartão. Confira os dados ou use outro cartão.'));
    const { onTrocado } = await abrir();

    await preencherEEnviar();

    expect(await screen.findByRole('alert')).toHaveTextContent('O Mercado Pago não aceitou o cartão.');
    expect(screen.getByLabelText('Nome no cartão')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(onTrocado).not.toHaveBeenCalled();
  });

  it('depois de uma recusa, tentar de novo com outro cartão limpa o erro e manda o novo token', async () => {
    mockTrocarCartao.mockRejectedValueOnce(new Error('O Mercado Pago não aceitou o cartão.'));
    mockTrocarCartao.mockResolvedValueOnce({ bandeira: 'visa', final: '1111' });
    await abrir();
    await preencherEEnviar();
    await screen.findByRole('alert');

    await userEvent.click(screen.getByRole('button', { name: 'Trocar cartão' }));

    await waitFor(() => expect(mockTrocarCartao).toHaveBeenLastCalledWith('token-falso-2', '0604'));
    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('cancelar depois de uma recusa não deixa o erro antigo no formulário seguinte', async () => {
    mockTrocarCartao.mockRejectedValueOnce(new Error('O Mercado Pago não aceitou o cartão.'));
    const { adapter } = await abrir();
    await preencherEEnviar();
    await screen.findByRole('alert');

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Trocar cartão' }));
    await waitFor(() => expect(adapter.montados).toHaveLength(1));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('depois de trocar, "Fechar" volta ao botão e deixa trocar o cartão de novo', async () => {
    mockTrocarCartao.mockResolvedValue({ bandeira: 'master', final: '5555' });
    const { adapter } = await abrir();
    await preencherEEnviar();
    await screen.findByRole('status');

    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trocar cartão' })).toBeInTheDocument();
    expect(adapter.montados).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: 'Trocar cartão' }));
    await waitFor(() => expect(adapter.montados).toHaveLength(1));
    expect(screen.getByLabelText('Nome no cartão')).toHaveValue('');
    await preencherEEnviar();

    await waitFor(() => expect(mockTrocarCartao).toHaveBeenLastCalledWith('token-falso-2', '0604'));
    expect(mockTrocarCartao).toHaveBeenCalledTimes(2);
  });
});
