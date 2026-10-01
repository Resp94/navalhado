import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUseExportarDados } = vi.hoisted(() => ({ mockUseExportarDados: vi.fn() }));

vi.mock('../../../modules/exportacao/useExportarDados', () => ({
  useExportarDados: (...args: unknown[]) => mockUseExportarDados(...args),
}));

import { BotaoExportarDados } from '../BotaoExportarDados';

// Spec 052, ticket 14: o botão "Exportar dados" do Gerente. O que lê, monta e baixa tem teste próprio (módulo exportacao); aqui só
// interessa o que o botão pede ao hook e o que mostra enquanto e depois.

describe('BotaoExportarDados', () => {
  const exportar = vi.fn();

  const hook = (estado: { exportando?: boolean; erro?: string | null } = {}) =>
    mockUseExportarDados.mockReturnValue({ exportar, exportando: false, erro: null, ...estado });

  beforeEach(() => {
    exportar.mockReset();
    mockUseExportarDados.mockReset();
    hook();
  });

  it('oferece "Exportar dados" e, ao clicar, exporta', async () => {
    render(<BotaoExportarDados tenantId="tenant-1" timezone="America/Manaus" />);

    await userEvent.click(screen.getByRole('button', { name: 'Exportar dados' }));

    expect(exportar).toHaveBeenCalledTimes(1);
  });

  it('exporta os dados da barbearia no fuso dela', () => {
    render(<BotaoExportarDados tenantId="tenant-1" timezone="America/Manaus" />);

    expect(mockUseExportarDados).toHaveBeenCalledWith('tenant-1', 'America/Manaus');
  });

  it('sem fuso, deixa o padrão do módulo (Brasília)', () => {
    render(<BotaoExportarDados tenantId="tenant-1" />);

    expect(mockUseExportarDados).toHaveBeenCalledWith('tenant-1', undefined);
  });

  it('enquanto exporta, o botão não aceita outro clique', () => {
    hook({ exportando: true });
    render(<BotaoExportarDados tenantId="tenant-1" />);

    expect(screen.getByRole('button', { name: /Exportar dados/ })).toBeDisabled();
  });

  it('mostra o erro de uma exportação que falhou, e o botão volta a valer', async () => {
    hook({ erro: 'Não foi possível exportar os dados. Tente de novo.' });
    render(<BotaoExportarDados tenantId="tenant-1" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível exportar os dados. Tente de novo.');
    await userEvent.click(screen.getByRole('button', { name: 'Exportar dados' }));
    expect(exportar).toHaveBeenCalledTimes(1);
  });
});
