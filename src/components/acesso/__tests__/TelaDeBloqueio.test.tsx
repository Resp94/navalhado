import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockAssinar } = vi.hoisted(() => ({ mockAssinar: vi.fn() }));

vi.mock('../../../modules/assinatura/repositorio', () => ({
  assinaturaRepository: { assinar: (...args: unknown[]) => mockAssinar(...args) },
}));


// O fluxo de trocar o cartão (botão, formulário, aviso) tem teste próprio (TrocarCartao.test); aqui só
// interessa quando a tela o oferece e com que informação.
vi.mock('../TrocarCartao', () => ({
  TrocarCartao: ({ cobrancaPendente, acessoBloqueado, destaque }: {
    cobrancaPendente?: boolean;
    acessoBloqueado?: boolean;
    destaque?: boolean;
  }) => (
    <div data-testid="trocar-cartao">
      <span>{cobrancaPendente ? 'com pendência' : 'sem pendência'}</span>
      <span>{acessoBloqueado ? 'acesso bloqueado' : 'acesso liberado'}</span>
      <span>{destaque ? 'ação principal' : 'ação secundária'}</span>
    </div>
  ),
}));

// O fluxo de cancelar (pergunta, aviso, erro) tem teste próprio (CancelarAssinatura.test); aqui só interessa quando a tela o
// oferece, com que informação e o que ela faz depois.
vi.mock('../CancelarAssinatura', () => ({
  CancelarAssinatura: ({ assinatura, onCancelada }: { assinatura: { situacao: string }; onCancelada?: () => void }) => (
    <div data-testid="cancelar-assinatura">
      <span>{`assinatura ${assinatura.situacao}`}</span>
      <button onClick={onCancelada}>simular assinatura cancelada</button>
    </div>
  ),
}));

// A exportação (leitura, CSV, download) tem teste próprio (BotaoExportarDados.test e o módulo exportacao); aqui só interessa
// quando a tela a oferece e para qual barbearia.
vi.mock('../BotaoExportarDados', () => ({
  BotaoExportarDados: ({ tenantId, timezone, fullWidth }: { tenantId: string; timezone?: string; fullWidth?: boolean }) => (
    <div data-testid="exportar-dados">{`${tenantId} ${timezone ?? 'sem fuso'} ${fullWidth ? 'largura total' : 'largura própria'}`}</div>
  ),
}));

import { TelaDeBloqueio } from '../TelaDeBloqueio';

describe('TelaDeBloqueio', () => {
  beforeEach(() => {
    mockAssinar.mockReset();
  });

  it('mostra o motivo do bloqueio como título', () => {
    render(<TelaDeBloqueio motivo="trial_expired" perfil="gerente" tenantName="Barbearia Alpha" onLogout={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Seu período de teste terminou' })).toBeInTheDocument();
    expect(screen.getByText('Barbearia Alpha')).toBeInTheDocument();
  });

  describe('Gerente', () => {
    // Spec 052, ticket 05: o Pagar cria a assinatura e abre a página do Mercado Pago.
    it('vê o botão Pagar, que abre o link de pagamento do Mercado Pago', async () => {
      const link = 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=pre-1';
      mockAssinar.mockResolvedValue({ linkDePagamento: link, assinaturaId: 'pre-1', primeiraCobrancaEm: null });
      const abrirLink = vi.fn();
      render(<TelaDeBloqueio motivo="trial_expired" perfil="gerente" tenantName="Alpha" onLogout={vi.fn()} abrirLink={abrirLink} />);

      const pagar = screen.getByRole('button', { name: 'Pagar' });
      expect(pagar).toBeEnabled();
      await userEvent.click(pagar);

      await waitFor(() => expect(abrirLink).toHaveBeenCalledWith(link));
    });

    it('depois de voltar do Mercado Pago, avisa que o pagamento está sendo confirmado e deixa atualizar', async () => {
      const onAtualizar = vi.fn();
      render(
        <TelaDeBloqueio
          motivo="trial_expired"
          perfil="gerente"
          tenantName="Alpha"
          onLogout={vi.fn()}
          aguardandoConfirmacao
          onAtualizar={onAtualizar}
        />,
      );

      expect(screen.getByRole('status')).toHaveTextContent(/confirmando seu pagamento/i);
      await userEvent.click(screen.getByRole('button', { name: 'Atualizar situação' }));

      expect(onAtualizar).toHaveBeenCalledTimes(1);
    });

    it('sem ter voltado do Mercado Pago, não mostra o aviso de confirmação', () => {
      render(<TelaDeBloqueio motivo="trial_expired" perfil="gerente" tenantName="Alpha" onLogout={vi.fn()} />);

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('recebe o convite para assinar e a garantia de que os dados ficam guardados', () => {
      render(<TelaDeBloqueio motivo="trial_expired" perfil="gerente" tenantName="Alpha" onLogout={vi.fn()} />);

      expect(screen.getByText(/assine um plano/i)).toBeInTheDocument();
      expect(screen.getByText(/dados da sua barbearia continuam guardados/i)).toBeInTheDocument();
    });

    it('com pagamento recusado, a orientação é atualizar o cartão, não assinar de novo', () => {
      render(<TelaDeBloqueio motivo="payment_failed" perfil="gerente" tenantName="Alpha" onLogout={vi.fn()} />);

      expect(screen.getByText(/atualize o cartão/i)).toBeInTheDocument();
      expect(screen.queryByText(/assine um plano/i)).not.toBeInTheDocument();
    });
  });

  // Spec 052, ticket 09: o bloqueio por cartão recusado se resolve trocando o cartão da assinatura que
  // já existe. O "Pagar" só levaria a uma recusa: a assinatura anterior continua ativa no Mercado Pago.
  describe('Gerente bloqueado por pagamento recusado', () => {
    it('vê a troca do cartão no lugar do "Pagar", como ação principal e ciente de que já está bloqueado', () => {
      render(<TelaDeBloqueio motivo="payment_failed" perfil="gerente" tenantName="Alpha" onLogout={vi.fn()} />);

      const troca = screen.getByTestId('trocar-cartao');
      expect(troca).toHaveTextContent('com pendência');
      expect(troca).toHaveTextContent('acesso bloqueado');
      expect(troca).toHaveTextContent('ação principal');
      expect(screen.queryByRole('button', { name: 'Pagar' })).not.toBeInTheDocument();
    });

    it.each(['trial_expired', 'canceled', 'courtesy_expired', 'refunded', 'charged_back', 'blocked'] as const)(
      'nos demais bloqueios (%s) continua o "Pagar", sem a troca do cartão',
      (motivo) => {
        render(<TelaDeBloqueio motivo={motivo} perfil="gerente" tenantName="Alpha" onLogout={vi.fn()} />);

        expect(screen.getByRole('button', { name: 'Pagar' })).toBeInTheDocument();
        expect(screen.queryByTestId('trocar-cartao')).not.toBeInTheDocument();
      },
    );

    it('o Barbeiro bloqueado por pagamento recusado não vê a troca do cartão', () => {
      render(<TelaDeBloqueio motivo="payment_failed" perfil="barbeiro" tenantName="Alpha" onLogout={vi.fn()} />);

      expect(screen.queryByTestId('trocar-cartao')).not.toBeInTheDocument();
    });
  });

  // Spec 052, ticket 12 (revisão): a bloqueada por estorno, contestação, pagamento recusado ou bloqueio do Proprietário costuma ter
  // a assinatura ainda viva no Mercado Pago, que cobraria no mês seguinte. O Gerente que só quer sair a cancela por aqui; o
  // cancelamento nunca desbloqueia, e depois dele a tela manda assinar de novo em vez de trocar o cartão de uma assinatura morta.
  describe('Gerente: cancelar a assinatura que ainda cobra no Mercado Pago', () => {
    it.each(['payment_failed', 'refunded', 'charged_back', 'blocked'] as const)(
      'no bloqueio %s oferece cancelar, com a assinatura como bloqueada',
      (motivo) => {
        render(<TelaDeBloqueio motivo={motivo} perfil="gerente" tenantName="Alpha" onLogout={vi.fn()} />);

        expect(screen.getByTestId('cancelar-assinatura')).toHaveTextContent('assinatura blocked');
      },
    );

    it.each(['trial_expired', 'courtesy_expired', 'canceled'] as const)(
      'no bloqueio %s não oferece cancelar: não há assinatura paga viva',
      (motivo) => {
        render(<TelaDeBloqueio motivo={motivo} perfil="gerente" tenantName="Alpha" onLogout={vi.fn()} />);

        expect(screen.queryByTestId('cancelar-assinatura')).not.toBeInTheDocument();
      },
    );

    it('o Barbeiro nunca vê o cancelamento', () => {
      render(<TelaDeBloqueio motivo="refunded" perfil="barbeiro" tenantName="Alpha" onLogout={vi.fn()} />);

      expect(screen.queryByTestId('cancelar-assinatura')).not.toBeInTheDocument();
    });

    // Depois de voltar do Mercado Pago o pagamento está sendo confirmado: a assinatura viva pode ser a que acabou de ser paga.
    it('enquanto confirma o pagamento de quem acabou de voltar do Mercado Pago, não oferece cancelar', () => {
      render(<TelaDeBloqueio motivo="refunded" perfil="gerente" tenantName="Alpha" onLogout={vi.fn()} aguardandoConfirmacao />);

      expect(screen.queryByTestId('cancelar-assinatura')).not.toBeInTheDocument();
    });

    it('depois de cancelar, relê o estado de acesso: o motivo do banco passa a ser canceled e a tela manda assinar de novo', async () => {
      const onCancelada = vi.fn();
      render(<TelaDeBloqueio motivo="payment_failed" perfil="gerente" tenantName="Alpha" onLogout={vi.fn()} onCancelada={onCancelada} />);

      await userEvent.click(screen.getByRole('button', { name: 'simular assinatura cancelada' }));

      expect(onCancelada).toHaveBeenCalledTimes(1);
    });
  });

  // Spec 052, ticket 14: os dados nunca ficam presos ao Navalhado. O Gerente bloqueado, seja qual for o motivo, baixa os clientes, os
  // agendamentos e as comandas da barbearia; o Barbeiro não vê o botão.
  describe('Gerente: exportar os dados', () => {
    it.each(['trial_expired', 'payment_failed', 'canceled', 'courtesy_expired', 'refunded', 'charged_back', 'blocked'] as const)(
      'no bloqueio %s oferece "Exportar dados" da barbearia dele, no fuso dela',
      (motivo) => {
        render(
          <TelaDeBloqueio motivo={motivo} perfil="gerente" tenantName="Alpha" tenantId="tenant-1" timezone="America/Manaus" onLogout={vi.fn()} />,
        );

        expect(screen.getByTestId('exportar-dados')).toHaveTextContent('tenant-1 America/Manaus largura total');
      },
    );

    it('oferece mesmo com o pagamento ainda sendo confirmado: exportar nunca depende de pagar', () => {
      render(<TelaDeBloqueio motivo="trial_expired" perfil="gerente" tenantName="Alpha" tenantId="tenant-1" onLogout={vi.fn()} aguardandoConfirmacao />);

      expect(screen.getByTestId('exportar-dados')).toBeInTheDocument();
    });

    it('sem saber qual é a barbearia, não oferece', () => {
      render(<TelaDeBloqueio motivo="trial_expired" perfil="gerente" tenantName="Alpha" onLogout={vi.fn()} />);

      expect(screen.queryByTestId('exportar-dados')).not.toBeInTheDocument();
    });

    it('o Barbeiro nunca vê, mesmo com a barbearia identificada', () => {
      render(<TelaDeBloqueio motivo="trial_expired" perfil="barbeiro" tenantName="Alpha" tenantId="tenant-1" onLogout={vi.fn()} />);

      expect(screen.queryByTestId('exportar-dados')).not.toBeInTheDocument();
    });
  });

  describe('Barbeiro', () => {
    it('recebe só a explicação, sem botão de pagar', () => {
      render(<TelaDeBloqueio motivo="trial_expired" perfil="barbeiro" tenantName="Alpha" onLogout={vi.fn()} />);

      expect(screen.getByText(/fale com o gerente/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Pagar' })).not.toBeInTheDocument();
    });

    it('nunca vê o aviso de confirmação de pagamento', () => {
      render(
        <TelaDeBloqueio motivo="trial_expired" perfil="barbeiro" tenantName="Alpha" onLogout={vi.fn()} aguardandoConfirmacao />,
      );

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  it('o usuário bloqueado consegue sair da conta', async () => {
    const onLogout = vi.fn();
    render(<TelaDeBloqueio motivo="blocked" perfil="barbeiro" tenantName="Alpha" onLogout={onLogout} />);

    await userEvent.click(screen.getByRole('button', { name: 'Sair da conta' }));

    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
