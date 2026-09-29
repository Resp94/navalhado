import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FaixaDeAviso } from '../FaixaDeAviso';
import type { EstadoDeAcesso } from '../../../modules/assinatura/types';

const DIA = 24 * 60 * 60 * 1000;

const aviso = (motivo: EstadoDeAcesso['motivo'], emDias: number): EstadoDeAcesso => ({
  acesso: 'aviso',
  motivo,
  dataRelevante: new Date(Date.now() + emDias * DIA - 60_000),
});

describe('FaixaDeAviso', () => {
  it('mostra os dias restantes do teste', () => {
    render(<FaixaDeAviso estado={aviso('trial', 3)} />);

    expect(screen.getByRole('status')).toHaveTextContent('Seu período de teste termina em 3 dias.');
  });

  it('no último dia usa o singular', () => {
    render(<FaixaDeAviso estado={aviso('trial', 1)} />);

    expect(screen.getByRole('status')).toHaveTextContent('Seu período de teste termina em 1 dia.');
  });

  it('mostra o prazo do bloqueio quando o pagamento foi recusado', () => {
    render(<FaixaDeAviso estado={aviso('payment_failed', 2)} />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'O pagamento da sua assinatura foi recusado. O acesso será bloqueado em 2 dias.'
    );
  });
});
