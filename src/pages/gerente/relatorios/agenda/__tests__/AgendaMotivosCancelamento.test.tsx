import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AgendaMotivosCancelamento } from '../AgendaMotivosCancelamento';
import type { RelatorioAgendaMotivosCancelamento } from '../../../../../modules/relatorios/types';

const VAZIO: RelatorioAgendaMotivosCancelamento = { shop: [], customer: [], desconhecida: [] };

describe('AgendaMotivosCancelamento (spec 044, ticket 16)', () => {
  it('separa os três grupos em seções distintas, cada uma com o selo sutil de quem cancelou', () => {
    render(
      <AgendaMotivosCancelamento
        reasons={{
          shop: [{ reason: 'falta de horário', count: 3 }],
          customer: [{ reason: 'imprevisto', count: 1 }],
          desconhecida: [{ reason: 'cliente desmarcou', count: 2 }],
        }}
      />
    );

    expect(screen.getByText('Barbearia')).toBeInTheDocument();
    expect(screen.getByText('Cliente')).toBeInTheDocument();
    expect(screen.getByText('Desconhecido')).toBeInTheDocument();
    expect(screen.getByText('Falta de horário')).toBeInTheDocument();
    expect(screen.getByText('Imprevisto')).toBeInTheDocument();
    expect(screen.getByText('Cliente desmarcou')).toBeInTheDocument();
  });

  it('grupo vazio não aparece na tela', () => {
    render(
      <AgendaMotivosCancelamento
        reasons={{
          shop: [{ reason: 'falta de horário', count: 1 }],
          customer: [],
          desconhecida: [],
        }}
      />
    );

    expect(screen.getByText('Barbearia')).toBeInTheDocument();
    expect(screen.queryByText('Cliente')).not.toBeInTheDocument();
    expect(screen.queryByText('Desconhecido')).not.toBeInTheDocument();
  });

  it('mostra o estado vazio só quando os três grupos estão vazios', () => {
    render(<AgendaMotivosCancelamento reasons={VAZIO} />);

    expect(screen.getByText('Nenhum cancelamento no período')).toBeInTheDocument();
    expect(screen.queryByText('Barbearia')).not.toBeInTheDocument();
  });

  it('o selo é sutil (badgeType subtle), nunca fundo sólido', () => {
    render(
      <AgendaMotivosCancelamento
        reasons={{ shop: [{ reason: 'falta de horário', count: 1 }], customer: [], desconhecida: [] }}
      />
    );

    const selo = screen.getByText('Barbearia');
    expect(selo.className).not.toMatch(/-solid\b/);
  });

  it('cada motivo mostra a contagem de cancelamentos ao lado', () => {
    render(
      <AgendaMotivosCancelamento
        reasons={{ shop: [{ reason: 'falta de horário', count: 7 }], customer: [], desconhecida: [] }}
      />
    );

    const linha = screen.getByText('Falta de horário').closest('tr') as HTMLElement;
    expect(within(linha).getByText('7')).toBeInTheDocument();
  });
});
