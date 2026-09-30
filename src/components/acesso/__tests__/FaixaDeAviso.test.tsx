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

  it('mostra a data do bloqueio quando o pagamento foi recusado', () => {
    const estado: EstadoDeAcesso = {
      acesso: 'aviso',
      motivo: 'payment_failed',
      dataRelevante: new Date('2026-10-03T15:00:00Z'),
    };
    render(<FaixaDeAviso estado={estado} />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Pagamento recusado. Atualize o cartão até 03/10 para não ter o acesso bloqueado.'
    );
  });

  it('a data do bloqueio segue o fuso da barbearia', () => {
    // 03:30 UTC de 04/10: 00:30 do dia 4 em Brasília, 23:30 do dia 3 em Manaus.
    const estado: EstadoDeAcesso = {
      acesso: 'aviso',
      motivo: 'payment_failed',
      dataRelevante: new Date('2026-10-04T03:30:00Z'),
    };
    render(<FaixaDeAviso estado={estado} timezone="America/Manaus" />);

    expect(screen.getByRole('status')).toHaveTextContent('até 03/10');
  });
});
