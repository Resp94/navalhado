import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { formatDisplayDate } from '../../../modules/relatorios/formatacao';
import { VERSAO_ATUAL_DOS_TERMOS } from '../../../modules/termos/textos';
import { TelaDeAceiteDosTermos } from '../TelaDeAceiteDosTermos';

// A exportação (leitura, CSV, download) tem teste próprio; aqui só interessa quando a tela a oferece e para qual barbearia.
vi.mock('../../acesso/BotaoExportarDados', () => ({
  BotaoExportarDados: ({ tenantId, timezone, fullWidth }: { tenantId: string; timezone?: string; fullWidth?: boolean }) => (
    <div data-testid="exportar-dados">{`${tenantId} ${timezone ?? 'sem fuso'} ${fullWidth ? 'largura total' : 'largura própria'}`}</div>
  ),
}));

// Spec 052, ticket 16: o Gerente que ainda não aceitou a versão atual dos termos vê esta tela antes do painel. O pedido de aceite
// (caixa, erro e botão) tem teste próprio; aqui interessa o que a tela diz e o que ela oferece a quem não quer aceitar.

const renderizar = (props: Partial<React.ComponentProps<typeof TelaDeAceiteDosTermos>> = {}) => {
  const onAceitar = vi.fn();
  const onLogout = vi.fn();
  render(<TelaDeAceiteDosTermos aceitando={false} erro={null} onAceitar={onAceitar} onLogout={onLogout} {...props} />);
  return { onAceitar, onLogout };
};

describe('TelaDeAceiteDosTermos', () => {
  it('pede o aceite da versão atual e começa sem aceitar', () => {
    renderizar();

    expect(screen.getByRole('heading', { name: 'Termos de Uso e Política de Privacidade' })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`versão de ${formatDisplayDate(VERSAO_ATUAL_DOS_TERMOS)}`))).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Li e aceito/ })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Aceitar e continuar' })).toBeDisabled();
  });

  it('marcar o aceite e confirmar chama onAceitar', () => {
    const { onAceitar } = renderizar();

    fireEvent.click(screen.getByRole('checkbox', { name: /Li e aceito/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar e continuar' }));

    expect(onAceitar).toHaveBeenCalledTimes(1);
  });

  it('repassa ao pedido de aceite o andamento e o erro', () => {
    renderizar({ aceitando: true, erro: 'Não foi possível registrar o seu aceite. Tente de novo.' });

    expect(screen.getByRole('button', { name: 'Registrando…' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível registrar o seu aceite. Tente de novo.');
  });

  it('tem os links que abrem os dois textos', () => {
    renderizar();

    expect(screen.getByRole('button', { name: 'Termos de Uso' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Política de Privacidade' })).toBeInTheDocument();
  });

  // Quem não aceita ainda leva os dados ("os dados nunca ficam presos ao Navalhado") e sai da conta.
  it('com a barbearia identificada, quem não aceita ainda exporta os dados dela, no fuso dela', () => {
    renderizar({ tenantId: 'tenant-1', timezone: 'America/Manaus' });

    expect(screen.getByTestId('exportar-dados')).toHaveTextContent('tenant-1 America/Manaus largura total');
    expect(screen.getByText(/Mesmo sem aceitar agora, você leva os seus dados/)).toBeInTheDocument();
    expect(screen.getByText(/baixe os clientes, os agendamentos e as comandas/)).toBeInTheDocument();
  });

  it('sem a barbearia identificada, não oferece a exportação', () => {
    renderizar();

    expect(screen.queryByTestId('exportar-dados')).not.toBeInTheDocument();
  });

  it('"Sair da conta" chama onLogout', () => {
    const { onLogout } = renderizar();

    fireEvent.click(screen.getByRole('button', { name: 'Sair da conta' }));

    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
