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
    mockListar.mockReset();
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

  it('abre no filtro Novos', async () => {
    mockListar.mockResolvedValue({ contatos: [], haMais: false });
    render(<ContatosDoSite />);

    expect(await screen.findByText('Nenhum contato novo.')).toBeInTheDocument();
    expect(mockListar).toHaveBeenCalledWith('novo', null);
    expect(screen.getByRole('button', { name: 'Novos' })).toHaveAttribute('aria-pressed', 'true');
  });

  it.each([
    ['Lidos', 'lido', 'Nenhum contato lido.'],
    ['Respondidos', 'respondido', 'Nenhum contato respondido.'],
    ['Todos', null, 'Nenhum contato recebido pelo site.'],
  ])('o filtro %s busca de novo e tem o próprio vazio', async (rotulo, status, vazio) => {
    mockListar.mockResolvedValue({ contatos: [], haMais: false });
    render(<ContatosDoSite />);
    await screen.findByText('Nenhum contato novo.');

    await userEvent.click(screen.getByRole('button', { name: rotulo }));

    expect(await screen.findByText(vazio)).toBeInTheDocument();
    expect(mockListar).toHaveBeenLastCalledWith(status, null);
    expect(screen.getByRole('button', { name: rotulo })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Novos' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('"Carregar mais" traz as mais antigas depois da última da lista', async () => {
    mockListar.mockResolvedValueOnce({ contatos: [contatoDeTeste({ id: 9, nome: 'Nove' }), contatoDeTeste({ id: 8, nome: 'Oito' })], haMais: true });
    mockListar.mockResolvedValueOnce({ contatos: [contatoDeTeste({ id: 3, nome: 'Três' })], haMais: false });
    render(<ContatosDoSite />);

    await userEvent.click(await screen.findByRole('button', { name: 'Carregar mais' }));

    expect(mockListar).toHaveBeenLastCalledWith('novo', 8);
    expect(await screen.findByText('Três Souza')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).not.toBeInTheDocument();
  });

  it('sem mais mensagens, não oferece "Carregar mais"', async () => {
    mockListar.mockResolvedValue({ contatos: [contatoDeTeste()], haMais: false });
    render(<ContatosDoSite />);
    await screen.findByText('Ana Souza');
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).not.toBeInTheDocument();
  });

  it('se "Carregar mais" falha, mantém a lista e deixa tentar de novo', async () => {
    mockListar.mockResolvedValueOnce({ contatos: [contatoDeTeste({ id: 9 })], haMais: true });
    mockListar.mockRejectedValueOnce(new ContatosDoSiteError('falha'));
    mockListar.mockResolvedValueOnce({ contatos: [contatoDeTeste({ id: 3, nome: 'Três' })], haMais: false });
    render(<ContatosDoSite />);

    await userEvent.click(await screen.findByRole('button', { name: 'Carregar mais' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar mais contatos.');
    expect(screen.getByText('Ana Souza')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));
    expect(await screen.findByText('Três Souza')).toBeInTheDocument();
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
