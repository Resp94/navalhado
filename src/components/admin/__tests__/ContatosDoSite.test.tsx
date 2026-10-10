import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { contatoDeTeste } from '../../../modules/contatos-do-site/adapters/InMemoryContatosDoSiteAdapter';
import { ContatosDoSiteError } from '../../../modules/contatos-do-site/types';

const { mockListar } = vi.hoisted(() => ({ mockListar: vi.fn() }));

vi.mock('../../../modules/contatos-do-site/repositorio', () => ({
  contatosDoSiteRepository: { listar: (...args: unknown[]) => mockListar(...args) },
}));

import { ContatosDoSite } from '../ContatosDoSite';

describe('ContatosDoSite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lista cada mensagem com nome, barbearia, assunto, data e status', async () => {
    mockListar.mockResolvedValue({
      contatos: [
        contatoDeTeste({ id: 2, nome: 'Bruno', sobrenome: 'Lima', barbearia: 'Navalha de Ouro', assunto: 'Parceria', recebidoEm: new Date('2026-10-09T15:30:00Z') }),
        contatoDeTeste({ id: 1, nome: 'Ana', sobrenome: 'Souza', barbearia: null, status: 'respondido' }),
      ],
      haMais: false,
    });

    render(<ContatosDoSite />);

    const linhas = await screen.findAllByRole('listitem');
    expect(linhas).toHaveLength(2);
    const primeira = within(linhas[0]);
    expect(primeira.getByText('Bruno Lima')).toBeInTheDocument();
    expect(primeira.getByText('Navalha de Ouro')).toBeInTheDocument();
    expect(primeira.getByText('Parceria')).toBeInTheDocument();
    expect(primeira.getByText('09/10/2026, 12:30')).toBeInTheDocument();
    expect(primeira.getByText('Novo')).toBeInTheDocument();
    // Sem barbearia informada, a linha não mostra campo vazio.
    expect(within(linhas[1]).queryByText('Barbearia da Ana')).not.toBeInTheDocument();
    expect(within(linhas[1]).getByText('Respondido')).toBeInTheDocument();
  });

  it('abrir uma mensagem mostra o e-mail e a mensagem inteira', async () => {
    mockListar.mockResolvedValue({
      contatos: [contatoDeTeste({ email: 'bruno@exemplo.com', mensagem: 'Linha um\nLinha dois' })],
      haMais: false,
    });
    render(<ContatosDoSite />);

    expect(screen.queryByText('bruno@exemplo.com')).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: /Ana Souza/ }));

    expect(screen.getByText('bruno@exemplo.com')).toBeInTheDocument();
    expect(screen.getByText(/Linha um\s+Linha dois/)).toBeInTheDocument();
  });

  it('mostra o texto da mensagem como texto, nunca como HTML', async () => {
    mockListar.mockResolvedValue({
      contatos: [contatoDeTeste({ mensagem: '<script>alert(1)</script><b>negrito</b>' })],
      haMais: false,
    });
    const { container } = render(<ContatosDoSite />);
    await userEvent.click(await screen.findByRole('button', { name: /Ana Souza/ }));

    expect(screen.getByText('<script>alert(1)</script><b>negrito</b>')).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
  });

  it('sem mensagens, diz que não há contatos', async () => {
    mockListar.mockResolvedValue({ contatos: [], haMais: false });
    render(<ContatosDoSite />);
    expect(await screen.findByText('Nenhum contato recebido pelo site.')).toBeInTheDocument();
  });

  it('se a lista não carrega, mostra o erro e tenta de novo', async () => {
    mockListar.mockRejectedValueOnce(new ContatosDoSiteError('falha'));
    mockListar.mockResolvedValueOnce({ contatos: [contatoDeTeste()], haMais: false });
    render(<ContatosDoSite />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os contatos.');
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByText('Ana Souza')).toBeInTheDocument();
    expect(mockListar).toHaveBeenCalledTimes(2);
  });
});
