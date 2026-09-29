import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EstadoDeAcesso } from '../../../modules/assinatura/types';

const { mockAssinar, mockUseEstadoDeAcesso } = vi.hoisted(() => ({
  mockAssinar: vi.fn(),
  mockUseEstadoDeAcesso: vi.fn(),
}));

vi.mock('../../../modules/assinatura/repositorio', () => ({
  assinaturaRepository: { assinar: (...args: unknown[]) => mockAssinar(...args) },
}));

vi.mock('../../../modules/assinatura/useEstadoDeAcesso', () => ({
  useEstadoDeAcesso: () => mockUseEstadoDeAcesso(),
}));

import { SecaoAssinatura } from '../SecaoAssinatura';

// Spec 052, ticket 05: seção Assinatura mínima em Configurações. O ticket 06 traz a tela completa.

const recarregar = vi.fn();

const comEstado = (estado: EstadoDeAcesso | null, diasRestantes: number | null = null) =>
  mockUseEstadoDeAcesso.mockReturnValue({ estado, status: estado ? 'ready' : 'loading', diasRestantes, recarregar });

const renderizar = (search = '', abrirLink = vi.fn()) => {
  render(<SecaoAssinatura search={search} abrirLink={abrirLink} />);
  return { abrirLink };
};

describe('SecaoAssinatura', () => {
  beforeEach(() => {
    mockAssinar.mockReset();
    recarregar.mockReset();
  });

  it('no teste: mostra os dias que restam e o Assinar abre o link do Mercado Pago', async () => {
    const link = 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=pre-1';
    mockAssinar.mockResolvedValue({ linkDePagamento: link, assinaturaId: 'pre-1', primeiraCobrancaEm: null });
    comEstado({ acesso: 'liberado', motivo: 'trial', dataRelevante: new Date('2026-10-14T15:00:00Z') }, 10);
    const { abrirLink } = renderizar();

    expect(screen.getByRole('heading', { name: 'Assinatura' })).toBeInTheDocument();
    expect(screen.getByText(/período de teste/i)).toBeInTheDocument();
    expect(screen.getByText(/restam 10 dias/)).toBeInTheDocument();
    expect(screen.getByText(/primeira cobrança só acontece no fim do teste/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Assinar' }));

    await waitFor(() => expect(abrirLink).toHaveBeenCalledWith(link));
  });

  it('no último dia do teste, fala em 1 dia (singular)', () => {
    comEstado({ acesso: 'aviso', motivo: 'trial', dataRelevante: new Date('2026-10-14T15:00:00Z') }, 1);
    renderizar();

    expect(screen.getByText(/restam 1 dia\)/)).toBeInTheDocument();
  });

  it('assinatura ativa: mostra a situação e não oferece assinar de novo', () => {
    comEstado({ acesso: 'liberado', motivo: 'active', dataRelevante: null });
    renderizar();

    expect(screen.getByText(/assinatura ativa/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /assinar/i })).not.toBeInTheDocument();
  });

  it('cancelada com acesso até o fim do período: mostra a data e deixa assinar de novo', () => {
    comEstado({ acesso: 'liberado', motivo: 'canceled', dataRelevante: new Date('2026-10-20T12:00:00Z') });
    renderizar();

    expect(screen.getByText(/assinatura cancelada/i)).toBeInTheDocument();
    expect(screen.getByText(/20\/10\/2026/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Assinar de novo' })).toBeEnabled();
  });

  it('pagamento recusado: avisa da cobrança pendente, sem oferecer uma nova assinatura', () => {
    comEstado({ acesso: 'aviso', motivo: 'payment_failed', dataRelevante: new Date('2026-10-03T12:00:00Z') });
    renderizar();

    expect(screen.getByText(/cobrança pendente/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /assinar/i })).not.toBeInTheDocument();
  });

  it('cortesia: mostra a situação, sem botão de assinar', () => {
    comEstado({ acesso: 'liberado', motivo: 'courtesy', dataRelevante: null });
    renderizar();

    expect(screen.getByText(/cortesia/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /assinar/i })).not.toBeInTheDocument();
  });

  it('enquanto o estado não chega, não mostra nada', () => {
    comEstado(null);
    renderizar();

    expect(screen.queryByRole('heading', { name: 'Assinatura' })).not.toBeInTheDocument();
  });

  it('voltando do Mercado Pago: avisa que a confirmação está em andamento e deixa atualizar', async () => {
    comEstado({ acesso: 'liberado', motivo: 'trial', dataRelevante: new Date('2026-10-14T15:00:00Z') }, 10);
    renderizar('?assinatura=retorno');

    expect(screen.getByRole('status')).toHaveTextContent(/confirmando sua assinatura/i);
    await userEvent.click(screen.getByRole('button', { name: 'Atualizar situação' }));

    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  // Visto no roteiro manual: depois que o webhook ativa a barbearia, o aviso não pode continuar
  // dizendo que está confirmando.
  it('voltando do Mercado Pago com a assinatura já ativa: confirma o pagamento em vez de dizer que está confirmando', () => {
    comEstado({ acesso: 'liberado', motivo: 'active', dataRelevante: null });
    renderizar('?assinatura=retorno');

    expect(screen.getByRole('status')).toHaveTextContent(/pagamento confirmado/i);
    expect(screen.queryByText(/confirmando sua assinatura/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Atualizar situação' })).not.toBeInTheDocument();
  });

  it('sem voltar do Mercado Pago, não mostra o aviso de confirmação', () => {
    comEstado({ acesso: 'liberado', motivo: 'trial', dataRelevante: new Date('2026-10-14T15:00:00Z') }, 10);
    renderizar();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
