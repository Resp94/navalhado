import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AvisoQueFalhou } from '../../../modules/proprietario/types';

const { mockUseAvisos, recarregar } = vi.hoisted(() => ({ mockUseAvisos: vi.fn(), recarregar: vi.fn() }));

vi.mock('../../../modules/proprietario/useAvisosQueFalharam', () => ({
  useAvisosQueFalharam: () => mockUseAvisos(),
}));

import { AvisosQueFalharam } from '../AvisosQueFalharam';

// Spec 052, ticket 15: os avisos por e-mail que falharam (ticket 08), para o Proprietário perceber uma chave do Resend vencida ou um
// domínio sem verificação antes de o cliente reclamar.

const aviso = (extra: Partial<AvisoQueFalhou>): AvisoQueFalhou => ({
  id: 'aviso-1',
  tenantId: 'tenant-1',
  barbearia: 'Barbearia Alpha',
  tipo: 'payment_failed_day0',
  referenciaEm: new Date('2026-09-26T12:00:00Z'),
  tentativas: 3,
  motivo: 'Resend 403: domínio sem verificação',
  criadoEm: new Date('2026-10-01T15:00:00Z'),
  ...extra,
});

const com = (estado: { avisos?: AvisoQueFalhou[]; status?: string }) =>
  mockUseAvisos.mockReturnValue({ avisos: [], status: 'ready', recarregar, ...estado });

describe('AvisosQueFalharam', () => {
  beforeEach(() => vi.clearAllMocks());

  it('enquanto lê, não mostra nada', () => {
    com({ status: 'loading' });
    const { container } = render(<AvisosQueFalharam />);

    expect(container).toBeEmptyDOMElement();
  });

  it('sem aviso que falhou, diz que nenhum falhou (para o Proprietário saber que a conferência foi feita)', () => {
    com({ avisos: [] });
    render(<AvisosQueFalharam />);

    expect(screen.getByText('Nenhum aviso por e-mail falhou.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('com avisos que falharam, mostra quantos e cada um com a barbearia, o aviso, as tentativas e o motivo', () => {
    com({
      avisos: [
        aviso({}),
        aviso({ id: 'aviso-2', tenantId: 'tenant-2', barbearia: null, tipo: 'trial_ending', tentativas: 1, motivo: null, criadoEm: new Date('2026-09-29T12:00:00Z') }),
      ],
    });
    render(<AvisosQueFalharam />);

    const regiao = screen.getByRole('region', { name: 'Avisos por e-mail que falharam' });
    expect(within(regiao).getByRole('heading', { name: /avisos por e-mail que falharam \(2\)/i })).toBeInTheDocument();
    expect(within(regiao).getByText(/chave do resend/i)).toBeInTheDocument();

    const linhas = within(regiao).getAllByRole('row').slice(1);
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toHaveTextContent('Barbearia Alpha');
    expect(linhas[0]).toHaveTextContent('Pagamento recusado (dia 0)');
    expect(linhas[0]).toHaveTextContent('3');
    expect(linhas[0]).toHaveTextContent('Resend 403: domínio sem verificação');
    expect(linhas[0]).toHaveTextContent('01/10/2026');
    expect(linhas[1]).toHaveTextContent('Teste terminando');
    expect(linhas[1]).toHaveTextContent('—');
  });

  it('se a leitura falha, diz isso e deixa tentar de novo', async () => {
    com({ status: 'error' });
    render(<AvisosQueFalharam />);

    expect(screen.getByRole('alert')).toHaveTextContent(/não foi possível ler os avisos por e-mail que falharam/i);
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(recarregar).toHaveBeenCalledTimes(1);
  });
});
